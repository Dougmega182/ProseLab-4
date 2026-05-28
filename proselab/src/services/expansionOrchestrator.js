import { describeInsertionAnchors, generateExpansionInsertionDraft } from "../engine/expansionWriter.js";
import { callOpenAI } from "./llm.js";

/**
 * Extracts the first JSON object from a string.
 */
function extractFirstJsonObject(raw) {
  const source = String(raw || "").replace(/```json|```/gi, "").trim();
  const first = source.indexOf("{");
  const last = source.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    throw new Error("Model did not return a JSON object.");
  }
  return JSON.parse(source.slice(first, last + 1));
}

/**
 * Summarizes paragraphs to build a concise mapping for placement LLM suggestions.
 */
function summarizeParagraphsForPlacement(sourceText, maxParagraphs = 120) {
  const paragraphs = String(sourceText || "")
    .split(/\n\s*\n/g)
    .map((p) => p.trim())
    .filter(Boolean);
  const capped = paragraphs.slice(0, maxParagraphs);
  const map = capped
    .map((p, idx) => `${idx + 1}: ${p.replace(/\s+/g, " ").slice(0, 260)}`)
    .join("\n");
  return {
    paragraphCount: paragraphs.length,
    providedCount: capped.length,
    map,
  };
}

/**
 * Generates insertion paragraph suggestions based on the expansion brief.
 */
export async function recommendExpansionInsertion({
  activeScene,
  sourceText,
  expansionBrief,
  openaiKey,
  onStage = () => {},
}) {
  onStage("expansion-insertion-recommend");

  if (!activeScene || !sourceText.trim()) {
    throw new Error("Select a scene with manuscript text before requesting insertion placement.");
  }

  const briefStr = (expansionBrief || "").trim();
  if (!briefStr) {
    throw new Error("Paste expansion instructions into the Expansion Brief field first.");
  }

  const { paragraphCount, providedCount, map } = summarizeParagraphsForPlacement(sourceText);
  if (!map.trim()) {
    throw new Error("No paragraph map available for insertion recommendation.");
  }

  const placementPrompt = `You are selecting insertion boundaries for a manuscript expansion.

Return only strict JSON with this schema:
{
  "startParagraph": number,
  "endParagraph": number,
  "reasoning": string
}

Rules:
- Choose paragraph numbers between 1 and ${providedCount}.
- startParagraph must be less than or equal to endParagraph.
- reasoning must be concise and reference scene continuity.
- No markdown. No prose outside JSON.

Scene title: ${activeScene.title || "Untitled Scene"}
Total paragraphs in scene: ${paragraphCount}
Paragraph map provided: 1..${providedCount}

Expansion brief:
${briefStr}

Paragraph map:
${map}`;

  const res = await callOpenAI(openaiKey, placementPrompt, {
    temperature: 0.2,
    timeout: 120000,
    pollInterval: 1200,
  });

  if (!res?.ok) {
    throw new Error(res?.error || "Insertion recommendation failed.");
  }

  const parsed = extractFirstJsonObject(res.content);
  const rawStart = Number(parsed?.startParagraph);
  const rawEnd = Number(parsed?.endParagraph);
  const boundedStart = Math.max(1, Math.min(providedCount, Number.isFinite(rawStart) ? rawStart : 1));
  const boundedEnd = Math.max(boundedStart, Math.min(providedCount, Number.isFinite(rawEnd) ? rawEnd : boundedStart));
  const reasoning = String(parsed?.reasoning || "").trim() || "Placement suggested by Galaxy AI.";

  const boundary = describeInsertionAnchors(sourceText, boundedStart, boundedEnd);

  return {
    startParagraph: boundedStart,
    endParagraph: boundedEnd,
    boundary,
    reasoning,
  };
}

/**
 * Runs the full multi-pass expansion insertion draft generation process.
 */
export async function runExpansionInsertionDraft({
  activeScene,
  sourceText,
  expansionBrief,
  openaiKey,
  selectedProjectId,
  draftTree = [],
  createChapter,
  createScene,
  saveDocument,
  updateSceneText,
  updateSceneMetadata,
  logTokenUsage,
  estimateTokens,
  onStage = () => {},
  onChunk = async () => {},
  onComplete = () => {},
  onError = () => {},
}) {
  onStage("expansion-insertion-recommend");

  if (!activeScene || !sourceText.trim()) {
    onError(new Error("Select a scene with manuscript text before generating an expansion draft."));
    return;
  }

  const briefStr = (expansionBrief || "").trim();
  if (!briefStr) {
    onError(new Error("Paste expansion instructions into the Expansion Brief field first."));
    return;
  }

  const expansionRunId = crypto.randomUUID();
  let draftScene = null;

  try {
    // 1. Get recommendation
    const placement = await recommendExpansionInsertion({
      activeScene,
      sourceText,
      expansionBrief: briefStr,
      openaiKey,
      onStage,
    });

    const startParagraph = placement.startParagraph;
    const endParagraph = placement.endParagraph;
    const initialBoundary = placement.boundary;

    onStage("expansion-insertion-init");

    // 2. Setup drafts chapter and scene
    let targetChapterId = draftTree?.find((c) => c.title === "Editorial Drafts")?.id;
    if (!targetChapterId) {
      const newChap = await createChapter({ title: "Editorial Drafts", isDraft: true });
      targetChapterId = newChap.id;
    }

    draftScene = await createScene({
      chapterId: targetChapterId,
      title: `Expansion Draft: ${activeScene.title || "Scene"} | p${startParagraph}-p${endParagraph}`,
      text: `Expansion run: ${expansionRunId}\nStatus: starting`,
      isDraft: true,
      sourceSceneId: activeScene.id,
      expansionRunId,
    });

    await saveDocument({
      projectId: selectedProjectId,
      type: "expansion_log",
      domain: "expansion",
      subdomain: "insertion",
      title: `Expansion start ${activeScene.title || "Scene"}`,
      content: JSON.stringify({
        expansionRunId,
        sourceSceneId: activeScene.id,
        startParagraph,
        endParagraph,
        at: Date.now(),
      }),
    });

    // 3. Generate content with multi-pass polling
    const result = await generateExpansionInsertionDraft({
      key: openaiKey,
      llmCaller: callOpenAI,
      chapterTitle: activeScene.title || "Untitled Scene",
      sourceText,
      expansionBrief: briefStr,
      startParagraph,
      endParagraph,
      onStage,
      onChunk: async ({ pass, combined, hasEndMarker, wordCount }) => {
        const label = `Insertion start: before paragraph ${initialBoundary.start.paragraph} (line ${initialBoundary.start.line}) | Insertion end: before paragraph ${initialBoundary.end.paragraph} (line ${initialBoundary.end.line})`;
        const header = `Chapter: ${activeScene.title || "Untitled Scene"}\n${label}\nRun: ${expansionRunId}\nCheckpoint: pass ${pass}`;
        const composedDraft = `${header}\n\n${combined}`;

        if (draftScene?.id) {
          await updateSceneText(draftScene.id, composedDraft);
          await updateSceneMetadata(draftScene.id, {
            expansionCheckpoint: { pass, wordCount, hasEndMarker, updatedAt: Date.now() },
          });
        }

        await saveDocument({
          projectId: selectedProjectId,
          type: "expansion_log",
          domain: "expansion",
          subdomain: "checkpoint",
          title: `Expansion checkpoint pass ${pass}`,
          content: JSON.stringify({ expansionRunId, pass, wordCount, hasEndMarker, at: Date.now() }),
        });

        logTokenUsage("galaxy", estimateTokens(briefStr), estimateTokens(combined));
        await onChunk({ pass, composedDraft });
      },
    });

    if (!result.ok) {
      throw new Error(result.error || "Expansion generation failed.");
    }

    // 4. Update scene with final output
    const boundary = result.anchor;
    const finalLabel = `Chapter: ${activeScene.title || "Untitled Scene"}\nInsertion start: before paragraph ${boundary.start.paragraph} (line ${boundary.start.line})\nInsertion end: before paragraph ${boundary.end.paragraph} (line ${boundary.end.line})\nRun: ${expansionRunId}\nPasses: ${result.passes}\nWords: ${result.wordCount}`;
    const finalText = `${finalLabel}\n\n${result.text}`;

    if (draftScene?.id) {
      await updateSceneText(draftScene.id, finalText);
      await updateSceneMetadata(draftScene.id, {
        title: `Expansion Draft: ${activeScene.title || "Scene"} | p${boundary.start.paragraph}-p${boundary.end.paragraph}`,
        expansionResult: {
          expansionRunId,
          passes: result.passes,
          words: result.wordCount,
          completedAt: Date.now(),
        },
      });
    }

    await saveDocument({
      projectId: selectedProjectId,
      type: "expansion_log",
      domain: "expansion",
      subdomain: "complete",
      title: `Expansion complete ${activeScene.title || "Scene"}`,
      content: JSON.stringify({
        expansionRunId,
        passes: result.passes,
        words: result.wordCount,
        boundary,
        at: Date.now(),
      }),
    });

    onComplete({ finalText, placement });
  } catch (e) {
    await saveDocument({
      projectId: selectedProjectId,
      type: "expansion_log",
      domain: "expansion",
      subdomain: "error",
      title: `Expansion error ${activeScene.title || "Scene"}`,
      content: JSON.stringify({ expansionRunId, error: e.message, at: Date.now() }),
    });
    onError(e);
  }
}
