/**
 * importAssets.js - Logic for importing world-building assets
 */

import { splitByH1, splitByH2, extractMetadataLines } from './markdownParser.js';

// --- Detection ---

export function detectAssetType(markdownText) {
  const lower = markdownText.toLowerCase();
  const scores = {
    character: 0,
    worldRule: 0,
    beatMap: 0,
    sceneInventory: 0,
    manuscript: 0
  };

  // Character signals
  if (lower.includes('motivation')) scores.character += 2;
  if (lower.includes('backstory')) scores.character += 2;
  if (lower.includes('role')) scores.character += 1;
  if (lower.includes('relationship')) scores.character += 2;
  if (lower.includes('personality')) scores.character += 2;
  if (lower.includes('appearance') || lower.includes('physical')) scores.character += 1;
  if (lower.includes('arc')) scores.character += 1;
  if (lower.includes('dossier')) scores.character += 3;

  // World rule signals
  if (lower.includes('magic system')) scores.worldRule += 3;
  if (lower.includes('geography')) scores.worldRule += 2;
  if (lower.includes('constraint')) scores.worldRule += 2;
  if (lower.includes('lore')) scores.worldRule += 2;
  if (lower.includes('world') && lower.includes('rule')) scores.worldRule += 3;
  if (lower.includes('politics') || lower.includes('economy')) scores.worldRule += 1;
  if (lower.includes('technology') || lower.includes('religion')) scores.worldRule += 1;
  if (lower.includes('history of')) scores.worldRule += 1;

  // Beat map signals
  if (lower.includes('act 1') || lower.includes('act i')) scores.beatMap += 3;
  if (lower.includes('act 2') || lower.includes('act ii')) scores.beatMap += 3;
  if (lower.includes('act 3') || lower.includes('act iii')) scores.beatMap += 3;
  if (lower.includes('beat')) scores.beatMap += 2;
  if (lower.includes('inciting incident')) scores.beatMap += 3;
  if (lower.includes('climax')) scores.beatMap += 2;
  if (lower.includes('midpoint')) scores.beatMap += 3;
  if (lower.includes('pinch point')) scores.beatMap += 3;
  if (lower.includes('turning point')) scores.beatMap += 2;

  // Scene inventory signals
  if (lower.includes('pov:') || lower.includes('pov :')) scores.sceneInventory += 3;
  if (lower.includes('location:')) scores.sceneInventory += 2;
  if (lower.includes('timeline:')) scores.sceneInventory += 2;
  if (lower.includes('purpose:')) scores.sceneInventory += 2;
  if (lower.includes('scene inventory') || lower.includes('scene list')) scores.sceneInventory += 3;

  // Manuscript signals
  const chapterMatches = (lower.match(/^#+\s*chapter/gm) || []).length;
  if (chapterMatches >= 2) scores.manuscript += 5;
  const sceneBreaks = (lower.match(/\n---\n|\n\*\*\*\n/g) || []).length;
  if (sceneBreaks >= 3) scores.manuscript += 3;
  const wordCount = lower.split(/\s+/).length;
  if (wordCount > 5000) scores.manuscript += 2;
  if (wordCount > 20000) scores.manuscript += 3;

  // Return highest scoring type
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  
  // If top score is 0 or tied with too many, return unknown
  if (sorted[0][1] === 0) return { type: 'unknown', confidence: 0, scores };
  
  const confidence = sorted[0][1] / (sorted[0][1] + (sorted[1]?.[1] || 0) + 1);
  
  return {
    type: sorted[0][0],
    confidence, // 0-1, higher = more certain
    scores
  };
}

// --- Character Parsing ---

export function parseCharacterDossier(markdownText) {
  const h1Sections = splitByH1(markdownText);
  
  // Could be one character per file or multiple characters in one file
  return h1Sections.map(section => {
    const h2s = splitByH2(section.content);
    const fields = {};
    
    for (const sub of h2s) {
      const key = sub.heading.toLowerCase().trim();
      fields[key] = sub.content.trim();
    }
    
    // Also try extracting metadata-style lines from the whole content
    const meta = extractMetadataLines(section.content);
    
    return {
      id: Date.now() + Math.random(),
      name: section.heading,
      role: fields['role'] || meta['role'] || '',
      function: fields['function'] || fields['purpose'] || meta['function'] || meta['purpose'] || '',
      wound: fields['wound'] || meta['wound'] || '',
      arc: fields['arc'] || fields['character arc'] || meta['arc'] || '',
      personality: fields['personality'] || fields['traits'] || '',
      motivation: fields['motivation'] || fields['goal'] || fields['want'] || '',
      backstory: fields['backstory'] || fields['background'] || fields['history'] || '',
      relationships: parseRelationshipsList(fields['relationships'] || fields['connections'] || ''),
      notes: fields['notes'] || fields['additional notes'] || section.content.trim(),
      raw: section.content // Keep raw for reference
    };
  });
}

function parseRelationshipsList(text) {
  if (!text) return [];
  const lines = text.split('\n').filter(l => l.trim().startsWith('-') || l.trim().startsWith('*'));
  return lines.map(line => {
    const match = line.match(/[-*]\s*\*\*(.+?)\*\*[:\s]*(.+)/);
    if (match) return { character: match[1].trim(), relationship: match[2].trim() };
    // Fallback: just clean the line
    return { character: line.replace(/^[-*]\s*/, '').trim(), relationship: '' };
  });
}

// --- World Rule Parsing ---

export function parseWorldRules(markdownText) {
  const h1Sections = splitByH1(markdownText);
  
  return h1Sections.map(section => {
    const h2s = splitByH2(section.content);
    const fields = {};
    
    for (const sub of h2s) {
      fields[sub.heading.toLowerCase().trim()] = sub.content.trim();
    }
    
    const meta = extractMetadataLines(section.content);

    return {
      id: Date.now() + Math.random(),
      rule: section.heading,
      category: fields['category'] || fields['type'] || meta['category'] || 'General',
      cost: meta['cost'] || 'Low',
      limit: meta['limit'] || 'Moderate',
      description: fields['description'] || fields['overview'] || fields['details'] || section.content.trim(),
      constraints: fields['constraints'] || fields['limitations'] || fields['rules'] || '',
      related: fields['related'] || fields['connections'] || fields['see also'] || '',
      raw: section.content
    };
  });
}

// --- Beat Map Parsing ---

export function parseBeatMap(markdownText) {
  const h1Sections = splitByH1(markdownText);
  
  // Each H1 is an Act, each H2 is a Beat
  let globalIdx = 0;
  const allBeats = [];
  
  h1Sections.forEach(act => {
    const beats = splitByH2(act.content);
    beats.forEach((beat, idx) => {
      allBeats.push({
        id: ++globalIdx,
        act: act.heading.toUpperCase(),
        pct: `${Math.round((globalIdx / 10) * 100)}%`, // Rough guess
        title: beat.heading,
        desc: beat.content.trim(),
        target: 0,
        actual: 0,
        // Try to extract metadata from beat content
        ...extractBeatMetadata(beat.content)
      });
    });
  });

  return allBeats;
}

function extractBeatMetadata(text) {
  const meta = extractMetadataLines(text);
  return {
    characters: meta['characters'] || meta['who'] || '',
    location: meta['location'] || meta['where'] || '',
    tension: meta['tension'] || meta['stakes'] || '',
    purpose: meta['purpose'] || meta['function'] || ''
  };
}

// --- Scene Inventory Parsing ---

export function parseSceneInventory(markdownText) {
  const h1Sections = splitByH1(markdownText);
  
  return h1Sections.map(section => {
    const meta = extractMetadataLines(section.content);
    const h2s = splitByH2(section.content);
    const fields = {};
    for (const sub of h2s) {
      fields[sub.heading.toLowerCase().trim()] = sub.content.trim();
    }
    
    return {
      title: section.heading,
      chapterId: null, // To be matched later
      chapter: meta['chapter'] || '',
      pov: meta['pov'] || meta['point of view'] || '',
      location: meta['location'] || meta['setting'] || '',
      timeline: meta['timeline'] || meta['time'] || meta['when'] || '',
      purpose: meta['purpose'] || meta['goal'] || '',
      status: meta['status'] || 'draft',
      summary: fields['summary'] || fields['description'] || '',
      notes: fields['notes'] || '',
      characters: meta['characters'] || '',
      conflict: meta['conflict'] || fields['conflict'] || '',
      raw: section.content
    };
  });
}

export async function importAssetsToProject(parsedFiles, projectId, documentManager) {
  const report = {
    imported: [],
    skipped: [],
    conflicts: [],
    errors: []
  };

  for (const pf of parsedFiles) {
    try {
      switch (pf.confirmedType) {
        case 'character': {
          const characters = parseCharacterDossier(pf.text);
          for (const char of characters) {
            // Check for existing character with same name
            const existing = await documentManager.findCharacterByName(projectId, char.name);
            if (existing) {
              report.conflicts.push({
                type: 'character',
                name: char.name,
                existing,
                incoming: char,
                resolution: null // user decides later
              });
            } else {
              const id = await documentManager.saveDocument({
                projectId,
                type: 'character',
                title: char.name,
                content: JSON.stringify(char),
                domain: 'preproduction',
                subdomain: 'characters',
                tags: ['imported', char.role].filter(Boolean),
                createdAt: Date.now(),
                updatedAt: Date.now()
              });
              report.imported.push({ type: 'character', name: char.name, id });
            }
          }
          break;
        }

        case 'worldRule': {
          const rules = parseWorldRules(pf.text);
          for (const rule of rules) {
            const id = await documentManager.saveDocument({
              projectId,
              type: 'worldRule',
              title: rule.rule || rule.title,
              content: JSON.stringify(rule),
              domain: 'preproduction',
              subdomain: 'worldRules',
              category: rule.category,
              tags: ['imported', rule.category].filter(Boolean),
              createdAt: Date.now(),
              updatedAt: Date.now()
            });
            report.imported.push({ type: 'worldRule', name: rule.rule || rule.title, id });
          }
          break;
        }

        case 'beatMap': {
          const beats = parseBeatMap(pf.text);
          // Beat map is typically one per project — store as project-level metadata
          const id = await documentManager.saveDocument({
            projectId,
            type: 'beatMap',
            title: 'Imported Beat Map',
            content: JSON.stringify(beats),
            domain: 'preproduction',
            subdomain: 'beatMap',
            tags: ['imported'],
            createdAt: Date.now(),
            updatedAt: Date.now()
          });
          report.imported.push({ type: 'beatMap', name: 'Beat Map', id });
          break;
        }

        case 'sceneInventory': {
          const scenes = parseSceneInventory(pf.text);
          for (const scene of scenes) {
            const id = await documentManager.saveDocument({
              projectId,
              type: 'sceneInventory',
              title: scene.title,
              content: JSON.stringify(scene),
              domain: 'preproduction',
              subdomain: 'sceneInventory',
              tags: ['imported', scene.status].filter(Boolean),
              createdAt: Date.now(),
              updatedAt: Date.now()
            });
            report.imported.push({ type: 'sceneInventory', name: scene.title, id });
          }
          break;
        }

        default:
          report.skipped.push({ file: pf.file.name, reason: 'Unknown type' });
      }
    } catch (err) {
      report.errors.push({ file: pf.file.name, error: err.message });
    }
  }

  return report;
}
