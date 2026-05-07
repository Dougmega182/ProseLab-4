// src/llm/promptTemplates.js

export class PromptTemplates {
  static getSystemPrompt(options = {}) {
    const {
      customInstructions = '',
      projectContext = '',
      additionalInstructions = '',
    } = options;

    const parts = [
      'You are an expert creative writing assistant embedded in a novel-writing application called Quill.',
      'Your role is to help authors write, edit, and develop their fiction.',
      '',
      'Core principles:',
      '- Match the author\'s existing voice, style, and tone',
      '- Maintain consistency with established characters, plot, and world details',
      '- Produce prose that reads naturally and is publication-ready',
      '- Never break the fourth wall or reference yourself as an AI unless asked',
      '- Output ONLY the requested creative content unless analysis is requested',
      '- Do not wrap output in markdown code blocks unless specifically asked',
    ];

    if (additionalInstructions) {
      parts.push('', additionalInstructions);
    }

    if (customInstructions) {
      parts.push('', '## Author\'s Custom Instructions', customInstructions);
    }

    if (projectContext) {
      parts.push('', '---', '', projectContext);
    }

    return parts.join('\n');
  }

  static continueWriting(currentText, options = {}) {
    const {
      wordCount = 300,
      direction = '',
    } = options;

    const tail = currentText.length > 2000
      ? currentText.slice(-2000)
      : currentText;

    let prompt = `Continue the following text naturally. Write approximately ${wordCount} words. Maintain the same voice, style, tense, and point of view. Pick up exactly where the text leaves off — do not repeat any of the existing text.\n\n`;

    if (direction) {
      prompt += `Direction for the continuation: ${direction}\n\n`;
    }

    prompt += `Text to continue from:\n\n---\n${tail}\n---\n\nContinuation:`;

    return prompt;
  }

  static rewritePassage(selectedText, options = {}) {
    const {
      instruction = '',
      tone = '',
      style = '',
    } = options;

    let prompt = 'Rewrite the following passage';

    const modifiers = [];
    if (tone) modifiers.push(`in a ${tone} tone`);
    if (style) modifiers.push(`with a ${style} style`);
    if (modifiers.length > 0) prompt += ' ' + modifiers.join(' and ');

    prompt += '.\n\n';

    if (instruction) {
      prompt += `Specific instructions: ${instruction}\n\n`;
    }

    prompt += `Original passage:\n\n---\n${selectedText}\n---\n\nRewritten passage:`;

    return prompt;
  }

  static generateDialogue(options = {}) {
    const {
      characters = [],
      situation = '',
      mood = '',
      currentText = '',
      lineCount = 10,
    } = options;

    let prompt = `Write a dialogue scene with approximately ${lineCount} exchanges.\n\n`;

    if (characters.length > 0) {
      prompt += 'Characters involved:\n';
      for (const char of characters) {
        if (typeof char === 'string') {
          prompt += `- ${char}\n`;
        } else {
          prompt += `- ${char.name}`;
          if (char.personality) prompt += ` (${char.personality})`;
          if (char.speechPattern) prompt += ` — speaks: ${char.speechPattern}`;
          prompt += '\n';
        }
      }
      prompt += '\n';
    }

    if (situation) prompt += `Situation: ${situation}\n`;
    if (mood) prompt += `Mood: ${mood}\n`;

    if (currentText) {
      const tail = currentText.slice(-800);
      prompt += `\nPreceding text for context:\n---\n${tail}\n---\n`;
    }

    prompt += '\nWrite the dialogue with natural speech patterns, action beats, and subtext. Each character should have a distinct voice.\n\nDialogue:';

    return prompt;
  }

  static describeSetting(options = {}) {
    const {
      location = '',
      timeOfDay = '',
      weather = '',
      mood = '',
      senses = ['sight', 'sound', 'smell'],
      wordCount = 150,
    } = options;

    let prompt = `Write a vivid setting description of approximately ${wordCount} words.\n\n`;

    if (location) prompt += `Location: ${location}\n`;
    if (timeOfDay) prompt += `Time of day: ${timeOfDay}\n`;
    if (weather) prompt += `Weather: ${weather}\n`;
    if (mood) prompt += `Mood/atmosphere: ${mood}\n`;

    if (senses.length > 0) {
      prompt += `Engage these senses: ${senses.join(', ')}\n`; }

    prompt += '\nWrite immersive, show-don\'t-tell prose that grounds the reader in the scene. Avoid clichés.\n\nDescription:';

    return prompt;
  }

  static brainstorm(options = {}) {
    const {
      topic = '',
      type = 'ideas',
      count = 5,
      constraints = '',
    } = options;

    const typeLabels = {
      ideas: 'creative ideas',
      'plot-twists': 'plot twists',
      'character-arcs': 'character arc possibilities',
      conflicts: 'sources of conflict',
      themes: 'thematic explorations',
      'scene-ideas': 'scene ideas',
      names: 'character or place names',
    };

    const label = typeLabels[type] || type;

    let prompt = `Brainstorm ${count} ${label}`;
    if (topic) prompt += ` related to: ${topic}`;
    prompt += '.\n\n';

    if (constraints) {
      prompt += `Constraints/considerations: ${constraints}\n\n`;
    }

    prompt += `For each item, provide a brief title and a 1-2 sentence description. Be creative and unexpected — avoid obvious or clichéd suggestions.\n\nIdeas:`;

    return prompt;
  }

  static analyzeText(text, options = {}) {
    const { focus = 'general' } = options;

    const focusInstructions = {
      general: 'Analyze the following text for strengths, weaknesses, pacing, voice, and areas for improvement.',
      pacing: 'Analyze the pacing of the following text. Identify where it moves too quickly, too slowly, or where the rhythm works well.',
      dialogue: 'Analyze the dialogue in the following text. Evaluate naturalness, character voice distinction, subtext, and balance with narrative.',
      tension: 'Analyze the tension and conflict in the following text. Identify where tension builds effectively and where it falls flat.',
      prose: 'Analyze the prose quality of the following text. Evaluate sentence variety, word choice, imagery, and clarity.',
      'show-tell': 'Analyze the following text for show vs. tell balance. Identify passages that could benefit from more showing.',
      voice: 'Analyze the narrative voice in the following text. Evaluate consistency, distinctiveness, and appropriateness for the genre.',
    };

    const instruction = focusInstructions[focus] || focusInstructions.general;

    return `${instruction}\n\nProvide specific, actionable feedback with examples from the text. Be constructive but honest.\n\n---\n${text}\n---\n\nAnalysis:`;
  }

  static fixConsistency(text, options = {}) {
    const {
      characters = [],
      knownFacts = [],
    } = options;

    let prompt = 'Review the following text for consistency issues. Check for:\n';
    prompt += '- Character name spelling and attribute consistency\n';
    prompt += '- Timeline and chronological errors\n';
    prompt += '- Setting detail contradictions\n';
    prompt += '- Point of view shifts\n';
    prompt += '- Tense consistency\n';
    prompt += '- Factual contradictions within the text\n\n';

    if (characters.length > 0) {
      prompt += 'Known characters for reference:\n';
      for (const char of characters) {
        const name = typeof char === 'string' ? char : char.name;
        const details = typeof char === 'string' ? '' : ` — ${char.description || ''}`;
        prompt += `- ${name}${details}\n`;
      }
      prompt += '\n';
    }

    if (knownFacts.length > 0) {
      prompt += 'Established facts:\n';
      for (const fact of knownFacts) {
        prompt += `- ${fact}\n`;
      }
      prompt += '\n';
    }

    prompt += `Text to review:\n\n---\n${text}\n---\n\nList any consistency issues found, with line references where possible. If no issues are found, say so.\n\nConsistency Report:`;

    return prompt;
  }

  static summarizeScene(text) {
    return `Summarize the following scene in 2-3 concise sentences. Capture the key events, character actions, and any important revelations or emotional shifts.\n\n---\n${text}\n---\n\nSummary:`;
  }

  static outlineChapter(options = {}) {
    const {
      chapterNumber = 1,
      plotPoints = [],
      characters = [],
      previousSummary = '',
      sceneCount = 3,
    } = options;

    let prompt = `Create a detailed outline for Chapter ${chapterNumber} with approximately ${sceneCount} scenes.\n\n`;

    if (previousSummary) {
      prompt += `What happened previously: ${previousSummary}\n\n`;
    }

    if (plotPoints.length > 0) {
      prompt += 'Plot points to address in this chapter:\n';
      for (const point of plotPoints) {
        prompt += `- ${point}\n`;
      }
      prompt += '\n';
    }

    if (characters.length > 0) {
      prompt += 'Characters in this chapter:\n';
      for (const char of characters) {
        const name = typeof char === 'string' ? char : char.name;
        prompt += `- ${name}\n`;
      }
      prompt += '\n';
    }

    prompt += 'For each scene, provide:\n';
    prompt += '1. Scene heading/location\n';
    prompt += '2. Characters present\n';
    prompt += '3. Key events and actions\n';
    prompt += '4. Emotional arc\n';
    prompt += '5. How it connects to the next scene\n\n';
    prompt += 'Chapter Outline:';

    return prompt;
  }

static transitionScene(options = {}) {
    const {
      fromScene = '',
      toScene = '',
      type = 'smooth',
      currentText = '',
    } = options;

    const typeInstructions = {
      smooth: 'Write a smooth, seamless transition',
      'time-jump': 'Write a transition that conveys a passage of time',
      'scene-break': 'Write a brief transitional passage suitable for after a scene break',
      contrast: 'Write a transition that contrasts the previous scene with what comes next',
      cliffhanger: 'End the current scene on a cliffhanger note that leads into the next',
    };

    const instruction = typeInstructions[type] || typeInstructions.smooth;

    let prompt = `${instruction} between two scenes.\n\n`;

    if (fromScene) prompt += `Ending scene: ${fromScene}\n`;
    if (toScene) prompt += `Beginning scene: ${toScene}\n`;

    if (currentText) {
      const tail = currentText.slice(-600);
      prompt += `\nCurrent text ending:\n---\n${tail}\n---\n`;
    }

    prompt += '\nWrite 2-4 paragraphs that bridge these scenes naturally.\n\nTransition:';

    return prompt;
  }

  static characterVoice(options = {}) {
    const {
      character = {},
      situation = '',
      internalMonologue = false,
      wordCount = 200,
    } = options;

    let prompt = '';

    if (internalMonologue) {
      prompt += `Write an internal monologue of approximately ${wordCount} words `;
    } else {
      prompt += `Write a passage of approximately ${wordCount} words `;
    }

    prompt += `from the perspective of ${character.name || 'this character'}.\n\n`;

    if (character.name) prompt += `Character: ${character.name}\n`;
    if (character.personality) prompt += `Personality: ${character.personality}\n`;
    if (character.speechPattern) prompt += `Speech/thought pattern: ${character.speechPattern}\n`;
    if (character.motivation) prompt += `Current motivation: ${character.motivation}\n`;
    if (character.backstory) prompt += `Relevant backstory: ${character.backstory}\n`;

    if (situation) prompt += `\nSituation: ${situation}\n`;

    if (internalMonologue) {
      prompt += '\nCapture their unique thought patterns, fears, desires, and internal contradictions. Make the voice unmistakably theirs.\n';
    } else {
      prompt += '\nCapture their unique voice and mannerisms. The reader should be able to identify this character without being told who it is.\n';
    }

    prompt += '\nPassage:';

    return prompt;
  }
}
