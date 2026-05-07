// src/services/importOrchestrator.js
import { 
  parseMultipleFiles, 
  applyImport,
  CATEGORY_LABELS
} from './importService.js';

export class ImportOrchestrator {
  constructor(storage, llm) {
    this.storage = storage;
    this.llm = llm; // Expected to have a .generate(prompt, options) method
    this.onProgress = null; // callback(progressData)
  }

  /**
   * Alias for parseMultipleFiles from importService
   */
  async parse(files) {
    return await parseMultipleFiles(files);
  }

  /**
   * Alias for classifyFiles
   */
  async classify(files) {
    return this.classifyFiles(files);
  }

  /**
   * Alias for detectConflicts
   */
  async getConflicts(projectId, files) {
    return await this.detectConflicts(projectId, files);
  }

  /**
   * Alias for executeImport
   */
  async execute(projectId, files, resolutions, options, onProgress) {
    const importOptions = {
      ...options,
      conflicts: Object.entries(resolutions).map(([id, resolution]) => ({
        id, resolution
      }))
    };
    return await this.executeImport(projectId, files, importOptions, onProgress);
  }

  /**
   * Classify multiple files
   */
  classifyFiles(files) {
    return files.map(file => {
      const classification = ImportOrchestrator.classifyFile(file.fileName, file.text);
      return {
        ...file,
        category: classification.suggestedType,
        confidence: classification.confidence,
        reason: classification.reason
      };
    });
  }

  /**
   * Classify a single file based on its name and content
   */
  static classifyFile(fileName, text) {
    const name = fileName.toLowerCase();
    const sample = text.substring(0, 3000).toLowerCase();
    const wordCount = text.split(/\s+/).length;

    // Check filename patterns first
    if (/character|cast|dramatis/i.test(name)) {
      return { suggestedType: 'character', confidence: 'high', reason: 'Filename suggests character profiles' };
    }
    if (/world|lore|magic|setting|rules|bible/i.test(name)) {
      return { suggestedType: 'worldRule', confidence: 'high', reason: 'Filename suggests world-building document' };
    }
    if (/outline|beat|structure|plot|synopsis/i.test(name)) {
      return { suggestedType: 'beatMap', confidence: 'high', reason: 'Filename suggests outline or beat sheet' };
    }
    if (/note|ref|research|idea|brainstorm/i.test(name)) {
      return { suggestedType: 'note', confidence: 'high', reason: 'Filename suggests notes or reference material' };
    }
    if (/chapter|manuscript|draft|novel|story|book/i.test(name)) {
      return { suggestedType: 'manuscript', confidence: 'high', reason: 'Filename suggests manuscript content' };
    }

    // Content-based heuristics
    const dialogueCount = (text.match(/[""\u201C].+?[""\u201D]/g) || []).length;
    const bulletCount = (text.match(/^[\s]*[-*•]\s+/gm) || []).length;
    const numberedCount = (text.match(/^\s*\d+[\.\)]\s+/gm) || []).length;

    // Character profile patterns
    const charPatterns = /\b(name|age|appearance|personality|backstory|motivation|traits|physical description|occupation|role)\s*[:—-]/gi;
    const charMatches = (sample.match(charPatterns) || []).length;
    if (charMatches >= 3) {
      return { suggestedType: 'character', confidence: 'medium', reason: `Content contains ${charMatches} character-profile fields` };
    }

    // World-building patterns
    const worldPatterns = /\b(rule|law|magic system|geography|history|culture|species|race|faction|technology|economy|religion|government)\s*[:—-]/gi;
    const worldMatches = (sample.match(worldPatterns) || []).length;
    if (worldMatches >= 2) {
      return { suggestedType: 'worldRule', confidence: 'medium', reason: `Content contains ${worldMatches} world-building descriptors` };
    }

    // Beat/outline patterns
    if ((bulletCount + numberedCount) > 10 && dialogueCount < 5) {
      return { suggestedType: 'beatMap', confidence: 'medium', reason: 'Content is heavily structured with lists' };
    }
    if (/\b(act\s+[1-3i]+|inciting incident|climax|resolution|midpoint|turning point|pinch point)\b/i.test(sample)) {
      return { suggestedType: 'beatMap', confidence: 'medium', reason: 'Content contains story structure terminology' };
    }

    // Manuscript detection
    if (wordCount > 1000 && dialogueCount > 5) {
      return { suggestedType: 'manuscript', confidence: 'medium', reason: `Long text with dialogue` };
    }
    if (wordCount > 3000) {
      return { suggestedType: 'manuscript', confidence: 'low', reason: `Long text, assumed to be manuscript` };
    }

    // Short text defaults to notes
    if (wordCount < 500) {
      return { suggestedType: 'note', confidence: 'low', reason: 'Short text' };
    }

    return { suggestedType: 'manuscript', confidence: 'low', reason: 'Defaulting to manuscript' };
  }

  /**
   * Detect conflicts between imported files and existing project data
   */
  async detectConflicts(projectId, files) {
    const conflicts = [];
    const existingChapters = await this.storage.getChapters(projectId) || [];
    const existingCharacters = await this.storage.getCharacters(projectId) || [];
    const existingWorldRules = await this.storage.getWorldRules(projectId) || [];

    for (const file of files) {
      const fileType = file.category;

      if (fileType === 'manuscript') {
        const titles = this._extractChapterTitles(file.text);
        for (const title of titles) {
          const match = existingChapters.find(ch => ch.title && ch.title.toLowerCase().trim() === title.toLowerCase().trim());
          if (match) {
            conflicts.push({
              type: 'manuscript',
              name: title,
              fileName: file.fileName,
              existingId: match.id,
              existingPreview: (match.content || '').substring(0, 200),
              importedPreview: this._extractChapterContent(file.text, title).substring(0, 200)
            });
          }
        }
      }

      if (fileType === 'character') {
        const names = this._extractCharacterNames(file.text);
        for (const name of names) {
          const match = existingCharacters.find(c => c.name && c.name.toLowerCase().trim() === name.toLowerCase().trim());
          if (match) {
            conflicts.push({
              type: 'character',
              name,
              fileName: file.fileName,
              existingId: match.id,
              existingPreview: match.description ? match.description.substring(0, 200) : '',
              importedPreview: this._extractCharacterBlock(file.text, name).substring(0, 200)
            });
          }
        }
      }

      if (fileType === 'worldRule') {
        const names = this._extractRuleNames(file.text);
        for (const name of names) {
          const match = existingWorldRules.find(r => r.title && r.title.toLowerCase().trim() === name.toLowerCase().trim());
          if (match) {
            conflicts.push({
              type: 'worldRule',
              name,
              fileName: file.fileName,
              existingId: match.id,
              existingPreview: (match.content || '').substring(0, 200),
              importedPreview: ''
            });
          }
        }
      }
    }
    return conflicts;
  }

  /**
   * Main import execution method
   */
  async executeImport(projectId, files, options, onProgress) {
    this.onProgress = onProgress;
    
    // Get current project data for applyImport
    const project = await this.storage.getProject(projectId);
    if (!project) throw new Error("Project not found");

    // Map resolutions from options.conflicts
    const resolutions = {};
    if (options.conflicts) {
      options.conflicts.forEach(c => {
        resolutions[c.id] = c.resolution;
      });
    }

    if (onProgress) onProgress({ current: 0, total: 100, message: "Applying import logic..." });

    // Use importService.applyImport for the heavy lifting
    const { updatedProject, changelog, warnings, summary } = await applyImport(project, files, resolutions);

    // Save updated project back to storage
    if (onProgress) onProgress({ current: 50, total: 100, message: "Saving changes to database..." });
    
    await this.storage.updateProjectMetadata({
      chars: updatedProject.characters,
      rules: updatedProject.worldRules,
      beats: updatedProject.beats,
      voice: updatedProject.voice
    });

    // Handle manuscript chapters and scenes
    // For simplicity in this implementation, we'll assume applyImport handled the array
    // and we need to persist them to the separate Chapter/Scene stores if they changed.
    for (const chapter of updatedProject.chapters) {
      if (chapter.id.startsWith('imp_')) {
        // This is a new chapter from importService
        const newChapter = await this.storage.createChapter({
          projectId,
          title: chapter.title,
          order: chapter.order,
          importedAt: chapter.importedAt
        });
        
        // Split content into scenes if needed, or just one big scene
        await this.storage.createScene({
          projectId,
          chapterId: newChapter.id,
          title: "Imported Content",
          text: chapter.content,
          order: 0
        });
      } else {
        // Check if it was updated
        const isUpdated = changelog.find(c => c.type === 'Chapter' && c.detail === chapter.title && (c.action === 'Updated' || c.action === 'Merged'));
        if (isUpdated) {
          await this.storage.updateChapter(projectId, chapter.id, {
            title: chapter.title,
            order: chapter.order
          });
          // Update the first scene's text
          const scenes = await this.storage.getScenes(chapter.id);
          if (scenes && scenes.length > 0) {
            await this.storage.updateSceneText(scenes[0].id, chapter.content);
          }
        }
      }
    }

    if (onProgress) onProgress({ current: 100, total: 100, message: "Import complete!" });

    return {
      summary,
      changelog,
      warnings
    };
  }

  // ---- Private: Import Methods ----

  async _importManuscript(projectId, file, options, report, advance) {
    advance(`Importing manuscript: ${file.fileName}`);
    const chapters = this._splitIntoChapters(file.text, file.fileName);

    for (const chapter of chapters) {
      const conflict = (options.conflicts || []).find(
        c => c.type === 'manuscript' && c.name === chapter.title && c.fileName === file.fileName
      );

      if (conflict) {
        const resolution = conflict.resolution || 'skip';
        if (resolution === 'skip') { report.skipped++; continue; }
        if (resolution === 'overwrite') {
          await this.storage.updateChapter(projectId, conflict.existingId, { content: chapter.content, updatedAt: new Date().toISOString() });
          report.chaptersImported++;
          continue;
        }
        if (resolution === 'merge') {
          const existing = await this.storage.getChapter(projectId, conflict.existingId);
          await this.storage.updateChapter(projectId, conflict.existingId, { content: (existing.content || '') + '\n\n---\n\n' + chapter.content, updatedAt: new Date().toISOString() });
          report.chaptersImported++;
          continue;
        }
      }

      await this.storage.createChapter(projectId, { title: chapter.title, content: chapter.content, order: chapter.order, importedFrom: file.fileName, importedAt: new Date().toISOString() });
      report.chaptersImported++;
    }
  }

  async _importCharacters(projectId, file, options, report, advance) {
    advance(`Importing characters: ${file.fileName}`);
    const characters = this._parseCharacterFile(file.text);

    for (const char of characters) {
      const conflict = (options.conflicts || []).find(
        c => c.type === 'character' && c.name === char.name && c.fileName === file.fileName
      );

      if (conflict) {
        const resolution = conflict.resolution || 'skip';
        if (resolution === 'skip') { report.skipped++; continue; }
        if (resolution === 'overwrite') {
          await this.storage.updateCharacter(projectId, conflict.existingId, { ...char, updatedAt: new Date().toISOString() });
          report.charactersImported++;
          continue;
        }
        if (resolution === 'merge') {
          const existing = await this.storage.getCharacter(projectId, conflict.existingId);
          await this.storage.updateCharacter(projectId, conflict.existingId, { description: (existing.description || '') + '\n\n' + (char.description || ''), notes: (existing.notes || '') + '\n\n' + (char.notes || ''), updatedAt: new Date().toISOString() });
          report.charactersImported++;
          continue;
        }
      }

      await this.storage.createCharacter(projectId, { ...char, importedFrom: file.fileName, importedAt: new Date().toISOString() });
      report.charactersImported++;
    }
  }

  async _importWorldRules(projectId, file, options, report, advance) {
    advance(`Importing world rules: ${file.fileName}`);
    const rules = this._parseWorldRulesFile(file.text);

    for (const rule of rules) {
      const conflict = (options.conflicts || []).find(
        c => c.type === 'worldRule' && c.name === rule.title && c.fileName === file.fileName
      );

      if (conflict) {
        const resolution = conflict.resolution || 'skip';
        if (resolution === 'skip') { report.skipped++; continue; }
        if (resolution === 'overwrite') {
          await this.storage.updateWorldRule(projectId, conflict.existingId, { ...rule, updatedAt: new Date().toISOString() });
          report.worldRulesImported++;
          continue;
        }
        if (resolution === 'merge') {
          const existing = await this.storage.getWorldRule(projectId, conflict.existingId);
          await this.storage.updateWorldRule(projectId, conflict.existingId, {
            description: (existing.description || '') + '\n\n' + (rule.description || ''),
            updatedAt: new Date().toISOString()
          });
          report.worldRulesImported++;
          continue;
        }
      }

      await this.storage.createWorldRule(projectId, { ...rule, importedFrom: file.fileName, importedAt: new Date().toISOString() });
      report.worldRulesImported++;
    }
  }

  async _importBeatMap(projectId, file, options, report, advance) {
    advance(`Importing beat map: ${file.fileName}`);
    const beats = this._parseBeatMapFile(file.text);
    for (const beat of beats) {
      await this.storage.createBeat(projectId, { ...beat, importedFrom: file.fileName, importedAt: new Date().toISOString() });
      report.beatsImported++;
    }
  }

  async _importNote(projectId, file, options, report, advance) {
    advance(`Importing note: ${file.fileName}`);
    await this.storage.createNote(projectId, { title: file.fileName.replace(/\.[^.]+$/, ''), content: file.text, importedFrom: file.fileName, importedAt: new Date().toISOString() });
    report.notesImported++;
  }

  // ---- Private: Parsing Helpers ----

  _splitIntoChapters(text, fileName) {
    const chapters = [];
    const chapterSplits = text.split(/(?=^(?:#{1,3}\s+)?chapter\s+\d+)/gmi);

    if (chapterSplits.length > 1) {
      chapterSplits.forEach((chunk, i) => {
        const trimmed = chunk.trim();
        if (!trimmed) return;
        const firstLine = trimmed.split('\n')[0].trim();
        const title = firstLine.replace(/^#+\s*/, '').trim() || `Chapter ${i + 1}`;
        chapters.push({ title, content: trimmed, order: i });
      });
      return chapters;
    }

    const headingSplits = text.split(/(?=^#{1,2}\s+.+$)/gm);
    if (headingSplits.length > 1) {
      headingSplits.forEach((chunk, i) => {
        const trimmed = chunk.trim();
        if (!trimmed) return;
        const firstLine = trimmed.split('\n')[0].trim();
        const title = firstLine.replace(/^#+\s*/, '').trim();
        chapters.push({ title, content: trimmed, order: i });
      });
      return chapters;
    }

    const sceneSplits = text.split(/\n\s*(?:\*\s*\*\s*\*|---+|___+)\s*\n/);
    if (sceneSplits.length > 1 && sceneSplits.length <= 100) {
      sceneSplits.forEach((chunk, i) => {
        const trimmed = chunk.trim();
        if (!trimmed) return;
        chapters.push({ title: `Section ${i + 1}`, content: trimmed, order: i });
      });
      return chapters;
    }

    chapters.push({ title: fileName.replace(/\.[^.]+$/, ''), content: text, order: 0 });
    return chapters;
  }

  _parseCharacterFile(text) {
    const characters = [];
    const sections = text.split(/(?=^#{1,3}\s+.+$)/gm).filter(s => s.trim());

    if (sections.length > 1 || (sections.length === 1 && /^#{1,3}\s+/.test(sections[0]))) {
      for (const section of sections) {
        const lines = section.trim().split('\n');
        const nameLine = lines[0].replace(/^#+\s*/, '').trim();
        if (!nameLine) continue;
        const body = lines.slice(1).join('\n').trim();
        const char = { name: nameLine, description: body };
        const fieldPatterns = { age: /\bage\s*[:—-]\s*(.+)/i, role: /\brole\s*[:—-]\s*(.+)/i, appearance: /\b(?:appearance|looks?|physical)\s*[:—-]\s*(.+)/i, personality: /\b(?:personality|temperament)\s*[:—-]\s*(.+)/i, backstory: /\b(?:backstory|background|history)\s*[:—-]\s*(.+)/i, motivation: /\b(?:motivation|goal|want|desire)\s*[:—-]\s*(.+)/i, traits: /\b(?:traits?|characteristics?)\s*[:—-]\s*(.+)/i };
        for (const [field, pattern] of Object.entries(fieldPatterns)) {
          const match = body.match(pattern);
          if (match) char[field] = match[1].trim();
        }
        characters.push(char);
      }
      return characters;
    }

    const blocks = text.split(/\n\s*\n/).filter(b => b.trim());
    for (const block of blocks) {
      const nameMatch = block.match(/\b(?:name|character)\s*[:—-]\s*(.+)/i);
      if (nameMatch) {
        const char = { name: nameMatch[1].trim(), description: block.trim() };
        const roleMatch = block.match(/\brole\s*[:—-]\s*(.+)/i); if (roleMatch) char.role = roleMatch[1].trim();
        const ageMatch = block.match(/\bage\s*[:—-]\s*(.+)/i); if (ageMatch) char.age = ageMatch[1].trim();
        characters.push(char);
      }
    }

    if (characters.length === 0) {
      const firstLine = text.trim().split('\n')[0].trim();
      characters.push({ name: firstLine.substring(0, 50), description: text.trim() });
    }
    return characters;
  }

  _parseWorldRulesFile(text) {
    const rules = [];
    const sections = text.split(/(?=^#{1,3}\s+.+$)/gm).filter(s => s.trim());
    if (sections.length > 1 || (sections.length === 1 && /^#{1,3}\s+/.test(sections[0]))) {
      for (const section of sections) {
        const lines = section.trim().split('\n');
        const title = lines[0].replace(/^#+\s*/, '').trim();
        if (!title) continue;
        const description = lines.slice(1).join('\n').trim();
        rules.push({ title, description, category: this._guessWorldRuleCategory(title, description) });
      }
      return rules;
    }

    const blocks = text.split(/\n\s*\n/).filter(b => b.trim());
    for (const block of blocks) {
      const firstLine = block.trim().split('\n')[0].replace(/^[\d\.\)\-\*•]+\s*/, '').trim();
      if (firstLine.length > 0 && firstLine.length < 100) {
        rules.push({ title: firstLine, description: block.trim(), category: this._guessWorldRuleCategory(firstLine, block) });
      }
    }

    if (rules.length === 0) rules.push({ title: 'Imported World Rules', description: text.trim(), category: 'general' });
    return rules;
  }

  _parseBeatMapFile(text) {
    const beats = [];
    const numberedPattern = /^\s*(\d+)[\.\)]\s*(.+)/gm;
    let match;
    while ((match = numberedPattern.exec(text)) !== null) {
      beats.push({ order: parseInt(match[1], 10), title: match[2].trim(), description: '', type: 'beat' });
    }
    if (beats.length > 0) return beats;

    const bulletPattern = /^\s*[-*•]\s+(.+)/gm;
    let order = 0;
    while ((match = bulletPattern.exec(text)) !== null) {
      order++;
      beats.push({ order, title: match[1].trim(), description: '', type: 'beat' });
    }
    if (beats.length > 0) return beats;

    const sections = text.split(/(?=^#{1,3}\s+.+$)/gm).filter(s => s.trim());
    sections.forEach((section, i) => {
      const lines = section.trim().split('\n');
      const title = lines[0].replace(/^#+\s*/, '').trim();
      const description = lines.slice(1).join('\n').trim();
      if (title) beats.push({ order: i + 1, title, description, type: this._guessBeatType(title) });
    });

    if (beats.length === 0) beats.push({ order: 1, title: 'Imported Beat Map', description: text.trim(), type: 'beat' });
    return beats;
  }

  _extractChapterTitles(text) {
    const titles = [];
    const pattern = /^(?:#{1,3}\s+)?(?:chapter\s+\d+[:\s]*)(.*)/gmi;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const title = match[0].replace(/^#+\s*/, '').trim();
      if (title) titles.push(title);
    }
    if (titles.length === 0) {
      const headingPattern = /^#{1,2}\s+(.+)$/gm;
      while ((match = headingPattern.exec(text)) !== null) titles.push(match[1].trim());
    }
    return titles;
  }

  _extractChapterContent(text, title) {
    const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(?:^#{1,3}\\s+)?${escapedTitle}\\s*\\n([\\s\\S]*?)(?=\\n#{1,3}\\s+|$)`, 'mi');
    const match = text.match(pattern);
    return match ? match[1].trim() : '';
  }

  _extractCharacterNames(text) {
    const names = [];
    const headingPattern = /^#{1,3}\s+(.+)$/gm;
    let match;
    while ((match = headingPattern.exec(text)) !== null) names.push(match[1].trim());
    const nameFieldPattern = /\b(?:name|character)\s*[:—-]\s*(.+)/gi;
    while ((match = nameFieldPattern.exec(text)) !== null) {
      const name = match[1].trim();
      if (!names.includes(name)) names.push(name);
    }
    return names;
  }

  _extractCharacterBlock(text, name) {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(?:^#{1,3}\\s+)?${escapedName}\\s*\\n([\\s\\S]*?)(?=\\n#{1,3}\\s+|$)`, 'mi');
    const match = text.match(pattern);
    return match ? match[1].trim() : '';
  }

  _extractRuleNames(text) {
    const names = [];
    const headingPattern = /^#{1,3}\s+(.+)$/gm;
    let match;
    while ((match = headingPattern.exec(text)) !== null) names.push(match[1].trim());
    return names;
  }

  _guessWorldRuleCategory(title, description) {
    const combined = (title + ' ' + description).toLowerCase();
    if (/magic|spell|enchant|arcane|mana|power/i.test(combined)) return 'magic';
    if (/geography|terrain|land|continent|ocean|mountain|city|town/i.test(combined)) return 'geography';
    if (/history|timeline|era|epoch|war|battle|founding/i.test(combined)) return 'history';
    if (/culture|custom|tradition|ritual|festival|social/i.test(combined)) return 'culture';
    if (/species|race|creature|beast|monster|fauna|flora/i.test(combined)) return 'species';
    if (/technology|tech|invention|machine|device/i.test(combined)) return 'technology';
    if (/politic|government|kingdom|empire|republic|faction|guild/i.test(combined)) return 'politics';
    if (/religion|god|deity|faith|worship|temple|church/i.test(combined)) return 'religion';
    if (/economy|trade|currency|merchant|market/i.test(combined)) return 'economy';
    if (/language|tongue|dialect|script|writing/i.test(combined)) return 'language';
    return 'general';
  }

  _guessBeatType(title) {
    const t = title.toLowerCase();
    if (/opening|hook|beginning|start/i.test(t)) return 'opening';
    if (/inciting|catalyst|trigger/i.test(t)) return 'inciting_incident';
    if (/first.*plot|plot.*point.*1|turning.*point.*1/i.test(t)) return 'plot_point_1';
    if (/midpoint|mid.*point|middle/i.test(t)) return 'midpoint';
    if (/second.*plot|plot.*point.*2|turning.*point.*2/i.test(t)) return 'plot_point_2';
    if (/climax|crisis|final.*battle/i.test(t)) return 'climax';
    if (/resolution|denouement|ending|conclusion/i.test(t)) return 'resolution';
    if (/pinch/i.test(t)) return 'pinch_point';
    return 'beat';
  }

  _calculateTotalSteps(files, options) {
    let steps = files.length;
    if (options.extractCharacters) steps++;
    if (options.extractWorldRules) steps++;
    if (options.deriveBeatMap) steps++;
    if (options.buildSceneInventory) steps++;
    if (options.checkContinuity) steps++;
    return steps;
  }

  // ---- Private: AI Analysis Methods ----

  async _aiExtractCharacters(projectId, manuscriptText, options, report) {
    const maxChars = 30000;
    const truncated = manuscriptText.length > maxChars ? manuscriptText.substring(0, maxChars) + '\n\n[... truncated ...]' : manuscriptText;
    const prompt = `Analyze the following manuscript text and extract all characters mentioned. Return a JSON array of objects with: name, role, description, traits, relationships. Respond ONLY with JSON.\n\nMANUSCRIPT:\n${truncated}`;
    const response = await this.llm.generate(prompt, { temperature: 0.3, maxTokens: 4000 });
    try {
      const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const characters = JSON.parse(cleaned);
      if (options.autoSaveExtracted) {
        for (const char of characters) {
          const existing = await this.storage.getCharacters(projectId);
          if (!existing.find(e => e.name.toLowerCase().trim() === (char.name || '').toLowerCase().trim())) {
            await this.storage.createCharacter(projectId, { ...char, source: 'ai-extracted', importedAt: new Date().toISOString() });
            report.charactersImported++;
          }
        }
      }
      return characters;
    } catch (err) { throw new Error(`AI extraction failed: ${err.message}`); }
  }

  async _aiExtractWorldRules(projectId, manuscriptText, options, report) {
    const maxChars = 30000;
    const truncated = manuscriptText.length > maxChars ? manuscriptText.substring(0, maxChars) + '\n\n[... truncated ...]' : manuscriptText;
    const prompt = `Analyze the manuscript and extract world-building rules. Return a JSON array of objects with: title, category, description, evidence. Respond ONLY with JSON.\n\nMANUSCRIPT:\n${truncated}`;
    const response = await this.llm.generate(prompt, { temperature: 0.3, maxTokens: 4000 });
    try {
      const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const rules = JSON.parse(cleaned);
      if (options.autoSaveExtracted) {
        for (const rule of rules) {
          const existing = await this.storage.getWorldRules(projectId);
          if (!existing.find(e => e.title && e.title.toLowerCase().trim() === (rule.title || '').toLowerCase().trim())) {
            await this.storage.createWorldRule(projectId, { ...rule, source: 'ai-extracted', importedAt: new Date().toISOString() });
            report.worldRulesImported++;
          }
        }
      }
      return rules;
    } catch (err) { throw new Error(`AI extraction failed: ${err.message}`); }
  }

  async _aiDeriveBeatMap(projectId, manuscriptText, options, report) {
    const maxChars = 30000;
    const truncated = manuscriptText.length > maxChars ? manuscriptText.substring(0, maxChars) + '\n\n[... truncated ...]' : manuscriptText;
    const prompt = `Analyze the manuscript and derive a story beat map. Return a JSON array of objects with: order, title, type, description, approximateLocation. Respond ONLY with JSON.\n\nMANUSCRIPT:\n${truncated}`;
    const response = await this.llm.generate(prompt, { temperature: 0.3, maxTokens: 4000 });
    try {
      const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const beats = JSON.parse(cleaned);
      if (options.autoSaveExtracted) {
        for (const beat of beats) {
          await this.storage.createBeat(projectId, { ...beat, source: 'ai-derived', importedAt: new Date().toISOString() });
          report.beatsImported++;
        }
      }
      return beats;
    } catch (err) { throw new Error(`AI extraction failed: ${err.message}`); }
  }

  async _aiBuildSceneInventory(projectId, manuscriptText) {
    const maxChars = 30000;
    const truncated = manuscriptText.length > maxChars
      ? manuscriptText.substring(0, maxChars) + '\n\n[... truncated for analysis ...]'
      : manuscriptText;

    const prompt = `Analyze the following manuscript and create a scene-by-scene inventory. For each scene, provide:
- sceneNumber: Sequential number
- title: A brief descriptive title
- setting: Where the scene takes place
- timeOfDay: When it occurs (if discernible)
- characters: Array of character names present
- summary: A 1-2 sentence summary of what happens
- purpose: The narrative purpose of this scene (e.g., "introduces conflict", "character development", "advances plot")
- wordCountEstimate: Rough estimate of the scene's length in words

Return your response as a JSON array of scene objects.

MANUSCRIPT:
${truncated}

Respond ONLY with a valid JSON array. No other text.`;

    const response = await this.llm.generate(prompt, {
      temperature: 0.3,
      maxTokens: 4000
    });

    try {
      const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const scenes = JSON.parse(cleaned);

      if (!Array.isArray(scenes)) {
        throw new Error('Expected JSON array');
      }

      return scenes;
    } catch (err) {
      throw new Error(`Failed to parse AI scene inventory: ${err.message}`);
    }
  }

  async _aiCheckContinuity(projectId, manuscriptText) {
    const maxChars = 30000;
    const truncated = manuscriptText.length > maxChars
      ? manuscriptText.substring(0, maxChars) + '\n\n[... truncated for analysis ...]'
      : manuscriptText;

    // Also load existing world rules and characters for cross-reference
    let contextBlock = '';
    try {
      const characters = await this.storage.getCharacters(projectId) || [];
      const worldRules = await this.storage.getWorldRules(projectId) || [];

      if (characters.length > 0) {
        contextBlock += '\n\nESTABLISHED CHARACTERS:\n';
        for (const c of characters.slice(0, 30)) {
          contextBlock += `- ${c.name}: ${(c.description || '').substring(0, 100)}\n`;
        }
      }

      if (worldRules.length > 0) {
        contextBlock += '\n\nESTABLISHED WORLD RULES:\n';
        for (const r of worldRules.slice(0, 30)) {
          contextBlock += `- ${r.title}: ${(r.description || '').substring(0, 100)}\n`;
        }
      }
    } catch (e) {
      // Non-critical, continue without context
    }

    const prompt = `Analyze the following manuscript for continuity issues, contradictions, and inconsistencies. Look for:
- Character inconsistencies (name spelling changes, contradictory descriptions, out-of-character behavior)
- Timeline problems (events out of order, impossible timing)
- Setting contradictions (locations described differently)
- World rule violations (if established rules are provided below)
- Plot holes or logical inconsistencies
- Factual contradictions within the text

For each issue found, provide:
- severity: "high", "medium", or "low"
- type: The category of issue (character, timeline, setting, world_rule, plot_hole, factual)
- description: What the issue is
- location: Where approximately in the text this occurs
- suggestion: How it might be fixed
${contextBlock}

MANUSCRIPT:
${truncated}

Return your response as a JSON array of issue objects. If no issues are found, return an empty array [].
Respond ONLY with a valid JSON array. No other text.`;

    const response = await this.llm.generate(prompt, {
      temperature: 0.3,
      maxTokens: 4000
    });

    try {
      const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const issues = JSON.parse(cleaned);

      if (!Array.isArray(issues)) {
        throw new Error('Expected JSON array');
      }

      return issues;
    } catch (err) {
      throw new Error(`Failed to parse AI continuity check: ${err.message}`);
    }
  }

  _parseJsonResponse(response, fallback) {
    try {
      const jsonMatch = response.match(/[\[{][\s\S]*[\]}]/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : fallback;
    } catch {
      return fallback;
    }
  }
}
