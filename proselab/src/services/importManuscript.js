/**
 * importManuscript.js - Logic for dissecting a full manuscript into chapters and scenes
 */

import { splitByH1, splitByH2, detectSceneBreaks, estimateWordCount } from './markdownParser.js';

export function parseManuscript(markdownText, options = {}) {
  const {
    chapterHeadingLevel = 'auto', // 'h1', 'h2', or 'auto'
    sceneBreakPattern = 'auto',   // 'hr', 'blank', 'heading', 'auto'
    maxSceneWords = 5000,         // fallback chunking threshold
  } = options;

  // Step 1: Strip front matter if present
  let body = markdownText;
  let frontMatter = null;
  const fmMatch = markdownText.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (fmMatch) {
    frontMatter = fmMatch[1];
    body = fmMatch[2];
  }

  // Step 2: Detect chapter structure
  let chapters = [];
  
  // Try H1 first
  const h1Sections = splitByH1(body);
  if (h1Sections.length > 1 || (h1Sections.length === 1 && chapterHeadingLevel !== 'h2')) {
    chapters = h1Sections;
  } else {
    // Try H2
    const h2Sections = splitByH2(body);
    if (h2Sections.length > 1) {
      chapters = h2Sections;
    } else {
      // No heading structure — treat as single chapter
      chapters = [{ heading: 'Chapter 1', content: body }];
    }
  }

  // Step 3: Within each chapter, detect scenes
  const structuredChapters = chapters.map((chapter, idx) => {
    let sceneParts = detectSceneBreaks(chapter.content);
    
    // If no scene breaks detected, check for sub-headings as scene markers
    if (sceneParts.length <= 1) {
      const subSections = splitByH2(chapter.content);
      if (subSections.length > 1) {
        sceneParts = subSections.map(s => s.content);
      }
    }
    
    // If still no breaks and content is very long, chunk by word count
    if (sceneParts.length <= 1 && estimateWordCount(chapter.content) > maxSceneWords) {
      sceneParts = chunkByWordCount(chapter.content, maxSceneWords);
    }

    // Clean up empty scenes
    sceneParts = sceneParts.filter(s => s.trim().length > 0);

    return {
      title: chapter.heading || `Chapter ${idx + 1}`,
      order: idx,
      scenes: sceneParts.map((sceneText, sIdx) => ({
        title: `Scene ${sIdx + 1}`,
        content: sceneText.trim(),
        order: sIdx,
        wordCount: estimateWordCount(sceneText),
        status: 'imported'
      }))
    };
  });

  // Step 4: Extract title
  let title = 'Imported Manuscript';
  if (frontMatter) {
    const titleMatch = frontMatter.match(/title:\s*(.+)/i);
    if (titleMatch) title = titleMatch[1].trim().replace(/^["']|["']$/g, '');
  } else if (h1Sections.length > 0) {
    // Sometimes the first H1 is the book title, not a chapter
    const firstHeading = h1Sections[0].heading;
    if (firstHeading && !firstHeading.toLowerCase().includes('chapter')) {
      title = firstHeading;
      // Remove the title section from chapters if it has no real content
      if (estimateWordCount(structuredChapters[0]?.scenes?.[0]?.content || '') < 50) {
        structuredChapters.shift();
      }
    }
  }

  return {
    title,
    frontMatter,
    chapters: structuredChapters,
    stats: {
      totalChapters: structuredChapters.length,
      totalScenes: structuredChapters.reduce((sum, ch) => sum + ch.scenes.length, 0),
      totalWords: structuredChapters.reduce((sum, ch) => 
        sum + ch.scenes.reduce((sSum, sc) => sSum + sc.wordCount, 0), 0),
    }
  };
}

function chunkByWordCount(text, maxWords) {
  const paragraphs = text.split(/\n\n+/);
  const chunks = [];
  let currentChunk = '';
  let currentCount = 0;

  for (const para of paragraphs) {
    const paraWords = estimateWordCount(para);
    if (currentCount + paraWords > maxWords && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = para;
      currentCount = paraWords;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + para;
      currentCount += paraWords;
    }
  }
  if (currentChunk.length > 0) chunks.push(currentChunk);
  return chunks;
}

export async function importManuscriptToProject(parsedData, documentManager) {
  // Create project
  const projectId = await documentManager.createProject({
    name: parsedData.title,
    metadata: {
      importedAt: Date.now(),
      source: 'manuscript-import',
      originalStats: parsedData.stats
    }
  });

  // Create chapters and scenes
  for (const chapter of parsedData.chapters) {
    const chapterId = await documentManager.createChapter({
      projectId,
      title: chapter.title,
      order: chapter.order
    });

    for (const scene of chapter.scenes) {
      const newScene = await documentManager.createScene({
        chapterId,
        title: scene.title,
        content: scene.content,
        order: scene.order,
        status: scene.status,
        notes: '',
        tags: ['imported'],
        wordCount: scene.wordCount
      });
      // Ensure content is saved if createScene doesn't handle it
      if (newScene?.id && scene.content) {
          await documentManager.updateSceneText(newScene.id, scene.content);
      }
    }
  }

  return projectId;
}
