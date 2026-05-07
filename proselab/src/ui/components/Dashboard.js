export class Dashboard extends Component {
  constructor(props) {
    super(props);
    this.filter = 'all';
    this.sortBy = 'modified';
  }

  template() {
    const { projects = [], templates = [] } = this.props;

    const filtered = this.filterProjects(projects);
    const sorted = this.sortProjects(filtered);

    return `
      <div class="dashboard">
        <header class="dashboard-header">
          <h1 class="dashboard-title">📖 StoryForge</h1>
          <p class="dashboard-subtitle">AI-Powered Creative Writing Studio</p>
        </header>

        <div class="dashboard-actions">
          <button class="btn btn-primary" id="btn-new-project">+ New Project</button>
          <button class="btn btn-secondary" id="btn-import-project">📥 Import</button>
          <div class="dashboard-filters">
            <select class="toolbar-select" id="filter-genre">
              <option value="all">All Genres</option>

              <option value="fantasy">Fantasy</option>
              <option value="scifi">Sci-Fi</option>
              <option value="romance">Romance</option>
              <option value="mystery">Mystery</option>
              <option value="thriller">Thriller</option>
              <option value="literary">Literary</option>
              <option value="horror">Horror</option>
              <option value="other">Other</option>
            </select>
            <select class="toolbar-select" id="sort-projects">
              <option value="modified">Last Modified</option>
              <option value="created">Date Created</option>
              <option value="title">Title</option>
              <option value="wordcount">Word Count</option>
            </select>
          </div>
        </div>

        <div class="project-grid" id="project-grid">
          ${sorted.length === 0 ? `
            <div class="dashboard-empty">
              <div class="empty-icon">📝</div>
              <h3>No projects yet</h3>
              <p>Create your first project to get started, or use a template.</p>
              <button class="btn btn-primary" id="btn-new-project-empty">+ Create Project</button>
            </div>
          ` : sorted.map(p => this.renderProjectCard(p)).join('')}
        </div>

        ${templates.length > 0 ? `
          <div class="dashboard-section">
            <h2 class="section-title">Templates</h2>
            <div class="template-grid">
              ${templates.map(t => this.renderTemplateCard(t)).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  renderProjectCard(project) {
    const wordCount = this.getProjectWordCount(project);
    const modified = this.formatDate(project.modifiedAt);
    const progress = project.goalWordCount ? Math.min(100, Math.round((wordCount / project.goalWordCount) * 100)) : 0;
    const chapterCount = (project.chapters || []).length;

    return `
      <div class="project-card" data-project-id="${project.id}">
        <div class="project-card-header">
          <h3 class="project-card-title">${this.escapeHtml(project.title)}</h3>
          <button class="btn-icon btn-xs project-card-menu" data-project-menu="${project.id}">⋮</button>
        </div>
        <div class="project-card-meta">
          ${project.genre ? `<span class="project-genre-badge">${this.escapeHtml(project.genre)}</span>` : ''}
          <span>${chapterCount} chapter${chapterCount !== 1 ? 's' : ''}</span>
        </div>
        <p class="project-card-desc">${this.escapeHtml((project.description || '').substring(0, 120))}</p>
        <div class="project-card-footer">
          <span class="project-wordcount">${wordCount.toLocaleString()} words</span>
          <span class="project-modified">${modified}</span>
        </div>
        ${project.goalWordCount ? `
          <div class="project-progress">
            <div class="project-progress-bar">
              <div class="project-progress-fill" style="width: ${progress}%"></div>
            </div>
            <span class="project-progress-text">${progress}% of ${project.goalWordCount.toLocaleString()}</span>
          </div>
        ` : ''}
      </div>
    `;
  }

  renderTemplateCard(template) {
    return `
      <div class="template-card" data-template-id="${template.id}">
        <div class="template-icon">${template.icon || '📄'}</div>
        <h4 class="template-title">${this.escapeHtml(template.title)}</h4>
        <p class="template-desc">${this.escapeHtml(template.description || '')}</p>
        <button class="btn btn-sm btn-secondary" data-use-template="${template.id}">Use Template</button>
      </div>
    `;
  }

  afterMount() {
    // Open project
    this.on(this.el, 'click', (e) => {
      const card = e.target.closest('.project-card');
      if (card && !e.target.closest('.project-card-menu')) {
        this.emit('open-project', { id: card.dataset.projectId });
      }
    });

    // New project
    this.on(this.el, 'click', (e) => {
      if (e.target.closest('#btn-new-project') || e.target.closest('#btn-new-project-empty')) {
        this.emit('new-project');
      }
    });

    // Import
    this.on(this.el, 'click', (e) => {
      if (e.target.closest('#btn-import-project')) {
        this.emit('import-project');
      }
    });

    // Project context menu
    this.on(this.el, 'click', (e) => {
      const menuBtn = e.target.closest('[data-project-menu]');
      if (menuBtn) {
        e.stopPropagation();
        this.showProjectMenu(menuBtn.dataset.projectMenu, menuBtn);
      }
    });

    // Use template
    this.on(this.el, 'click', (e) => {
      const btn = e.target.closest('[data-use-template]');
      if (btn) {
        this.emit('use-template', { id: btn.dataset.useTemplate });
      }
    });

    // Filters
    const filterGenre = this    // Filters

    const filterGenre = this.$('#filter-genre');
    if (filterGenre) {
      this.on(filterGenre, 'change', () => {
        this.filter = filterGenre.value;
        this.update(this.props);
      });
    }

    const sortSelect = this.$('#sort-projects');
    if (sortSelect) {
      this.on(sortSelect, 'change', () => {
        this.sortBy = sortSelect.value;
        this.update(this.props);
      });
    }
  }

  showProjectMenu(projectId, anchorEl) {
    const existing = document.querySelector('.context-menu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.innerHTML = `
      <button class="context-menu-item" data-action="open">📂 Open</button>
      <button class="context-menu-item" data-action="duplicate">📋 Duplicate</button>
      <button class="context-menu-item" data-action="export">📤 Export</button>
      <div class="context-menu-divider"></div>
      <button class="context-menu-item danger" data-action="delete">🗑 Delete</button>
    `;

    const rect = anchorEl.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = `${rect.bottom + 4}px`;
    menu.style.left = `${rect.left}px`;
    menu.style.zIndex = '9999';

    document.body.appendChild(menu);

    const handleClick = (e) => {
      const item = e.target.closest('.context-menu-item');
      if (item) {
        this.emit('project-action', { action: item.dataset.action, projectId });
      }
      menu.remove();
      document.removeEventListener('click', handleClick);
    };

    setTimeout(() => {
      document.addEventListener('click', handleClick);
    }, 10);
  }

  filterProjects(projects) {
    if (this.filter === 'all') return projects;
    return projects.filter(p => (p.genre || '').toLowerCase() === this.filter);
  }

  sortProjects(projects) {
    const sorted = [...projects];
    switch (this.sortBy) {
      case 'modified':
        sorted.sort((a, b) => (b.modifiedAt || 0) - (a.modifiedAt || 0));
        break;
      case 'created':
        sorted.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        break;
      case 'title':
        sorted.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        break;
      case 'wordcount':
        sorted.sort((a, b) => this.getProjectWordCount(b) - this.getProjectWordCount(a));
        break;
    }
    return sorted;
  }

  getProjectWordCount(project) {
    if (!project.chapters) return 0;
    return project.chapters.reduce((sum, ch) => {
      return sum + this.countWords(ch.content);
    }, 0);
  }

  countWords(text) {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
  }

  formatDate(timestamp) {
    if (!timestamp) return 'Never';
    const d = new Date(timestamp);
    const now = new Date();
    const diff = now - d;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return d.toLocaleDateString();
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
