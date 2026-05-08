// src/services/importOrchestrator.js
import {
  parseMultipleFiles,
  applyImport,
  CATEGORY_LABELS
} from './importService.js';
import { parseManuscript } from './importManuscript.js';
import {
  extractCharacters as fallbackExtractCharacters,
  extractWorldRules as fallbackExtractWorldRules,
  deriveBeatMap as fallbackDeriveBeatMap,
  buildSceneInventory as fallbackBuildSceneInventory,
  checkContinuity as fallbackCheckContinuity
} from './analysisService.js';

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
   * Implementation based on User's detectFileCategory specification.
   */
  static classifyFile(fileName, content) {
    const lower = fileName.toLowerCase();
    const text = content || '';
    const textLower = text.toLowerCase();

    // ── Manuscript detection (check FIRST) ──
    const manuscriptSignals = [
      /\b(prologue|epilogue)\b/i,
      /^#{1,3}\s*(chapter|ch\.?\s*\d)/im,
      /\bCHAPTER\s+[IVXLCDM\d]+/m,
      /\bPART\s+(ONE|TWO|THREE|FOUR|[IVXLCDM]+|\d+)\b/i,
      /^#{1,2}\s*\*\*[A-Z]/m,
    ];

    const signalHits = manuscriptSignals.filter(rx => rx.test(text)).length;
    const isLargeFile = text.length > 5000;
    const hasMultipleHeadings = (text.match(/^#{1,3}\s+/gm) || []).length >= 3;
    const hasDraftInName = /draft|manuscript|novel|book|complete/i.test(lower);

    // If it looks like a manuscript, classify it as one
    if (
      (signalHits >= 2) ||
      (signalHits >= 1 && isLargeFile) ||
      (isLargeFile && hasMultipleHeadings) ||
      (hasDraftInName && isLargeFile)
    ) {
      return { suggestedType: 'manuscript', confidence: 'high', reason: 'Structural signals suggest a full manuscript' };
    }

    // ── Other categories ──
    if (/character|cast|persona/i.test(lower)) {
      return { suggestedType: 'characters', confidence: 'high', reason: 'Filename suggests character profiles' };
    }
    if (/scene|sequence/i.test(lower)) {
      return { suggestedType: 'scenes', confidence: 'high', reason: 'Filename suggests scene drafts' };
    }
    if (/world|setting|lore|magic|rule|bible/i.test(lower)) {
      return { suggestedType: 'worldbuilding', confidence: 'high', reason: 'Filename suggests world-building document' };
    }
    if (/outline|structure|beat|plot|synopsis/i.test(lower)) {
      return { suggestedType: 'outline', confidence: 'high', reason: 'Filename suggests outline or beat sheet' };
    }

    // Content-based fallbacks
    if (/\bage\b.*\bappearance\b|\bmotivation\b.*\bflaw\b/i.test(textLower)) {
      return { suggestedType: 'characters', confidence: 'medium', reason: 'Content contains character-profile keywords' };
    }
    if (/\bint\.\b|\bext\.\b|\bfade in\b/i.test(textLower)) {
      return { suggestedType: 'scenes', confidence: 'medium', reason: 'Content contains screenplay-style scene headers' };
    }

    return { suggestedType: 'notes', confidence: 'low', reason: 'Default fallback' };
  }

  static inferProjectTitle(fileName, parsedTitle) {
    const fileBase = (fileName || "Imported Project").replace(/\.[^.]+$/, "").trim();
    const candidate = String(parsedTitle || "").trim();
    if (!candidate) return fileBase;

    const chapterLike = /^(?:\*+\s*)?(prologue|epilogue|chapter\b|part\b)/i.test(candidate);
    if (chapterLike) return fileBase;
    return candidate;
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

      if (fileType === 'characters') {
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

      if (fileType === 'worldbuilding') {
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
    const runId = `import_${Date.now().toString(36)}`;
    const debugState = {
      runId,
      projectId,
      startedAt: new Date().toISOString(),
      files: files.map(file => ({
        id: file.id,
        fileName: file.fileName,
        category: file.category,
        size: file.fileSize || file.content?.length || 0
      })),
      options,
      events: []
    };
    this._debug('start', debugState);

    const manuscriptFiles = files.filter(file => file.category === 'manuscript');
    const auxiliaryFiles = files.filter(file => file.category !== 'manuscript');
    let targetProjectId = projectId || null;
    let targetProject = targetProjectId ? await this.storage.getProject(targetProjectId) : null;

    if (manuscriptFiles.length > 0 && typeof this.storage.createProject === 'function') {
      const seed = parseManuscript(manuscriptFiles[0].content || manuscriptFiles[0].text || '', {});
      const manuscriptTitle = String(options?.projectTitle || '').trim() || ImportOrchestrator.inferProjectTitle(manuscriptFiles[0].fileName, seed.title);
      const createdProject = await this.storage.createProject({
        title: manuscriptTitle,
        core: {
          title: manuscriptTitle,
          wcCurrent: String(seed.stats?.totalWords || 0),
          wc: String(seed.stats?.totalWords || 0),
          constraint: '',
          genre: '',
          theme: '',
          falseBelief: ''
        },
        voice: {},
        chars: [],
        rules: [],
        beats: [],
        metadata: {
          importedAt: Date.now(),
          source: 'manuscript-import',
          manuscriptStats: seed.stats || null
        }
      });
      targetProjectId = createdProject.id;
      targetProject = await this.storage.getProject(targetProjectId);
      this._debug('project-created', { runId, targetProjectId, title: manuscriptTitle });
    }

    if (!targetProject && typeof this.storage.createProject === 'function') {
      const fallbackTitle = files[0]?.fileName
        ? files[0].fileName.replace(/\.[^.]+$/, '')
        : 'Imported Project';
      const createdProject = await this.storage.createProject({
        title: fallbackTitle,
        core: {
          title: fallbackTitle
        },
        voice: {},
        chars: [],
        rules: [],
        beats: [],
        metadata: {
          importedAt: Date.now(),
          source: 'generic-import'
        }
      });
      targetProjectId = createdProject.id;
      targetProject = await this.storage.getProject(targetProjectId);
      this._debug('project-created-fallback', { runId, targetProjectId, title: fallbackTitle });
    }

    if (!targetProject) {
      throw new Error("No target project available for import");
    }
    this._debug('loaded-project', {
      runId,
      targetProjectId,
      projectTitle: targetProject.title,
      chapterCount: targetProject.chapters?.length || 0,
      charCount: targetProject.chars?.length || targetProject.characters?.length || 0
    });

    // Map resolutions from options.conflicts
    const resolutions = {};
    if (options.conflicts) {
      options.conflicts.forEach(c => {
        resolutions[c.id] = c.resolution;
      });
    }

    if (onProgress) onProgress({ current: 0, total: 100, message: "Applying import logic..." });

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
      scenesAdded: 0
    };
    let createdChapterIds = [];
    let createdSceneIds = [];

    if (manuscriptFiles.length > 0) {
      for (const manuscriptFile of manuscriptFiles) {
        const parsed = parseManuscript(manuscriptFile.content || manuscriptFile.text || '', {});
        const imported = await this._importParsedManuscript(targetProjectId, parsed, manuscriptFile.fileName);
        createdChapterIds = createdChapterIds.concat(imported.chapterIds);
        createdSceneIds = createdSceneIds.concat(imported.sceneIds);
        summary.chaptersAdded += imported.chapterIds.length;
        summary.scenesAdded += imported.sceneIds.length;
        changelog.push(...imported.changelog);
        this._debug('manuscript-imported', {
          runId,
          fileName: manuscriptFile.fileName,
          chapters: imported.chapterIds.length,
          scenes: imported.sceneIds.length,
          stats: parsed.stats
        });
      }
    }

    let updatedProject = targetProject;
    if (auxiliaryFiles.length > 0) {
      const applied = await applyImport(targetProject, auxiliaryFiles, resolutions);
      updatedProject = applied.updatedProject;
      changelog.push(...applied.changelog);
      warnings.push(...applied.warnings);
      Object.entries(applied.summary).forEach(([key, value]) => {
        summary[key] = (summary[key] || 0) + value;
      });
      this._debug('apply-import-complete', { runId, summary: applied.summary, warnings: applied.warnings, changelog: applied.changelog });
    }

    // Save updated project back to storage
    if (onProgress) onProgress({ current: 50, total: 100, message: "Saving changes to database..." });

    if (typeof this.storage.updateProjectData === 'function') {
      await this.storage.updateProjectData(targetProjectId, {
        chars: updatedProject.characters || updatedProject.chars || [],
        rules: updatedProject.worldRules || updatedProject.rules || [],
        beats: updatedProject.beats || [],
        voice: updatedProject.voice || {},
        core: updatedProject.core || targetProject.core || {}
      });
    } else {
      await this.storage.updateProjectMetadata({
        chars: updatedProject.characters || updatedProject.chars || [],
        rules: updatedProject.worldRules || updatedProject.rules || [],
        beats: updatedProject.beats || [],
        voice: updatedProject.voice || {}
      });
    }

    // Handle manuscript chapters and scenes
    // For simplicity in this implementation, we'll assume applyImport handled the array
    // and we need to persist them to the separate Chapter/Scene stores if they changed.
    for (const chapter of (updatedProject.chapters || [])) {
      if (chapter.id.startsWith('imp_')) {
        // This is a new chapter from importService
        const newChapter = await this._createChapter(targetProjectId, {
          projectId,
          title: chapter.title,
          order: chapter.order,
          importedAt: chapter.importedAt
        });
        createdChapterIds.push(newChapter.id);
        this._debug('chapter-created', { runId, chapterId: newChapter.id, title: newChapter.title });

        // Split content into scenes if needed, or just one big scene
        const newScene = await this._createScene(targetProjectId, {
          projectId,
          chapterId: newChapter.id,
          title: "Imported Content",
          text: chapter.content,
          order: 0
        });
        createdSceneIds.push(newScene.id);
        this._debug('scene-created', { runId, sceneId: newScene.id, chapterId: newChapter.id, title: newScene.title });
      } else {
        // Check if it was updated
        const isUpdated = changelog.find(c => c.type === 'Chapter' && c.detail === chapter.title && (c.action === 'Updated' || c.action === 'Merged'));
        if (isUpdated) {
          await this.storage.updateChapter(targetProjectId, chapter.id, {
            title: chapter.title,
            order: chapter.order
          });
          // Update the first scene's text
          const scenes = await this._getScenesForChapter(chapter.id, targetProjectId);
          if (scenes && scenes.length > 0) {
            await this.storage.updateSceneText(scenes[0].id, chapter.content);
            this._debug('scene-updated', { runId, sceneId: scenes[0].id, chapterId: chapter.id, title: chapter.title });
          }
        }
      }
    }

    const manuscriptText = manuscriptFiles
      .map(file => file.content || file.text || '')
      .join('\n\n---\n\n')
      .trim();

    const analysisResults = {};
    if (manuscriptText && this.llm?.generate) {
      const analysisOptions = {
        autoSaveExtracted: true,
        extractCharacters: true,
        extractWorldRules: true,
        deriveBeatMap: true,
        buildSceneInventory: true,
        checkContinuity: true
      };
      try {
        if (onProgress) onProgress({ current: 72, total: 100, message: 'Extracting characters...' });
        const characterReport = {
          charactersImported: 0
        };
        analysisResults.characters = await this._aiExtractCharacters(targetProjectId, manuscriptText, analysisOptions, characterReport);
        summary.charactersAdded += characterReport.charactersImported;
        this._debug('analysis-saved', { runId, phase: 'characters', saved: characterReport.charactersImported });
      } catch (err) {
        warnings.push(`Character extraction failed: ${err.message}`);
        this._debug('analysis-error', { runId, phase: 'characters', error: err.message });
      }

      try {
        if (onProgress) onProgress({ current: 78, total: 100, message: 'Extracting world rules...' });
        const ruleReport = {
          worldRulesImported: 0
        };
        analysisResults.worldRules = await this._aiExtractWorldRules(targetProjectId, manuscriptText, analysisOptions, ruleReport);
        summary.rulesAdded += ruleReport.worldRulesImported;
        this._debug('analysis-saved', { runId, phase: 'worldRules', saved: ruleReport.worldRulesImported });
      } catch (err) {
        warnings.push(`World rule extraction failed: ${err.message}`);
        this._debug('analysis-error', { runId, phase: 'worldRules', error: err.message });
      }

      try {
        if (onProgress) onProgress({ current: 84, total: 100, message: 'Deriving beat map...' });
        const beatReport = {
          beatsImported: 0
        };
        analysisResults.beats = await this._aiDeriveBeatMap(targetProjectId, manuscriptText, analysisOptions, beatReport);
        summary.beatsAdded += beatReport.beatsImported;
        this._debug('analysis-saved', { runId, phase: 'beats', saved: beatReport.beatsImported });
      } catch (err) {
        warnings.push(`Beat-map derivation failed: ${err.message}`);
        this._debug('analysis-error', { runId, phase: 'beats', error: err.message });
      }

      try {
        if (onProgress) onProgress({ current: 90, total: 100, message: 'Building scene inventory...' });
        analysisResults.scenes = await this._aiBuildSceneInventory(targetProjectId, manuscriptText);
        await this._applySceneInventory(targetProjectId, createdSceneIds, analysisResults.scenes);
        this._debug('analysis-saved', { runId, phase: 'scenes', saved: analysisResults.scenes?.length || 0 });
      } catch (err) {
        warnings.push(`Scene inventory generation failed: ${err.message}`);
        this._debug('analysis-error', { runId, phase: 'scenes', error: err.message });
      }

      try {
        if (onProgress) onProgress({ current: 95, total: 100, message: 'Checking continuity...' });
        analysisResults.continuityIssues = await this._aiCheckContinuity(targetProjectId, manuscriptText);
        this._debug('analysis-saved', { runId, phase: 'continuity', saved: analysisResults.continuityIssues?.length || 0 });
      } catch (err) {
        warnings.push(`Continuity check failed: ${err.message}`);
        this._debug('analysis-error', { runId, phase: 'continuity', error: err.message });
      }

      await this._applyCoreMetadata(targetProjectId, manuscriptFiles[0], manuscriptText, analysisResults);
    }

    if (onProgress) onProgress({ current: 100, total: 100, message: "Import complete!" });
    this._debug('complete', {
      runId,
      summary,
      createdChapterIds,
      createdSceneIds,
      finishedAt: new Date().toISOString()
    });

    return {
      summary,
      changelog,
      warnings,
      analysisResults,
      createdChapterIds,
      createdSceneIds,
      newChapterId: createdChapterIds[0] || null,
      newSceneId: createdSceneIds[0] || null,
      targetProjectId,
      runId
    };
  }

  async _importParsedManuscript(projectId, parsed, fileName) {
    const chapterIds = [];
    const sceneIds = [];
    const changelog = [];

    for (const chapter of parsed.chapters) {
      const createdChapter = await this._createChapter(projectId, {
        title: chapter.title,
        order: chapter.order,
        importedAt: new Date().toISOString(),
        importedFrom: fileName
      });
      chapterIds.push(createdChapter.id);
      changelog.push({ action: 'Added', type: 'Chapter', detail: chapter.title });

      for (const scene of chapter.scenes) {
        const createdScene = await this._createScene(projectId, {
          chapterId: createdChapter.id,
          title: scene.title,
          text: scene.content,
          order: scene.order,
          status: 'Draft',
          importedAt: new Date().toISOString(),
          importedFrom: fileName,
          wordCount: scene.wordCount
        });
        sceneIds.push(createdScene.id);
        changelog.push({ action: 'Added', type: 'Scene', detail: `${chapter.title} / ${scene.title}` });
      }
    }

    return { chapterIds, sceneIds, changelog };
  }

  async _applySceneInventory(projectId, sceneIds, inventory) {
    if (!Array.isArray(inventory) || inventory.length === 0) return;
    if (typeof this.storage.updateSceneMetadata !== 'function') return;

    for (let index = 0; index < Math.min(sceneIds.length, inventory.length); index++) {
      const sceneId = sceneIds[index];
      const item = inventory[index];
      await this.storage.updateSceneMetadata(sceneId, {
        title: item.title || `Scene ${index + 1}`,
        location: item.location || item.setting || '',
        time: item.timeOfDay || '',
        causality: item.purpose || '',
        output: item.summary || '',
        objects: Array.isArray(item.characters) ? item.characters.join(', ') : '',
        status: 'Draft'
      });
    }
  }

  async _applyCoreMetadata(projectId, manuscriptFile, manuscriptText, analysisResults) {
    if (typeof this.storage.updateProjectData !== 'function') return;

    const title = manuscriptFile.fileName.replace(/\.[^.]+$/, '');
    const wordCount = manuscriptText.split(/\s+/).filter(Boolean).length;
    const leadCharacter = analysisResults.characters?.[0]?.name || '';
    const firstBeat = analysisResults.beats?.[0]?.title || '';

    await this.storage.updateProjectData(projectId, {
      core: {
        title,
        wcCurrent: String(wordCount),
        wc: String(wordCount),
        constraint: firstBeat || '',
        theme: '',
        falseBelief: '',
        protagonist: leadCharacter
      }
    });
  }

  _debug(event, payload) {
    if (typeof window !== 'undefined') {
      const state = window.__PROSELAB_IMPORT_DEBUG__ || { runs: [] };
      state.runs.push({
        event,
        payload,
        at: new Date().toISOString()
      });
      window.__PROSELAB_IMPORT_DEBUG__ = state;
    }
    console.log(`[ImportOrchestrator] ${event}`, payload);
  }

  async _createChapter(projectId, data) {
    if (typeof this.storage.saveChapter === 'function') {
      return await this.storage.saveChapter(projectId, data);
    }
    if (typeof this.storage.createChapter === 'function') {
      return await this.storage.createChapter({ ...data, projectId });
    }
    throw new Error('Storage adapter is missing chapter creation methods');
  }

  async _createScene(projectId, data) {
    if (typeof this.storage.saveScene === 'function') {
      return await this.storage.saveScene(projectId, data);
    }
    if (typeof this.storage.createScene === 'function') {
      return await this.storage.createScene({ ...data, projectId });
    }
    throw new Error('Storage adapter is missing scene creation methods');
  }

  async _getScenesForChapter(chapterId, projectId) {
    if (typeof this.storage.listScenes === 'function') {
      return await this.storage.listScenes(chapterId);
    }
    if (typeof this.storage.getScenes === 'function') {
      const scoped = await this.storage.getScenes(chapterId);
      if (Array.isArray(scoped) && scoped.every(scene => scene.chapterId === chapterId)) {
        return scoped;
      }
      return Array.isArray(scoped)
        ? scoped.filter(scene => scene.chapterId === chapterId)
        : [];
    }
    if (typeof this.storage.getChapterScenes === 'function') {
      return await this.storage.getChapterScenes(projectId, chapterId);
    }
    return [];
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
    try {
      const maxChars = 30000;
      const truncated = manuscriptText.length > maxChars ? manuscriptText.substring(0, maxChars) + '\n\n[... truncated ...]' : manuscriptText;
      const prompt = `Analyze the following manuscript text and extract all characters mentioned. Return a JSON array of objects with: name, role, description, traits, relationships. Respond ONLY with JSON.\n\nMANUSCRIPT:\n${truncated}`;
      const response = await this.llm.generate(prompt, { temperature: 0.3, maxTokens: 4000 });
      const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const characters = JSON.parse(cleaned);
      await this._persistCharacters(projectId, characters, report);
      return characters;
    } catch (err) {
      console.warn('[ImportOrchestrator] character extraction falling back', err);
      const characters = await fallbackExtractCharacters(manuscriptText);
      await this._persistCharacters(projectId, characters, report);
      return characters;
    }
  }

  async _aiExtractWorldRules(projectId, manuscriptText, options, report) {
    try {
      const maxChars = 30000;
      const truncated = manuscriptText.length > maxChars ? manuscriptText.substring(0, maxChars) + '\n\n[... truncated ...]' : manuscriptText;
      const prompt = `Analyze the manuscript and extract world-building rules. Return a JSON array of objects with: title, category, description, evidence. Respond ONLY with JSON.\n\nMANUSCRIPT:\n${truncated}`;
      const response = await this.llm.generate(prompt, { temperature: 0.3, maxTokens: 4000 });
      const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const rules = JSON.parse(cleaned);
      await this._persistWorldRules(projectId, rules, report);
      return rules;
    } catch (err) {
      console.warn('[ImportOrchestrator] world-rule extraction falling back', err);
      const rules = await fallbackExtractWorldRules(manuscriptText);
      await this._persistWorldRules(projectId, rules, report);
      return rules;
    }
  }

  async _aiDeriveBeatMap(projectId, manuscriptText, options, report) {
    try {
      const maxChars = 30000;
      const truncated = manuscriptText.length > maxChars ? manuscriptText.substring(0, maxChars) + '\n\n[... truncated ...]' : manuscriptText;
      const prompt = `Analyze the manuscript and derive a story beat map. Return a JSON array of objects with: order, title, type, description, approximateLocation. Respond ONLY with JSON.\n\nMANUSCRIPT:\n${truncated}`;
      const response = await this.llm.generate(prompt, { temperature: 0.3, maxTokens: 4000 });
      const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const beats = JSON.parse(cleaned);
      await this._persistBeats(projectId, beats, report);
      return beats;
    } catch (err) {
      console.warn('[ImportOrchestrator] beat derivation falling back', err);
      const beats = await fallbackDeriveBeatMap(manuscriptText);
      await this._persistBeats(projectId, beats, report);
      return beats;
    }
  }

  async _aiBuildSceneInventory(projectId, manuscriptText) {
    try {
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

      const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const scenes = JSON.parse(cleaned);

      if (!Array.isArray(scenes)) {
        throw new Error('Expected JSON array');
      }

      return scenes;
    } catch (err) {
      console.warn('[ImportOrchestrator] scene inventory falling back', err);
      return await fallbackBuildSceneInventory(manuscriptText);
    }
  }

  async _aiCheckContinuity(projectId, manuscriptText) {
    try {
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
            contextBlock += `- ${c.name}: ${(c.description || c.Psychology || '').substring(0, 100)}\n`;
          }
        }

        if (worldRules.length > 0) {
          contextBlock += '\n\nESTABLISHED WORLD RULES:\n';
          for (const r of worldRules.slice(0, 30)) {
            contextBlock += `- ${r.title || r.rule}: ${(r.description || r.consequence || '').substring(0, 100)}\n`;
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

      const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const issues = JSON.parse(cleaned);

      if (!Array.isArray(issues)) {
        throw new Error('Expected JSON array');
      }

      return issues;
    } catch (err) {
      console.warn('[ImportOrchestrator] continuity analysis falling back', err);
      return await fallbackCheckContinuity(manuscriptText);
    }
  }

  async _persistCharacters(projectId, characters, report) {
    if (!Array.isArray(characters)) return;
    for (const char of characters) {
      const existing = await this.storage.getCharacters(projectId);
      if (!existing.find(e => e.name?.toLowerCase().trim() === (char.name || '').toLowerCase().trim())) {
        await this.storage.createCharacter(projectId, {
          id: crypto.randomUUID(),
          name: char.name || 'Unknown Character',
          role: char.role || '',
          archetype: char.archetype || char.role || '',
          motivation: Array.isArray(char.relationships) ? char.relationships.join(', ') : (char.motivation || ''),
          Physiology: char.description || char.appearance || '',
          Psychology: Array.isArray(char.traits) ? char.traits.join(', ') : (char.traits || ''),
          trait: Array.isArray(char.traits) ? char.traits[0] || '' : (char.traits || ''),
          source: char.source || 'ai-extracted',
          importedAt: new Date().toISOString()
        });
        report.charactersImported++;
      }
    }
  }

  async _persistWorldRules(projectId, rules, report) {
    if (!Array.isArray(rules)) return;
    for (const rule of rules) {
      const existing = await this.storage.getWorldRules(projectId);
      if (!existing.find(e => (e.title || e.rule || '').toLowerCase().trim() === (rule.title || '').toLowerCase().trim())) {
        await this.storage.createWorldRule(projectId, {
          id: crypto.randomUUID(),
          title: rule.title || 'Imported Rule',
          rule: rule.title || 'Imported Rule',
          category: rule.category || 'general',
          description: rule.description || rule.content || '',
          consequence: rule.description || rule.content || '',
          evidence: rule.evidence || '',
          limit: '',
          source: rule.source || 'ai-extracted',
          importedAt: new Date().toISOString()
        });
        report.worldRulesImported++;
      }
    }
  }

  async _persistBeats(projectId, beats, report) {
    if (!Array.isArray(beats)) return;
    for (let index = 0; index < beats.length; index++) {
      const beat = beats[index];
      await this.storage.createBeat(projectId, {
        id: crypto.randomUUID(),
        order: beat.order ?? index + 1,
        pct: this._normalizeBeatPct(beat.approximateLocation, beat.order ?? index + 1),
        title: beat.title || 'Imported Beat',
        type: beat.type || 'beat',
        description: beat.description || beat.summary || '',
        source: beat.source || 'ai-derived',
        importedAt: new Date().toISOString()
      });
      report.beatsImported++;
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

  _normalizeBeatPct(location, order = 1) {
    if (typeof location === 'number') return String(location);
    const lower = String(location || '').toLowerCase();
    if (lower.includes('begin')) return '5';
    if (lower.includes('early')) return '20';
    if (lower.includes('first_quarter')) return '25';
    if (lower.includes('middle') || lower.includes('mid')) return '50';
    if (lower.includes('third_quarter')) return '75';
    if (lower.includes('late')) return '85';
    if (lower.includes('end')) return '95';
    return String(Math.min(95, Math.max(5, order * 10)));
  }
}
