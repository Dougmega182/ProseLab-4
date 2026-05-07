// src/services/conflictDetectionService.js

export function detectConflicts(classifications, projectData) {
  const conflicts = [];

  for (const classification of classifications) {
    if (classification.category === 'skip') continue;

    const fileConflicts = detectConflictsForFile(classification, projectData);
    if (fileConflicts.length > 0) {
      conflicts.push(...fileConflicts);
    }
  }

  return conflicts;
}

function detectConflictsForFile(classification, projectData) {
  const conflicts = [];
  const { category, fileName, content, parsedData } = classification;

  switch (category) {
    case 'manuscript': {
      if (projectData.chapters && projectData.chapters.length > 0) {
        conflicts.push({
          fileName,
          category,
          type: 'existing_content',
          description: `Project already has ${projectData.chapters.length} chapter(s). Importing this manuscript may create duplicates.`,
          existingCount: projectData.chapters.length,
          options: ['overwrite', 'merge', 'skip'],
          defaultResolution: 'merge'
        });
      }
      break;
    }

    case 'characters': {
      const importedChars = parsedData
        ? (Array.isArray(parsedData) ? parsedData : [parsedData])
        : parseNamesFromContent(content);

      if (projectData.characters && projectData.characters.length > 0) {
        for (const importedChar of importedChars) {
          const name = importedChar.name || importedChar;
          if (typeof name !== 'string') continue;

          const existing = projectData.characters.find(
            c => c.name?.toLowerCase() === name.toLowerCase()
          );

          if (existing) {
            conflicts.push({
              fileName,
              category,
              type: 'duplicate_character',
              description: `Character "${name}" already exists in the project.`,
              existingItem: existing,
              importedItem: importedChar,
              options: ['overwrite', 'merge', 'rename', 'skip'],
              defaultResolution: 'merge'
            });
          }
        }
      }
      break;
    }

    case 'worldRules': {
      if (projectData.worldRules && projectData.worldRules.length > 0) {
        conflicts.push({
          fileName,
          category,
          type: 'existing_content',
          description: `Project already has ${projectData.worldRules.length} world rule(s). New rules will be appended.`,
          existingCount: projectData.worldRules.length,
          options: ['merge', 'overwrite', 'skip'],
          defaultResolution: 'merge'
        });
      }
      break;
    }

    case 'beatMap': {
      if (projectData.beats && projectData.beats.length > 0) {
        conflicts.push({
          fileName,
          category,
          type: 'existing_content',
          description: `Project already has ${projectData.beats.length} beat(s). Importing may create a conflicting structure.`,
          existingCount: projectData.beats.length,
          options: ['overwrite', 'merge', 'skip'],
          defaultResolution: 'overwrite'
        });
      }
      break;
    }

    case 'notes': {
      // Notes rarely conflict, but check for exact filename duplicates
      if (projectData.notes) {
        const existingNote = projectData.notes.find(
          n => n.title === fileName.replace(/\.[^.]+$/, '')
        );
        if (existingNote) {
          conflicts.push({
            fileName,
            category,
            type: 'duplicate_note',
            description: `A note with the title "${existingNote.title}" already exists.`,
            existingItem: existingNote,
            options: ['overwrite', 'rename', 'skip'],
            defaultResolution: 'rename'
          });
        }
      }
      break;
    }
  }

  return conflicts;
}

function parseNamesFromContent(content) {
  // Simple extraction of potential character names from text
  const names = [];
  const lines = content.split('\n');
  for (const line of lines) {
    const match = line.match(/^(?:#{1,3}\s+|(?:\*\*|__))([\w\s]+?)(?:\*\*|__)|^([\w\s]+?):\s/);
    if (match) {
      names.push({ name: (match[1] || match[2]).trim() });
    }
  }
  return names;
}
