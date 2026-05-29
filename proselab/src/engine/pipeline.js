// @ts-nocheck
/**
 * Generation Pipeline
 * Orchestrates the full Generate -> Validate -> Critique -> Extract loop.
 */

import { critiqueScene } from './critique.js';
import { extractLore } from './lore-extraction.js';
import { callOllama } from '../services/llm.js';
import { generateRewrite } from './rewrite.js';
import { Providers } from './providers.js';
import { analyze, buildDelta } from './analysis.js';
import { validateStage, validateTransition } from './pipelineSchema.js';
import { runHeuristics } from './heuristics.js';
import { evaluateFriction } from './friction.js';
import { arbitrate } from './arbitration.js';
import { buildStateConstraints, injectStateConstraints } from './stateTransition.js';
import { extractEvents } from './eventExtractor.js';
import { evaluateDeltas } from './deltaEvaluator.js';

function parseFirstJSONObject(raw) {
  const source = String(raw || '').replace(/```json|```/gi, '').trim();
  const starts = [];
  let inString = false;
  let escaped = false;

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') {
      starts.push(i);
    }
  }

  for (let s = 0; s < starts.length; s += 1) {
    const start = starts[s];
    let depth = 0;
    inString = false;
    escaped = false;

    for (let i = start; i < source.length; i += 1) {
      const ch = source[i];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (ch === '\\') {
          escaped = true;
        } else if (ch === '"') {
          inString = false;
        }
        continue;
      }

      if (ch === '"') {
        inString = true;
        continue;
      }

      if (ch === '{') depth += 1;
      if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          const candidate = source.slice(start, i + 1);
          try {
            return JSON.parse(candidate);
          } catch {
            break;
          }
        }
      }
    }
  }

  return null;
}

export class GenerationPipeline {
  constructor(db, providers, emitter) {
    this.db = db;
    this.providers = providers;
    this.emitter = emitter; // Event emitter for UI updates
  }

  async generateScene(sceneId, options = {}) {
    const scene = await this.db.scenes.get(sceneId);
    if (!scene) throw new Error(`Scene not found: ${sceneId}`);

    const chapter = await this.db.chapters.get(scene.chapterId);
    const project = await this.db.projects.get(scene.projectId);
    const settings = await this.db.projectSettings.get(scene.projectId) || {};

    this.emitter.emit('pipeline:start', { sceneId, stages: ['context', 'generate', 'validate', 'critique', 'extract'] });

    try {
      // ── Stage 1: Build Context ──────────────────────────────
      this.emitter.emit('pipeline:stage', { stage: 'context', status: 'running' });

      const context = await this.buildContext(scene, chapter, project, settings);

      this.emitter.emit('pipeline:stage', { stage: 'context', status: 'complete' });

      // ── Stage 2: Generate Prose ─────────────────────────────
      this.emitter.emit('pipeline:stage', { stage: 'generate', status: 'running' });

      const voiceProfile = settings.voiceProfileId
        ? await this.db.voiceProfiles.get(settings.voiceProfileId)
        : null;

      const generationResult = await this.generateProse(scene, context, voiceProfile, options);

      this.emitter.emit('pipeline:stage', { stage: 'generate', status: 'complete' });
      this.emitter.emit('pipeline:prose', { prose: generationResult.prose });

      // ── Stage 3: Validate ───────────────────────────────────
      this.emitter.emit('pipeline:stage', { stage: 'validate', status: 'running' });

      const validationResult = await this.validateProse(
        generationResult.prose,
        context,
        scene
      );

      this.emitter.emit('pipeline:stage', { stage: 'validate', status: 'complete' });
      this.emitter.emit('pipeline:validation', { result: validationResult });

      // ── Stage 4: Critique ───────────────────────────────────
      this.emitter.emit('pipeline:stage', { stage: 'critique', status: 'running' });

      const critiqueResult = await critiqueScene(
        generationResult.prose,
        {
          sceneBeat: scene.beat,
          voiceProfile: voiceProfile?.profile
        },
        this.providers
      );

      this.emitter.emit('pipeline:stage', { stage: 'critique', status: 'complete' });
      this.emitter.emit('pipeline:critique', { result: critiqueResult });

      // ── Stage 5: Extract Lore ───────────────────────────────
      this.emitter.emit('pipeline:stage', { stage: 'extract', status: 'running' });

      const shadowActions = await extractLore(
        generationResult.prose,
        {
          sceneId: scene.id,
          relevantEntities: context.entities
        },
        scene.projectId,
        this.providers
      );

      // Store shadow actions as pending
      for (const action of shadowActions) {
        action.status = 'pending';
        await this.db.shadowActions.add(action);
      }

     this.emitter.emit('pipeline:stage', { stage: 'extract', status: 'complete' });
      this.emitter.emit('pipeline:shadowActions', { actions: shadowActions });

      // ── Save Results ────────────────────────────────────────
      const newVersion = (scene.currentVersion || 0) + 1;

      await this.db.sceneVersions.add({
        sceneId: scene.id,
        version: newVersion,
        prose: generationResult.prose,
        wordCount: generationResult.prose.split(/\s+/).length,
        source: options.revisionNotes ? 'revision' : 'generated',
        generationLog: {
          model: generationResult.usage.model,
          inputTokens: generationResult.usage.inputTokens,
          outputTokens: generationResult.usage.outputTokens,
          elapsed: generationResult.usage.elapsed
        },
        createdAt: Date.now()
      });

      await this.db.scenes.update(scene.id, {
        prose: generationResult.prose,
        wordCount: generationResult.prose.split(/\s+/).length,
        currentVersion: newVersion,
        status: 'generated',
        validationResult,
        critiqueResult,
        updatedAt: Date.now()
      });

      // Log all LLM calls for cost tracking
      await this.logGeneration(scene, 'generation', generationResult.usage);

      this.emitter.emit('pipeline:complete', {
        sceneId,
        wordCount: generationResult.prose.split(/\s+/).length,
        validationScore: validationResult.overallScore,
        shadowActionCount: shadowActions.length
      });

      return {
        prose: generationResult.prose,
        validation: validationResult,
        critique: critiqueResult,
        shadowActions,
        version: newVersion
      };

    } catch (error) {
      this.emitter.emit('pipeline:error', { sceneId, error: error.message, stage: error.stage });
      throw error;
    }
  }

  async buildContext(scene, chapter, project, settings) {
    // Gather preceding scenes for narrative continuity
    const allScenes = await this.db.scenes
      .where('projectId').equals(project.id)
      .sortBy('order');

    // Find this scene's position in the global order
    const globalOrder = [];
    const chapters = await this.db.chapters
      .where('projectId').equals(project.id)
      .sortBy('order');

    for (const ch of chapters) {
      const chapterScenes = allScenes
        .filter(s => s.chapterId === ch.id)
        .sort((a, b) => a.order - b.order);
      for (const s of chapterScenes) {
        globalOrder.push({ ...s, chapterTitle: ch.title });
      }
    }

    const currentIndex = globalOrder.findIndex(s => s.id === scene.id);

    // Get preceding scenes — full prose for the last 2, summaries for earlier ones
    const precedingScenes = globalOrder.slice(0, currentIndex);
    const recentScenes = precedingScenes.slice(-2);
    const earlierScenes = precedingScenes.slice(0, -2);

    // Build the narrative context string
    let narrativeContext = '';

    if (earlierScenes.length > 0) {
      narrativeContext += '## STORY SO FAR (Summaries)\n\n';
      for (const s of earlierScenes) {
        const summary = s.summary || await this.generateSummary(s);
        narrativeContext += `**${s.chapterTitle} — ${s.title || 'Untitled Scene'}**: ${summary}\n\n`;
      }
    }

    if (recentScenes.length > 0) {
      narrativeContext += '## RECENT SCENES (Full Text)\n\n';
      for (const s of recentScenes) {
        if (s.prose) {
          narrativeContext += `### ${s.chapterTitle} — ${s.title || 'Untitled Scene'}\n\n${s.prose}\n\n---\n\n`;
        }
      }
    }

    // Get the next scene's beat for foreshadowing awareness
    const nextScene = globalOrder[currentIndex + 1];
    const nextBeat = nextScene?.beat || null;

    // Gather relevant lore entities
    const allEntities = await this.db.entities
      .where('projectId').equals(project.id)
      .toArray();

    // Filter to entities likely relevant to this scene
    const relevantEntities = this.filterRelevantEntities(allEntities, scene);

    // Get the outline context
    const outlineNodes = await this.db.outlineNodes
      .where('projectId').equals(project.id)
      .toArray();

    const outlineContext = this.buildOutlineContext(outlineNodes, scene);

    return {
      narrativeContext,
      entities: relevantEntities,
      nextBeat,
      outlineContext,
      chapterTitle: chapter.title,
      chapterSummary: chapter.summary,
      projectGenre: project.genre,
      projectLogline: project.logline,
      scenePosition: {
        current: currentIndex + 1,
        total: globalOrder.length,
        isFirst: currentIndex === 0,
        isLast: currentIndex === globalOrder.length - 1,
        chapterPosition: scene.order
      }
    };
  }

  filterRelevantEntities(allEntities, scene) {
    const beatLower = (scene.beat || '').toLowerCase();
    const povLower = (scene.pov || '').toLowerCase();
    const locationLower = (scene.location || '').toLowerCase();

    return allEntities.filter(entity => {
      const nameLower = entity.name.toLowerCase();
      const aliasesLower = (entity.aliases || []).map(a => a.toLowerCase());

      // Always include POV character
      if (nameLower === povLower || aliasesLower.includes(povLower)) return true;

      // Always include the location
      if (entity.type === 'location' && (nameLower === locationLower || aliasesLower.includes(locationLower))) return true;

      // Include if mentioned in the beat
      if (beatLower.includes(nameLower)) return true;
      if (aliasesLower.some(alias => beatLower.includes(alias))) return true;

      // Include characters with relationships to the POV character
      if (entity.type === 'character' && entity.relationships) {
        const relatedToPov = entity.relationships.some(r =>
          (r.targetName || '').toLowerCase() === povLower
        );
        if (relatedToPov) return true;
      }

      return false;
    });
  }

  buildOutlineContext(outlineNodes, scene) {
    if (!outlineNodes.length) return '';

    // Build a tree and find the current scene's position
    const roots = outlineNodes.filter(n => !n.parentId).sort((a, b) => a.order - b.order);

    const buildTree = (parentId) => {
      return outlineNodes
        .filter(n => n.parentId === parentId)
        .sort((a, b) => a.order - b.order)
        .map(n => ({
          ...n,
          children: buildTree(n.id)
        }));
    };

    const tree = roots.map(r => ({ ...r, children: buildTree(r.id) }));

    // Flatten to a readable outline
    let outline = '## STORY OUTLINE\n\n';
    const render = (nodes, depth = 0) => {
      for (const node of nodes) {
        const indent = '  '.repeat(depth);
        const marker = node.linkedSceneId === scene.id ? '→ ' : '  ';
        const statusIcon = node.status === 'complete' ? '✓' : node.status === 'in_progress' ? '◐' : '○';
        outline += `${indent}${marker}${statusIcon} ${node.title}`;
        if (node.description) outline += ` — ${node.description}`;
        outline += '\n';
        if (node.children) render(node.children, depth + 1);
      }
    };

    render(tree);
    return outline;
  }

  async generateSummary(scene) {
    if (!scene.prose) return 'Scene not yet written.';

    const response = await this.providers.callLLM({
      role: 'utility',
      messages: [
        {
          role: 'system',
          content: 'Summarize this scene in 2-3 sentences. Focus on: what happens, who is involved, what changes, and any important information revealed. Be factual and concise.'
        },
        {
          role: 'user',
          content: scene.prose
        }
      ],
      temperature: 0.3,
      max_tokens: 200
    });

    if (!response.ok) return 'Summary generation failed.';

    // Cache the summary
    await this.db.scenes.update(scene.id, { summary: response.content });

    await this.logGeneration(scene, 'summary', response.usage);

    return response.content;
  }

  async generateProse(scene, context, voiceProfile, options) {
    const systemPrompt = this.buildGenerationSystemPrompt(context, voiceProfile, options);
    const userPrompt = this.buildGenerationUserPrompt(scene, context, options);

    const response = await this.providers.callLLM({
      role: 'generation',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: options.temperature ?? 0.8,
      max_tokens: options.maxTokens ?? 4096,
      stream: options.stream ?? true
    });

    if (response.stream) {
      // Collect streamed content while forwarding to UI
      let fullContent = '';
      let usage = null;

      for await (const chunk of response.stream) {
        if (chunk.type === 'content') {
          fullContent += chunk.content;
          this.emitter.emit('pipeline:stream', { content: chunk.content });
        }
        if (chunk.type === 'usage') {
          usage = chunk.usage;
        }
      }

      return {
        prose: fullContent,
        usage: {
          ...response.usage,
          inputTokens: usage?.input_tokens || usage?.prompt_tokens || 0,
          outputTokens: usage?.output_tokens || usage?.completion_tokens || 0,
          model: this.providers.getModel('generation'),
          elapsed: Date.now() // approximate
        }
      };
    }

    return {
      prose: response.content,
      usage: response.usage
    };
  }

  buildGenerationSystemPrompt(context, voiceProfile, options) {
    let prompt = `You are a fiction writing engine. You generate prose for a single scene in a larger work. Your output should be ONLY the scene prose — no meta-commentary, no scene headers, no "Chapter X" labels.

## CORE PRINCIPLES
- Write the scene and nothing else
- Maintain perfect continuity with preceding scenes
- Honor all lore and character details provided
- End the scene at a natural stopping point that creates forward momentum
- Show, don't tell — prefer action and dialogue over exposition
- Every scene must change something — a relationship, a piece of knowledge, a situation
`;

    if (context.projectGenre) {
      prompt += `\n## GENRE\n${context.projectGenre}\n`;
    }

    if (voiceProfile?.profile) {
      prompt += `\n## VOICE & STYLE PROFILE\n${voiceProfile.profile}\n`;
    }

    if (context.entities.length > 0) {
      prompt += `\n## LORE & CHARACTER REFERENCE\n`;
      for (const entity of context.entities) {
        prompt += `\n### ${entity.name} (${entity.type})\n`;
        if (entity.description) prompt += `${entity.description}\n`;
        if (entity.physicalDescription) prompt += `Physical: ${entity.physicalDescription}\n`;
        if (entity.currentState && Object.keys(entity.currentState).length > 0) {
          prompt += `Current State: ${JSON.stringify(entity.currentState)}\n`;
        }
        if (entity.permanentTraits && Object.keys(entity.permanentTraits).length > 0) {
          prompt += `Traits: ${JSON.stringify(entity.permanentTraits)}\n`;
        }
        if (entity.relationships && entity.relationships.length > 0) {
          prompt += `Relationships:\n`;
          for (const rel of entity.relationships) {
            prompt += `  - ${rel.relationshipType} with ${rel.targetName}: ${rel.description}\n`;
          }
        }
      }
    }

    if (context.outlineContext) {
      prompt += `\n${context.outlineContext}\n`;
    }

    return prompt;
  }

  buildGenerationUserPrompt(scene, context, options) {
    let prompt = '';

    if (context.narrativeContext) {
      prompt += `${context.narrativeContext}\n`;
    }

    prompt += `## CURRENT SCENE TO WRITE\n\n`;
    prompt += `**Chapter**: ${context.chapterTitle}\n`;

    if (scene.title) prompt += `**Scene Title**: ${scene.title}\n`;
    if (scene.pov) prompt += `**POV Character**: ${scene.pov}\n`;
    if (scene.location) prompt += `**Location**: ${scene.location}\n`;
    if (scene.timeframe) prompt += `**Timeframe**: ${scene.timeframe}\n`;
    if (scene.mood) prompt += `**Mood/Tone**: ${scene.mood}\n`;

    prompt += `\n**Scene Beat**: ${scene.beat}\n`;

    if (context.nextBeat) {
      prompt += `\n**Next Scene Beat** (for awareness — do NOT write this scene, but set it up): ${context.nextBeat}\n`;
    }

    prompt += `\n**Position**: Scene ${context.scenePosition.current} of ${context.scenePosition.total}`;
    if (context.scenePosition.isFirst) prompt += ` (OPENING SCENE — establish the world and hook the reader)`;
    if (context.scenePosition.isLast) prompt += ` (FINAL SCENE — bring the story to a satisfying conclusion)`;
    prompt += `\n`;

    if (options.targetWordCount) {
      prompt += `\n**Target Length**: approximately ${options.targetWordCount} words\n`;
    }

    if (options.additionalInstructions) {
      prompt += `\n**Additional Instructions**: ${options.additionalInstructions}\n`;
    }

    if (options.revisionNotes) {
      prompt += `\n## REVISION REQUEST\nThe previous version of this scene needs revision. Here are the notes:\n${options.revisionNotes}\n`;
      if (scene.prose) {
        prompt += `\n## PREVIOUS VERSION\n${scene.prose}\n`;
      }
    }

    prompt += `\nWrite the scene now.`;

    return prompt;
  }

  async validateProse(prose, context, scene) {
    const validationPrompt = `You are a continuity and quality validator for fiction. Analyze the following scene against the provided context and check for:

1. **Continuity Errors**: Does anything contradict what happened in previous scenes?
2. **Character Consistency**: Do characters behave consistently with their established traits?
3. **Lore Violations**: Does anything contradict established world facts?
4. **Physical Impossibilities**: Are there spatial, temporal, or physical logic errors?
5. **Beat Fulfillment**: Does the scene accomplish what the beat describes?
6. **Dangling References**: Does the scene reference people, places, or events not established?

Respond in JSON format:
{
  "overallScore": <1-10>,
  "beatFulfilled": <true/false>,
  "issues": [
    {
      "type": "continuity|character|lore|physics|reference",
      "severity": "critical|warning|minor",
      "description": "...",
      "quote": "relevant quote from the prose",
      "suggestion": "how to fix"
    }
  ],
  "strengths": ["..."],
  "summary": "Brief overall assessment"
}`;

    let contextBlock = '';
    if (context.narrativeContext) {
      contextBlock += `## PRECEDING CONTEXT\n${context.narrativeContext}\n\n`;
    }
    if (context.entities.length > 0) {
      contextBlock += `## ESTABLISHED LORE\n`;
      for (const entity of context.entities) {
        contextBlock += `- ${entity.name} (${entity.type}): ${entity.description || 'No description'}\n`;
        if (entity.currentState && Object.keys(entity.currentState).length > 0) {
          contextBlock += `  State: ${JSON.stringify(entity.currentState)}\n`;
        }
      }
      contextBlock += '\n';
    }

    const response = await this.providers.callLLM({
      role: 'validation',
      messages: [
        { role: 'system', content: validationPrompt },
        {
          role: 'user',
         content: `${contextBlock}## SCENE BEAT\n${scene.beat}\n\n## GENERATED PROSE\n${prose}`
        }
      ],
      temperature: 0.2,
      max_tokens: 2000,
      response_format: { type: 'json_object' }
    });

    if (!response.ok) return { overallScore: 0, issues: [] };

    await this.logGeneration(scene, 'validation', response.usage);

    const parsed = parseFirstJSONObject(response.content);
    if (parsed) return parsed;

    return {
      overallScore: 0,
      beatFulfilled: false,
      issues: [{ type: 'parse_error', severity: 'critical', description: 'Could not parse validation response' }],
      strengths: [],
      summary: 'Validation failed to parse'
    };
  }

  async logGeneration(scene, stage, usage) {
    await this.db.generationLogs.add({
      projectId: scene.projectId,
      sceneId: scene.id,
      stage,
      model: usage?.model || 'unknown',
      inputTokens: usage?.inputTokens || 0,
      outputTokens: usage?.outputTokens || 0,
      elapsed: usage?.elapsed || 0,
      estimatedCost: usage?.estimatedCost || 0,
      createdAt: Date.now()
    });
  }
}

/**
 * LEGACY EXPORT BRIDGE
 * Restores compatibility for v1 API and Create Mode orchestrator.
 */
export const INFERENCE_CACHE_CONTEXT_VERSION = "voice-lock-v1";

export const ENGINE_FLAGS = {
  STRICT_MODE: true,
  ENABLE_CRITIQUE: true,
  ENABLE_LORE_EXTRACTION: true,
  DEFAULT_MODEL: "gpt-4o-mini"
};

export async function runPipeline(params) {
  // If we have a db in params, use the new stateful pipeline
  if (params.db) {
    const pipeline = new GenerationPipeline(params.db, params.providers, params.emitter);
    return pipeline.generateScene(params.sceneId, params);
  }
  
  console.warn("Pipeline: Running in stateless bridge mode.");
  const {
    text,
    sceneIntent,
    keys,
    model = "rocinante",
    onStage = () => {},
    onUpdate = () => {},
    sceneContext = "",
    voiceSpec = {},
    logTokenUsage = () => {},
    estimateTokens = () => 0,
    cacheVersion,
    characterStates = {},
  } = params;

  if (!sceneIntent) {
    throw new Error("CREATE blocked: scene intent is required.");
  }

  let currentDraft = text;
  let analysisData = null;
  let deltaData = null;

  try {
    // 1. ANALYSIS PASS
    onStage("analysis");
    analysisData = analyze(currentDraft);
    validateStage("analysis", analysisData);
    onUpdate({ analysis: analysisData });

    // 2. DELTA PASS
    onStage("delta");
    deltaData = buildDelta(analysisData);
    validateStage("delta", deltaData);
    validateTransition("analysis", "delta", analysisData, deltaData);
    onUpdate({ delta: deltaData });

    // 3. STATE CONSTRAINT PASS (Phase 7A)
    onStage("stateConstraints");
    const stateConstraints = buildStateConstraints(sceneIntent, characterStates);

    // 4. OLLAMA GENERATION PASS (DRAFT STAGE)
    onStage("ollama-generation");
    
    // Combine delta into instructions
    const voiceDirectives = (voiceSpec.style || []).join(", ") + ". " + (voiceSpec.constraints || []).join(", ");
    const deltaDirectives = deltaData.join(", ");
    
    let initialInstruction = `You are a fiction writing engine generating prose for a single scene.
Your output should be ONLY the scene prose — no meta-commentary, no scene headers, no labels.

## VOICE & STYLE DIRECTIVES
${voiceDirectives}

## REWRITE INSTRUCTIONS
${deltaDirectives}

## SCENE CONTEXT
${sceneContext}

## SCENE INTENT
Goal: ${sceneIntent.objective}
Conflict: ${sceneIntent.conflict}
Irreversible Change: ${sceneIntent.irreversible_change}
Stakes: ${sceneIntent.story_delta}
`;

    initialInstruction = injectStateConstraints(initialInstruction, stateConstraints);

    console.log(`[runPipeline Stateless] Calling Ollama model: ${model}...`);
    const ollamaRes = await callOllama(model, initialInstruction, { temperature: params.temperature !== undefined ? params.temperature : 0.8 });
    const draft1 = ollamaRes.ok ? ollamaRes.content : "";
    const safeDraft1 = draft1?.trim() ? draft1 : currentDraft;

    if (ollamaRes.ok) {
      logTokenUsage("ollama", estimateTokens(initialInstruction), estimateTokens(draft1));
      console.log(`[runPipeline Stateless] Ollama generation succeeded (length: ${draft1.length} chars).`);
      validateStage("ollama", safeDraft1);
      validateTransition("delta", "ollama", deltaData, safeDraft1);
    } else {
      throw new Error(`Ollama generation failed: ${ollamaRes.error}`);
    }

    currentDraft = safeDraft1;

    // 4. GALAXY STYLE REFINEMENT PASS (OpenAI)
    if (keys?.openai) {
      onStage("galaxy-refinement");
      console.log("[runPipeline Stateless] Calling Galaxy refinement...");
      const rewriteResult = await generateRewrite({
        original: currentDraft,
        instructions: [...(voiceSpec.style || []), ...deltaData],
        voiceSpec,
        sceneContext,
        sceneIntent,
        key: keys.openai,
        mode: "style-refinement",
        temperature: 0.75,
      });

      if (rewriteResult.ok && rewriteResult.text) {
        currentDraft = rewriteResult.text;
        console.log(`[runPipeline Stateless] Galaxy refinement succeeded (length: ${currentDraft.length} chars).`);
        if (rewriteResult.response?.usage) {
          logTokenUsage(
            "openai::gpt-4o-mini",
            rewriteResult.response.usage.prompt_tokens,
            rewriteResult.response.usage.completion_tokens
          );
        }
        validateStage("openai", currentDraft);
      } else {
        throw new Error(`Galaxy refinement failed: ${rewriteResult.error}`);
      }
    } else {
      console.warn("[runPipeline Stateless] Skipping Galaxy style refinement (missing OpenAI key).");
    }

    // 5. EVALUATION PASS (Structural + Friction)
    let finalVerdict = "APPROVE";
    let finalFailures = [];
    let frictionData = null;
    let heuristicData = null;
    let arbitrateResult = null;
    let critique = { verdict: "APPROVE", overallScore: 8, failures: [] };

    if (keys?.openai || keys?.gemini) {
      onStage("critic");
      console.log("[runPipeline Stateless] Running critique and friction passes...");
      const models = {
        generation: { provider: 'ollama', model },
        validation: { provider: 'openai', model: 'gpt-4o-mini' },
        critique: { provider: 'openai', model: 'gpt-4o-mini' }
      };
      const providers = new Providers(keys, models);
      
      // 5a. Run Heuristics Hard Detectors
      heuristicData = runHeuristics(currentDraft);

      // 5b. Run Structural Critique & Adversarial Friction in parallel
      const [rawCritique, rawFriction] = await Promise.all([
        critiqueScene(
          currentDraft,
          { sceneBeat: sceneIntent.objective, voiceProfile: voiceDirectives },
          providers
        ),
        evaluateFriction(
          currentDraft,
          heuristicData,
          providers
        )
      ]);

      // Parse structural critique failures
      const overallScore = rawCritique.overallScore || rawCritique.feedback?.overallScore || 0;
      const structVerdict = overallScore >= 6 ? "APPROVE" : "REWRITE";
      const structFailures = [];
      if (rawCritique.weaknesses && Array.isArray(rawCritique.weaknesses)) {
        rawCritique.weaknesses.forEach(w => structFailures.push({ type: "CRITIQUE_WEAKNESS", reason: w }));
      }
      if (rawCritique.feedback?.weaknesses && Array.isArray(rawCritique.feedback.weaknesses)) {
        rawCritique.feedback.weaknesses.forEach(w => structFailures.push({ type: "CRITIQUE_WEAKNESS", reason: w }));
      }
      critique = { verdict: structVerdict, overallScore, failures: structFailures, raw: rawCritique };
      frictionData = rawFriction;

      // 5c. ARBITRATION KERNEL
      onStage("arbitration");
      arbitrateResult = arbitrate(sceneIntent, critique, frictionData);
      
      // 5d. STATE & DELTA EVALUATION (Phase 7A)
      onStage("stateEvaluation");
      const extractedEvents = await extractEvents(currentDraft, sceneIntent.attendance || [], providers);
      const deltaEvaluation = evaluateDeltas(characterStates, stateConstraints.expectedManifolds, extractedEvents);

      finalVerdict = arbitrateResult.verdict;
      finalFailures = arbitrateResult.failures;
      
      if (deltaEvaluation.verdict === "REWRITE") {
        finalVerdict = "REWRITE";
        deltaEvaluation.failures.forEach(f => finalFailures.push(f));
      }
      
      // For legacy trace compatibility, override critique object with arbitration results
      critique.verdict = finalVerdict;
      critique.failures = finalFailures;
      
      console.log(`[runPipeline Stateless] Arbitration completed. Final Verdict: ${finalVerdict}`);
    }

    return {
      prose: safeDraft1,
      final: currentDraft,
      critique,
      analysis: analysisData,
      delta: deltaData,
      heuristics: heuristicData,
      friction: frictionData,
      arbitration: arbitrateResult,
      stateTransition: {
        extractedEvents: typeof extractedEvents !== 'undefined' ? extractedEvents : [],
        deltaEvaluation: typeof deltaEvaluation !== 'undefined' ? deltaEvaluation : null
      },
      attempts: 1,
      traces: [
        {
          attempt: 1,
          draft: currentDraft,
          critique
        }
      ]
    };

  } catch (error) {
    console.error(`[runPipeline Stateless] Pipeline exception:`, error);
    throw error;
  }
}
