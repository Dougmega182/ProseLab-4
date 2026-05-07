// src/services/importService.js

export const CATEGORY_LABELS = {
  manuscript: '📖 Manuscript',
  characters: '👤 Characters',
  worldbuilding: '🌍 World Rules',
  worldRules: '🌍 World Rules', // compatibility
  beats: '🗺️ Beat Map',
  beatMap: '🗺️ Beat Map', // compatibility
  notes: '📝 Notes',
  skip: '⏭️ Skip'
};

/**
 * Reads a browser File object as text
 */
export async function readFileContent(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(new Error(`Failed to read ${file.name}: ${e.target.error}`));
    reader.readAsText(file);
  });
}

/**
 * Main entry point for reading multiple files and auto-classifying them
 */
export async function readFiles(files) {
  const results = [];
  for (const file of Array.from(files)) {
    try {
      const content = await readFileContent(file);
      const category = autoClassify(file.name, content);
      results.push({
        id: generateId(),
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || inferType(file.name),
        content,
        category,
        status: 'pending',
      });
    } catch (err) {
      results.push({
        id: generateId(),
        fileName: file.name,
        fileSize: file.size,
        fileType: inferType(file.name),
        content: null,
        category: 'notes',
        status: 'error',
        error: err.message,
      });
    }
  }
  return results;
}

/**
 * Legacy alias for orchestrator compatibility
 */
export async function parseMultipleFiles(files) {
  return await readFiles(files);
}

function inferType(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  const map = {
    md: 'text/markdown',
    txt: 'text/plain',
    json: 'application/json',
    csv: 'text/csv',
    rtf: 'application/rtf',
    html: 'text/html',
    htm: 'text/html',
  };
  return map[ext] || 'text/plain';
}

export function autoClassify(fileName, content) {
  const name = fileName.toLowerCase();
  const text = (content || '').toLowerCase();

  // Filename-based heuristics
  if (name.match(/chapter|manuscript|draft|scene|prose/)) return 'manuscript';
  if (name.match(/character|cast|persona|dramatis/)) return 'characters';
  if (name.match(/world|setting|magic|lore|geography|history|rule/)) return 'worldbuilding';
  if (name.match(/beat|outline|plot|structure|arc|synopsis/)) return 'beats';

  // Content-based heuristics
  const chapterMatches = (text.match(/chapter\s+\d/g) || []).length;
  if (chapterMatches >= 2) return 'manuscript';

  const characterKeywords = ['personality', 'appearance', 'backstory', 'motivation', 'traits', 'age:', 'role:'];
  const charScore = characterKeywords.filter(k => text.includes(k)).length;
  if (charScore >= 2) return 'characters';

  const worldKeywords = ['magic system', 'geography', 'history', 'culture', 'technology', 'rules:', 'laws:'];
  const worldScore = worldKeywords.filter(k => text.includes(k)).length;
  if (worldScore >= 2) return 'worldbuilding';

  const beatKeywords = ['act 1', 'act 2', 'act 3', 'inciting incident', 'climax', 'resolution', 'midpoint'];
  const beatScore = beatKeywords.filter(k => text.includes(k)).length;
  if (beatScore >= 2) return 'beats';

  // Check if it looks like prose (long paragraphs, dialogue)
  const dialogueCount = (text.match(/[""][^""]+[""]/g) || []).length;
  const avgParagraphLength = text.split(/\n{2,}/).reduce((sum, p) => sum + p.length, 0) / Math.max(1, text.split(/\n{2,}/).length);
  if (dialogueCount > 5 || avgParagraphLength > 300) return 'manuscript';

  // Default
  return 'notes';
}

export function detectConflicts(importItems, projectData) {
  const conflicts = [];

  for (const item of importItems) {
    if (item.status === 'error') continue;

    switch (item.category) {
      case 'manuscript': {
        const chapters = parseChaptersFromContent(item.content);
        for (const chapter of chapters) {
          const existing = (projectData.chapters || []).find(
            ch => ch.title && ch.title.toLowerCase().trim() === chapter.title.toLowerCase().trim()
          );
          if (existing) {
            conflicts.push({
              id: `chapter:${existing.id}`,
              type: 'chapter',
              itemId: item.id,
              existingTitle: existing.title,
              existingPreview: existing.content?.slice(0, 200) || '',
              incomingPreview: chapter.content?.slice(0, 200) || '',
              resolution: null,
            });
          }
        }
        break;
      }
      case 'characters': {
        const characters = parseCharactersFromContent(item.content);
        for (const character of characters) {
          const existing = (projectData.characters || []).find(
            c => c.name && c.name.toLowerCase().trim() === character.name.toLowerCase().trim()
          );
          if (existing) {
            conflicts.push({
              id: `character:${existing.id}`,
              type: 'character',
              itemId: item.id,
              existingTitle: existing.name,
              existingPreview: existing.description?.slice(0, 200) || '',
              incomingPreview: character.description?.slice(0, 200) || '',
              resolution: null,
            });
          }
        }
        break;
      }
      case 'worldbuilding':
      case 'worldRules': {
        const rules = parseWorldRulesFromContent(item.content);
        for (const rule of rules) {
          const existing = (projectData.worldRules || []).find(
            r => r.title && r.title.toLowerCase().trim() === rule.title.toLowerCase().trim()
          );
          if (existing) {
            conflicts.push({
              id: `rule:${existing.id}`,
              type: 'worldRule',
              itemId: item.id,
              existingTitle: existing.title,
              existingPreview: existing.content?.slice(0, 200) || '',
              incomingPreview: rule.content?.slice(0, 200) || '',
              resolution: null,
            });
          }
        }
        break;
      }
    }
  }

  return conflicts;
}

// ─── Application Logic ──────────────────────────────────────────

export async function applyImport(projectData, importPlan, conflictResolutions) {
  const changelog = [];
  const warnings = [];
  const summary = {
    chaptersAdded: 0,
    chaptersUpdated: 0,
    charactersAdded: 0,
    charactersUpdated: 0,
    rulesAdded: 0,
    beatsAdded: 0,
    notesAdded: 0,
  };

  // Deep clone project data to avoid mutations
  const updatedProject = JSON.parse(JSON.stringify(projectData));

  for (const item of importPlan) {
    if (item.category === 'skip') continue;
    
    try {
      switch (item.category) {
        case 'manuscript':
          applyManuscriptImport(updatedProject, item, conflictResolutions, changelog, warnings, summary);
          break;
        case 'characters':
          applyCharacterImport(updatedProject, item, conflictResolutions, changelog, warnings, summary);
          break;
        case 'worldbuilding':
        case 'worldRules':
          applyWorldbuildingImport(updatedProject, item, conflictResolutions, changelog, warnings, summary);
          break;
        case 'beats':
        case 'beatMap':
          applyBeatsImport(updatedProject, item, conflictResolutions, changelog, warnings, summary);
          break;
        case 'notes':
          applyNotesImport(updatedProject, item, changelog, summary);
          break;
        default:
          warnings.push(`Skipped file "${item.fileName}" with unknown category "${item.category}"`);
      }
    } catch (err) {
      warnings.push(`Error processing "${item.fileName}": ${err.message}`);
    }
  }

  return { updatedProject, changelog, warnings, summary };
}

function applyManuscriptImport(project, item, resolutions, changelog, warnings, summary) {
  if (!project.chapters) project.chapters = [];

  const chapters = parseChaptersFromContent(item.content);

  if (chapters.length === 0) {
    // Treat entire content as a single chapter
    const newChapter = {
      id: generateId(),
      title: item.fileName.replace(/\.[^.]+$/, ''),
      content: item.content,
      order: project.chapters.length,
      importedAt: new Date().toISOString(),
    };
    project.chapters.push(newChapter);
    summary.chaptersAdded++;
    changelog.push({ action: 'Added', type: 'Chapter', detail: newChapter.title });
    return;
  }

  for (const chapter of chapters) {
    const existing = project.chapters.find(
      ch => ch.title && ch.title.toLowerCase().trim() === chapter.title.toLowerCase().trim()
    );

    if (existing) {
      const resolutionKey = `chapter:${existing.id}`;
      const resolution = resolutions[resolutionKey] || 'skip';

      if (resolution === 'keep-existing' || resolution === 'skip') {
        changelog.push({ action: 'Skipped', type: 'Chapter', detail: existing.title });
      } else if (resolution === 'use-incoming' || resolution === 'replace') {
        existing.content = chapter.content;
        existing.updatedAt = new Date().toISOString();
        summary.chaptersUpdated++;
        changelog.push({ action: 'Updated', type: 'Chapter', detail: existing.title });
      } else if (resolution === 'merge') {
        existing.content = existing.content + '\n\n---\n\n' + chapter.content;
        existing.updatedAt = new Date().toISOString();
        summary.chaptersUpdated++;
        changelog.push({ action: 'Merged', type: 'Chapter', detail: existing.title });
      }
    } else {
      const newChapter = {
        id: generateId(),
        title: chapter.title,
        content: chapter.content,
        order: project.chapters.length,
        importedAt: new Date().toISOString(),
      };
      project.chapters.push(newChapter);
      summary.chaptersAdded++;
      changelog.push({ action: 'Added', type: 'Chapter', detail: newChapter.title });
    }
  }
}

function applyCharacterImport(project, item, resolutions, changelog, warnings, summary) {
  if (!project.characters) project.characters = [];

  const characters = parseCharactersFromContent(item.content);

  for (const character of characters) {
    const name = character.name || 'Unknown Character';
    const existing = project.characters.find(
      c => c.name && c.name.toLowerCase().trim() === name.toLowerCase().trim()
    );

    if (existing) {
      const resolutionKey = `character:${existing.id}`;
      const resolution = resolutions[resolutionKey] || 'skip';

      if (resolution === 'keep-existing' || resolution === 'skip') {
        changelog.push({ action: 'Skipped', type: 'Character', detail: existing.name });
      } else if (resolution === 'use-incoming' || resolution === 'replace') {
        Object.assign(existing, character, { id: existing.id, updatedAt: new Date().toISOString() });
        summary.charactersUpdated++;
        changelog.push({ action: 'Updated', type: 'Character', detail: existing.name });
      } else if (resolution === 'merge') {
        // Merge: keep existing fields, add new ones from incoming
        for (const [key, value] of Object.entries(character)) {
          if (key === 'name' || key === 'id') continue;
          if (!existing[key] || existing[key] === '') {
            existing[key] = value;
          } else if (Array.isArray(existing[key]) && Array.isArray(value)) {
            const merged = [...new Set([...existing[key], ...value])];
            existing[key] = merged;
          }
        }
        existing.updatedAt = new Date().toISOString();
        summary.charactersUpdated++;
        changelog.push({ action: 'Merged', type: 'Character', detail: existing.name });
      }
    } else {
      const newChar = {
        id: generateId(),
        ...character,
        importedAt: new Date().toISOString(),
      };
      project.characters.push(newChar);
      summary.charactersAdded++;
      changelog.push({ action: 'Added', type: 'Character', detail: newChar.name });
    }
  }
}

function applyWorldbuildingImport(project, item, resolutions, changelog, warnings, summary) {
  if (!project.worldRules) project.worldRules = [];

  const rules = parseWorldRulesFromContent(item.content);

  for (const rule of rules) {
    const existing = project.worldRules.find(
      r => r.title && r.title.toLowerCase().trim() === rule.title.toLowerCase().trim()
    );

    if (existing) {
      const resolutionKey = `rule:${existing.id}`;
      const resolution = resolutions[resolutionKey] || 'skip';

      if (resolution === 'keep-existing' || resolution === 'skip') {
        changelog.push({ action: 'Skipped', type: 'World Rule', detail: existing.title });
      } else if (resolution === 'use-incoming' || resolution === 'replace') {
        existing.content = rule.content;
        existing.updatedAt = new Date().toISOString();
        summary.rulesAdded++;
        changelog.push({ action: 'Updated', type: 'World Rule', detail: existing.title });
      } else if (resolution === 'merge') {
        existing.content = existing.content + '\n\n' + rule.content;
        existing.updatedAt = new Date().toISOString();
        summary.rulesAdded++;
        changelog.push({ action: 'Merged', type: 'World Rule', detail: existing.title });
      }
    } else {
      const newRule = {
        id: generateId(),
        ...rule,
        importedAt: new Date().toISOString(),
      };
      project.worldRules.push(newRule);
      summary.rulesAdded++;
      changelog.push({ action: 'Added', type: 'World Rule', detail: newRule.title });
    }
  }
}

function applyBeatsImport(project, item, resolutions, changelog, warnings, summary) {
  if (!project.beats) project.beats = [];

  const beats = parseBeatsFromContent(item.content);

  for (const beat of beats) {
    const newBeat = {
      id: generateId(),
      ...beat,
      importedAt: new Date().toISOString(),
    };
    project.beats.push(newBeat);
    summary.beatsAdded++;
    changelog.push({ action: 'Added', type: 'Beat', detail: newBeat.title || newBeat.description?.slice(0, 50) });
  }
}

function applyNotesImport(project, item, changelog, summary) {
  if (!project.notes) project.notes = [];

  const newNote = {
    id: generateId(),
    title: item.fileName.replace(/\.[^.]+$/, ''),
    content: item.content,
    importedAt: new Date().toISOString(),
  };
  project.notes.push(newNote);
  summary.notesAdded++;
  changelog.push({ action: 'Added', type: 'Note', detail: newNote.title });
}

// ─── Content Parsers ─────────────────────────────────────────────

export function parseChaptersFromContent(content) {
  const chapters = [];
  // Try to split by chapter headings: "Chapter X", "# Chapter X", "## Chapter X"
  const chapterPattern = /(?:^|\n)(?:#{1,3}\s+)?(?:Chapter\s+\d+[:\s]*)(.*?)(?=(?:\n(?:#{1,3}\s+)?Chapter\s+\d+)|$)/gis;
  
  let match;
  while ((match = chapterPattern.exec(content)) !== null) {
    const titleLine = match[0].trim().split('\n')[0].replace(/^#{1,3}\s+/, '').trim();
    const body = match[0].trim().split('\n').slice(1).join('\n').trim();
    chapters.push({
      title: titleLine,
      content: body,
    });
  }

  // If no chapter markers found, try splitting by markdown headings
  if (chapters.length === 0) {
    const headingPattern = /(?:^|\n)#{1,2}\s+(.+)/g;
    const headings = [];
    let m;
    while ((m = headingPattern.exec(content)) !== null) {
      headings.push({ title: m[1].trim(), index: m.index });
    }

    if (headings.length > 1) {
      for (let i = 0; i < headings.length; i++) {
        const start = headings[i].index;
        const end = i < headings.length - 1 ? headings[i + 1].index : content.length;
        const section = content.slice(start, end).trim();
        const lines = section.split('\n');
        chapters.push({
          title: headings[i].title,
          content: lines.slice(1).join('\n').trim(),
        });
      }
    }
  }

  return chapters;
}

export function parseCharactersFromContent(content) {
  const characters = [];
  
  // Try structured format: "Name: ...\nDescription: ...\nTraits: ..."
  const blocks = content.split(/\n{2,}/);
  
  let currentChar = null;
  
  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    // Check if block starts with a heading (character name)
    const headingMatch = trimmed.match(/^#{1,3}\s+(.+)/);
    if (headingMatch) {
      if (currentChar) characters.push(currentChar);
      currentChar = { name: headingMatch[1].trim(), description: '', traits: [] };
      const rest = trimmed.split('\n').slice(1).join('\n').trim();
      if (rest) {
        parseCharacterFields(rest, currentChar);
      }
      continue;
    }

    // Check for "Name:" pattern
    const nameMatch = trimmed.match(/^(?:Name|Character)\s*:\s*(.+)/im);
    if (nameMatch) {
      if (currentChar) characters.push(currentChar);
      currentChar = { name: nameMatch[1].trim(), description: '', traits: [] };
      parseCharacterFields(trimmed, currentChar);
      continue;
    }

    // If we have a current character, append to description
    if (currentChar) {
      parseCharacterFields(trimmed, currentChar);
    }
  }

  if (currentChar) characters.push(currentChar);

  // If no structured characters found, treat entire content as one character note
  if (characters.length === 0 && content.trim().length > 0) {
    characters.push({
      name: 'Imported Character',
      description: content.trim(),
      traits: [],
    });
  }

  return characters;
}

function parseCharacterFields(text, character) {
  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const descMatch = trimmed.match(/^(?:Description|Bio|Background)\s*:\s*(.+)/i);
    if (descMatch) {
      character.description = (character.description ? character.description + ' ' : '') + descMatch[1].trim();
      continue;
    }

    const traitMatch = trimmed.match(/^(?:Traits?|Attributes?|Qualities)\s*:\s*(.+)/i);
    if (traitMatch) {
      const traits = traitMatch[1].split(/[,;]/).map(t => t.trim()).filter(Boolean);
      character.traits = [...(character.traits || []), ...traits];
      continue;
    }

    const roleMatch = trimmed.match(/^(?:Role|Archetype|Type)\s*:\s*(.+)/i);
    if (roleMatch) {
      character.role = roleMatch[1].trim();
      continue;
    }

    const ageMatch = trimmed.match(/^(?:Age)\s*:\s*(.+)/i);
    if (ageMatch) {
      character.age = ageMatch[1].trim();
      continue;
    }

    // Skip name lines we already captured
    if (trimmed.match(/^(?:Name|Character)\s*:/i)) continue;

    // Append to description
    if (!character.description) {
      character.description = trimmed;
    } else {
      character.description += ' ' + trimmed;
    }
  }
}

export function parseWorldRulesFromContent(content) {
  const rules = [];
  
  // Split by markdown headings
  const parts = content.split(/(?=^#{1,3}\s+)/m);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const headingMatch = trimmed.match(/^#{1,3}\s+(.+)/);
    if (headingMatch) {
      const title = headingMatch[1].trim();
      const body = trimmed.split('\n').slice(1).join('\n').trim();
      rules.push({ title, content: body });
    } else if (rules.length === 0) {
      // No heading found, treat entire content as one rule
      rules.push({
        title: 'Imported World Rule',
        content: trimmed,
      });
    }
  }

  if (rules.length === 0 && content.trim()) {
    rules.push({
      title: 'Imported World Rule',
      content: content.trim(),
    });
  }

  return rules;
}

export function parseBeatsFromContent(content) {
  const beats = [];

  // Try numbered list: "1. Beat description"
  const numberedPattern = /^\d+[\.\)]\s+(.+)/gm;
  let match;
  while ((match = numberedPattern.exec(content)) !== null) {
    beats.push({
      title: match[1].trim().slice(0, 80),
      description: match[1].trim(),
    });
  }

  if (beats.length > 0) return beats;

  // Try bullet list: "- Beat description" or "* Beat description"
  const bulletPattern = /^[\-\*•]\s+(.+)/gm;
  while ((match = bulletPattern.exec(content)) !== null) {
    beats.push({
      title: match[1].trim().slice(0, 80),
      description: match[1].trim(),
    });
  }

  if (beats.length > 0) return beats;

  // Try heading-based sections
  const parts = content.split(/(?=^#{1,3}\s+)/m);
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const headingMatch = trimmed.match(/^#{1,3}\s+(.+)/);
    if (headingMatch) {
      const body = trimmed.split('\n').slice(1).join('\n').trim();
      beats.push({
        title: headingMatch[1].trim(),
        description: body,
      });
    }
  }

  if (beats.length === 0 && content.trim()) {
    // Treat each paragraph as a beat
    const paragraphs = content.split(/\n{2,}/).filter(p => p.trim());
    for (const para of paragraphs) {
      beats.push({
        title: para.trim().slice(0, 80),
        description: para.trim(),
      });
    }
  }

  return beats;
}

export function generateId() {
  return 'imp_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
}
