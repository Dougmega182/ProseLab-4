/**
 * importBridge.js - Bridges between parsed/classified files and the project's document store
 */

export async function importManuscriptToProject(parsed, documentManager, projectId) {
  const results = { chapters: 0, scenes: 0 };
  
  for (const chapter of parsed.chapters) {
    const chapterDoc = await documentManager.createChapter({
      projectId,
      title: chapter.title,
      order: chapter.order,
      metadata: {
        originalHeading: chapter.title,
        importedAt: Date.now()
      }
    });
    results.chapters++;

    for (let i = 0; i < chapter.scenes.length; i++) {
      const scene = chapter.scenes[i];
      await documentManager.createScene({
        projectId,
        chapterId: chapterDoc.id,
        title: scene.title || `Scene ${i + 1}`,
        content: scene.content,
        order: i,
        metadata: {
          chapterTitle: chapter.title,
          sceneIndex: i,
          wordCount: scene.content.split(/\s+/).length,
          importedAt: Date.now()
        }
      });
      results.scenes++;
    }
  }

  // Store frontmatter if present
  if (parsed.frontmatter && Object.keys(parsed.frontmatter).length > 0) {
    await documentManager.saveDocument({
      projectId,
      type: 'metadata',
      title: 'Manuscript Metadata',
      content: JSON.stringify(parsed.frontmatter, null, 2),
      domain: 'preproduction',
      subdomain: 'metadata',
      metadata: { source: 'frontmatter', importedAt: Date.now() },
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }

  return results;
}

export async function importAssetsToProjectBridge(classifiedFiles, projectId, documentManager) {
  const results = { imported: 0, conflicts: [] };

  for (const cf of classifiedFiles) {
    if (cf.confirmedType === 'unknown') continue;

    const subdomain = {
      character: 'characters',
      worldRule: 'worldRules',
      beatMap: 'beatMap',
      sceneInventory: 'sceneInventory'
    }[cf.confirmedType] || cf.confirmedType;

    // Check for conflicts with existing documents
    const existing = await documentManager.findDocuments({
      projectId,
      type: cf.confirmedType,
      domain: 'preproduction'
    });

    // Simple name-based conflict detection
    const incomingTitle = extractTitleFromContent(cf.text, cf.file.name);
    const conflicting = existing.find(doc => {
      const docTitle = doc.title?.toLowerCase().trim();
      const incTitle = incomingTitle.toLowerCase().trim();
      return docTitle === incTitle || 
             levenshteinSimilarity(docTitle, incTitle) > 0.85;
    });

    if (conflicting) {
      results.conflicts.push({
        type: cf.confirmedType,
        existing: conflicting,
        incoming: {
          name: incomingTitle,
          content: cf.text,
          fileName: cf.file.name
        },
        resolution: null
      });
      continue;
    }

    // No conflict — import directly
    await documentManager.saveDocument({
      projectId,
      type: cf.confirmedType,
      title: incomingTitle,
      content: cf.text,
      domain: 'preproduction',
      subdomain,
      tags: ['imported'],
      metadata: {
        sourceFile: cf.file.name,
        detectedType: cf.detectedType,
        confirmedType: cf.confirmedType,
        confidence: cf.confidence,
        importedAt: Date.now()
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    results.imported++;
  }

  return results;
}

function extractTitleFromContent(text, fallbackFileName) {
  const headingMatch = text.match(/^#\s+(.+)$/m);
  if (headingMatch) return headingMatch[1].trim();
  
  const yamlMatch = text.match(/^---\s*\n[\s\S]*?title:\s*(.+)\n[\s\S]*?---/);
  if (yamlMatch) return yamlMatch[1].trim().replace(/^["']|["']$/g, '');
  
  return fallbackFileName.replace(/\.(md|markdown|txt)$/i, '').replace(/[-_]/g, ' ');
}

function levenshteinSimilarity(a, b) {
  if (!a || !b) return 0;
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (longer.length === 0) return 1.0;
  
  const costs = [];
  for (let i = 0; i <= shorter.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= longer.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (shorter[i - 1] !== longer[j - 1]) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[longer.length] = lastValue;
  }
  return (longer.length - costs[longer.length]) / longer.length;
}
