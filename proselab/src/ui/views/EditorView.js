export class EditorView extends Component {
  constructor(props) {
    super(props);
    this.currentChapterIndex = 0;
    this.aiPanelOpen = false;
    this.autoSaveTimer = null;
    this.lastSavedContent = '';
  }

  template() {
    const project = this.props.store.currentProject;
    if (!project) return '<div class="loading">Loading project...</div>';

    return `
      <div class="editor-layout ${this.aiPanelOpen ? 'ai-panel-open' : ''}">
        <div class="editor-pane">
          <div class="editor-toolbar" id="editor-toolbar">
            <div class="toolbar-group">
              <button class="btn-icon toolbar-btn" data-action="bold" title="Bold (Ctrl+B)"><b>B</b></button>
              <button class="btn-icon toolbar-btn" data-action="italic" title="Italic (Ctrl+I)"><i>I</i></button>
              <button class="btn-icon toolbar-btn" data-action="heading" title="Heading">H</button>
              <span class="toolbar-sep"></span>
              <button class="btn-icon toolbar-btn" data-action="quote" title="Block quote">❝</button>
              <button class="btn-icon toolbar-btn" data-action="divider" title="Scene divider">—</button>
              <span class="toolbar-sep"></span>
              <button class="btn-icon toolbar-btn" data-action="undo" title="Undo (Ctrl+Z)">↩</button>
              <button class="btn-icon toolbar-btn" data-action="redo" title="Redo (Ctrl+Y)">↪</button>
            </div>
            <div class="toolbar-group">
              <select class="toolbar-select" id="focus-mode-select">
                <option value="normal">Normal</option>
                <option value="focus">Focus Mode</option>
                <option value="typewriter">Typewriter</option>
              </select>
              <button class="btn-icon toolbar-btn" id="btn-fullscreen" title="Fullscreen">⛶</button>
            </div>
          </div>
          <div class="editor-container" id="editor-container"></div>
          <div class="editor-status-bar" id="editor-status-bar">
            <span id="status-save">Saved</span>
            <span id="status-position">Ln 1, Col 1</span>
          </div>
        </div>
        <div class="ai-panel-container" id="ai-panel-container"></div>
      </div>
    `;
  }

  afterMount() {
    const project = this.props.store.currentProject;
    if (!project) return;

    // Initialize the text editor
    const chapter = project.chapters?.[this.currentChapterIndex];
    this.editor = new TextEditor({
      content: chapter?.content || '',
      placeholder: 'Begin writing your story...',
      onChange: (content) => this.handleContentChange(content),
      onSelectionChange: (selection) => this.handleSelectionChange(selection),
      onCursorMove: (pos) => this.updateCursorPosition(pos),
    });
    this.editor.mount(this.$('#editor-container'));
    this.children.push(this.editor);

    this.lastSavedContent = chapter?.content || '';

    // Initialize AI panel
    this.aiPanel = new AIPanel({
      assistant: this.props.assistant,
      editor: this.editor,
      store: this.props.store,
      onInsert: (text) => this.editor.insertAtCursor(text),
      onReplace: (text) => this.editor.replaceSelection(text),
    });
    this.aiPanel.mount(this.$('#ai-panel-container'));
    this.children.push(this.aiPanel);

    // Toolbar actions
    this.on(this.$('#editor-toolbar'), 'click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (btn) this.handleToolbarAction(btn.dataset.action);
    });

    // Focus mode
    this.on(this.$('#focus-mode-select'), 'change', (e) => {
      this.setFocusMode(e.target.value);
    });

    // Fullscreen
    this.on(this.$('#btn-fullscreen'), 'click', () => this.toggleFullscreen());

    // Listen for sidebar events
    this.on(this.el, 'chapter-select', (e) => this.switchChapter(e.detail.chapterId));
    this.on(this.el, 'chapter-add', () => this.addChapter());
    this.on(this.el, 'character-add', () => this.showCharacterModal());
    this.on(this.el, 'note-add', () => this.showNoteModal());
    this.on(this.el, 'ai-panel-toggle', () => this.toggleAIPanel());
    this.on(this.el, 'chapters-reorder', (e) => this.reorderChapters(e.detail.order));
    this.on(this.el, 'export-request', () => this.showExportModal());

    // Keyboard shortcuts
    this.on(document, 'keydown', (e) => this.handleKeyboard(e));

    // Auto-save
    this.startAutoSave();

    // Update header word count
    this.updateWordCount();
  }

  handleContentChange(content) {
    this.updateWordCount();
    this.markUnsaved();
  }

  handleSelectionChange(selection) {
    // Could show selection-specific toolbar or AI options
  }

  updateCursorPosition(pos) {
    const statusPos = this.$('#status-position');
    if (statusPos) {
      statusPos.textContent = `Ln ${pos.line}, Col ${pos.col}`;
    }
  }

  updateWordCount() {
    const content = this.editor?.getContent() || '';
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    const chars = content.length;

    // Update header bar word count
    const headerBar = document.querySelector('.header-bar');
    if (headerBar) {
      const wcWords = headerBar.querySelector('#wc-words');
      const wcChars = headerBar.querySelector('#wc-chars');
      if (wcWords) wcWords.textContent = `${words.toLocaleString()} words`;
      if (wcChars) wcChars.textContent = `${chars.toLocaleString()} chars`;
    }
  }

  markUnsaved() {
    const statusSave = this.$('#status-save');
    if (statusSave) {
      statusSave.textContent = 'Unsaved changes';
      statusSave.classList.add('unsaved');
    }
  }

  markSaved() {
    const statusSave = this.$('#status-save');
    if (statusSave) {
      statusSave.textContent = 'Saved';
      statusSave.classList.remove('unsaved');
    }
  }

  startAutoSave() {
    this.autoSaveTimer = setInterval(() => {
      this.saveCurrentChapter();
    }, 5000);
    this.cleanups.push(() => clearInterval(this.autoSaveTimer));
  }

  async saveCurrentChapter() {
    const content = this.editor?.getContent();
    if (content === undefined || content === this.lastSavedContent) return;

    const project = this.props.store.currentProject;
    if (!project) return;

    const chapter = project.chapters?.[this.currentChapterIndex];
    if (!chapter) return;

    chapter.content = content;
    chapter.updatedAt = new Date().toISOString();
    project.updatedAt = new Date().toISOString();

    // Calculate word count for the chapter
    chapter.wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

    // Calculate total project word count
    project.wordCount = (project.chapters || []).reduce(
      (sum, ch) => sum + (ch.wordCount || 0), 0
    );

    await this.props.store.saveProject(project);
    this.lastSavedContent = content;
    this.markSaved();
  }

  async switchChapter(chapterId) {
    // Save current chapter first
    await this.saveCurrentChapter();

    const project = this.props.store.currentProject;
    const index = project.chapters.findIndex((ch) => ch.id === chapterId);
    if (index === -1) return;

    this.currentChapterIndex = index;
    const chapter = project.chapters[index];
    this.editor.setContent(chapter.content || '');
    this.lastSavedContent = chapter.content || '';
    this.markSaved();
    this.updateWordCount();

    // Update sidebar active state
    this.el.closest('.app-body')?.querySelector('.sidebar')?.dispatchEvent(
      new CustomEvent('update-active-chapter', { detail: { chapterId } })
    );
  }

  async addChapter() {
    const project = this.props.store.currentProject;
    if (!project.chapters) project.chapters = [];

    const newChapter = {
      id: `ch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: `Chapter ${project.chapters.length + 1}`,
      content: '',
      wordCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notes: [],
    };

    project.chapters.push(newChapter);
    await this.props.store.saveProject(project);

    // Switch to the new chapter
    this.currentChapterIndex = project.chapters.length - 1;
    this.editor.setContent('');
    this.lastSavedContent = '';

    // Refresh sidebar
    this.emit('project-updated');
    this.refreshSidebar();
  }

  async reorderChapters(order) {
    const project = this.props.store.currentProject;
    const reordered = order.map((id) => project.chapters.find((ch) => ch.id === id)).filter(Boolean);
    project.chapters = reordered;
    await this.props.store.saveProject(project);
  }

  handleToolbarAction(action) {
    if (!this.editor) return;

    switch (action) {
      case 'bold':
        this.editor.wrapSelection('**', '**');
        break;
      case 'italic':
        this.editor.wrapSelection('*', '*');
        break;
      case 'heading':
        this.editor.prefixLine('## ');
        break;
      case 'quote':
        this.editor.prefixLine('> ');
        break;
      case 'divider':
        this.editor.insertAtCursor('\n\n---\n\n');
        break;
      case 'undo':
        this.editor.undo();
        break;
      case 'redo':
        this.editor.redo();
        break;
    }
  }

  setFocusMode(mode) {
    const container = this.$('#editor-container');
    if (!container) return;

    container.classList.remove('focus-mode', 'typewriter-mode');
    if (mode === 'focus') container.classList.add('focus-mode');
    if (mode === 'typewriter') container.classList.add('typewriter-mode');

    this.editor?.setFocusMode(mode);
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      this.el.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }

  toggleAIPanel() {
    this.aiPanelOpen = !this.aiPanelOpen;
    const layout = this.el.querySelector('.editor-layout');
    if (layout) {
      layout.classList.toggle('ai-panel-open', this.aiPanelOpen);
    }
  }

  showCharacterModal() {
    const modal = new CharacterModal({
      store: this.props.store,
      onSave: async (character) => {
        const project = this.props.store.currentProject;
        if (!project.characters) project.characters = [];
        project.characters.push(character);
        await this.props.store.saveProject(project);
        this.refreshSidebar();
        modal.close();
      },
    });
    modal.open();
    this.children.push(modal);
  }

  showNoteModal() {
    const modal = new NoteModal({
      store: this.props.store,
      onSave: async (note) => {
        const project = this.props.store.currentProject;
        if (!project.notes) project.notes = [];
        project.notes.push(note);
        await this.props.store.saveProject(project);
        this.refreshSidebar();
        modal.close();
      },
    });
    modal.open();
    this.children.push(modal);
  }

  showExportModal() {
    const modal = new ExportModal({
      store: this.props.store,
      project: this.props.store.currentProject,
    });
    modal.open();
    this.children.push(modal);
  }

  refreshSidebar() {
    const sidebarEl = document.getElementById('sidebar');
    if (sidebarEl && sidebarEl.__component) {
      sidebarEl.__component.update({
        view: 'editor',
        project: this.props.store.currentProject,
        currentChapterId: this.props.store.currentProject.chapters?.[this.currentChapterIndex]?.id,
      });
    }
    // Fallback: emit event
    this.emit('project-updated');
  }

  handleKeyboard(e) {
    // Ctrl/Cmd + S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      this.saveCurrentChapter();
    }
    // Ctrl/Cmd + B for bold
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      this.handleToolbarAction('bold');
    }
    // Ctrl/Cmd + I for italic
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
      e.preventDefault();
      this.handleToolbarAction('italic');
    }
    // Escape to close AI panel
    if (e.key === 'Escape' && this.aiPanelOpen) {
      this.toggleAIPanel();
    }
  }

  unmount() {
    this.saveCurrentChapter();
    super.unmount();
  }
}
