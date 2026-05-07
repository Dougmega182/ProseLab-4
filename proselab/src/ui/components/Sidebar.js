export class Sidebar extends Component {
  setup() {
    this.state = {
      visible: false,
      activeTab: 'outline', // outline, documents, stats, settings
      outlineItems: [],
      documents: [],
      stats: {},
      width: 280
    };
  }

  template() {
    const s = this.state;
    const visClass = s.visible ? 'sidebar-open' : 'sidebar-closed';

    return `
      <div class="sidebar ${visClass}" style="width: ${s.visible ? s.width + 'px' : '0'}">
        <div class="sidebar-inner">
          <div class="sidebar-tabs">
            <button class="sidebar-tab ${s.activeTab === 'outline' ? 'active' : ''}" data-tab="outline" title="Outline">
              <span class="tab-icon">☰</span>
            </button>
            <button class="sidebar-tab ${s.activeTab === 'documents' ? 'active' : ''}" data-tab="documents" title="Documents">
              <span class="tab-icon">📄</span>
            </button>
            <button class="sidebar-tab ${s.activeTab === 'stats' ? 'active' : ''}" data-tab="stats" title="Statistics">
              <span class="tab-icon">📊</span>
            </button>
            <button class="sidebar-tab ${s.activeTab === 'settings' ? 'active' : ''}" data-tab="settings" title="Settings">
              <span class="tab-icon">⚙</span>
            </button>
          </div>
          <div class="sidebar-content">
            ${this.renderTabContent()}
          </div>
        </div>
      </div>
    `;
  }

  renderTabContent() {
    switch (this.state.activeTab) {
      case 'outline': return this.renderOutline();
      case 'documents': return this.renderDocuments();
      case 'stats': return this.renderStats();
      case 'settings': return this.renderSettings();
      default: return '';
    }
  }

  renderOutline() {
    const items = this.state.outlineItems;
    if (items.length === 0) {
      return `
        <div class="sidebar-panel">
          <h3 class="panel-title">Document Outline</h3>
          <p class="panel-empty">No headings found. Add headings to see an outline.</p>
        </div>
      `;
    }

    const listItems = items.map(item => `
      <li class="outline-item outline-level-${item.level}" data-heading-id="${item.id}">
        <span class="outline-marker">H${item.level}</span>
        <span class="outline-text">${this.escapeHTML(item.text)}</span>
      </li>
    `).join('');

    return `
      <div class="sidebar-panel">
        <h3 class="panel-title">Document Outline</h3>
        <ul class="outline-list">${listItems}</ul>
      </div>
    `;
  }

  renderDocuments() {
    const docs = this.state.documents;

    return `
      <div class="sidebar-panel">
        <div class="panel-header">
          <h3 class="panel-title">Documents</h3>
          <button class="btn-icon" id="new-doc-btn" title="New Document">+</button>
        </div>
        <div class="doc-search">
          <input type="text" id="doc-search-input" placeholder="Search documents..." class="sidebar-input">
        </div>
        <ul class="doc-list">
          ${docs.length === 0 ? '<li class="panel-empty">No documents yet</li>' :
            docs.map(doc => `
              <li class="doc-item ${doc.active ? 'active' : ''}" data-doc-id="${doc.id}">
                <span class="doc-title">${this.escapeHTML(doc.title || 'Untitled')}</span>
                <span class="doc-meta">${doc.wordCount || 0} words · ${this.formatDate(doc.updatedAt)}</span>
              </li>
            `).join('')
          }
        </ul>
      </div>
    `;
  }

  renderStats() {
    const s = this.state.stats;

    return `
      <div class="sidebar-panel">
        <h3 class="panel-title">Statistics</h3>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${(s.wordCount || 0).toLocaleString()}</div>
            <div class="stat-label">Words</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${(s.charCount || 0).toLocaleString()}</div>
            <div class="stat-label">Characters</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${(s.charCountNoSpaces || 0).toLocaleString()}</div>
            <div class="stat-label">Chars (no spaces)</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${s.paragraphCount || 0}</div>
            <div class="stat-label">Paragraphs</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${s.sentenceCount || 0}</div>
            <div class="stat-label">Sentences</div>          </div>

          <div class="stat-card">
            <div class="stat-value">${s.readingTime || '0 min'}</div>
            <div class="stat-label">Reading Time</div>
          </div>
        </div>
        ${this.renderGoalSection()}
        ${this.renderSessionHistory()}
      </div>
    `;
  }

  renderGoalSection() {
    const goal = this.state.stats.goal;
    if (!goal) {
      return `
        <div class="stats-section">
          <h4 class="section-title">Writing Goal</h4>
          <div class="goal-setup">
            <input type="number" id="goal-input" placeholder="Word count goal" class="sidebar-input" min="1">
            <button class="btn-small" id="set-goal-btn">Set Goal</button>
          </div>
        </div>
      `;
    }

    const percent = Math.min(100, Math.round((goal.current / goal.target) * 100));
    return `
      <div class="stats-section">
        <h4 class="section-title">Writing Goal</h4>
        <div class="goal-progress">
          <div class="progress-bar">
            <div class="progress-fill ${percent >= 100 ? 'complete' : ''}" style="width: ${percent}%"></div>
          </div>
          <div class="goal-text">${goal.current.toLocaleString()} / ${goal.target.toLocaleString()} words (${percent}%)</div>
        </div>
        <button class="btn-small btn-text" id="clear-goal-btn">Clear Goal</button>
      </div>
    `;
  }

  renderSessionHistory() {
    const sessions = this.state.stats.sessions || [];
    if (sessions.length === 0) return '';

    return `
      <div class="stats-section">
        <h4 class="section-title">Recent Sessions</h4>
        <ul class="session-list">
          ${sessions.slice(0, 10).map(s => `
            <li class="session-item">
              <span class="session-date">${this.formatDate(s.date)}</span>
              <span class="session-words">+${s.words} words</span>
              <span class="session-duration">${s.duration}</span>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  }

  renderSettings() {
    return `
      <div class="sidebar-panel">
        <h3 class="panel-title">Settings</h3>

        <div class="settings-group">
          <h4 class="settings-group-title">Appearance</h4>

          <div class="setting-item">
            <label class="setting-label">Theme</label>
            <select id="setting-theme" class="sidebar-select">
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="sepia">Sepia</option>
              <option value="solarized">Solarized</option>
              <option value="nord">Nord</option>
            </select>
          </div>

          <div class="setting-item">
            <label class="setting-label">Font Family</label>
            <select id="setting-font" class="sidebar-select">
              <option value="Georgia, serif">Georgia</option>
              <option value="'Times New Roman', serif">Times New Roman</option>
              <option value="'Palatino Linotype', serif">Palatino</option>
              <option value="'Merriweather', serif">Merriweather</option>
              <option value="system-ui, sans-serif">System UI</option>
              <option value="'Helvetica Neue', sans-serif">Helvetica</option>
              <option value="'Courier New', monospace">Courier New</option>
              <option value="'JetBrains Mono', monospace">JetBrains Mono</option>
            </select>
          </div>

          <div class="setting-item">
            <label class="setting-label">Font Size: <span id="font-size-val">16</span>px</label>
            <input type="range" id="setting-font-size" min="12" max="28" value="16" class="sidebar-range">
          </div>

          <div class="setting-item">
            <label class="setting-label">Line Height: <span id="line-height-val">1.8</span></label>
            <input type="range" id="setting-line-height" min="1.2" max="3.0" step="0.1" value="1.8" class="sidebar-range">
          </div>

          <div class="setting-item">
            <label class="setting-label">Editor Width: <span id="editor-width-val">700</span>px</label>
            <input type="range" id="setting-editor-width" min="400" max="1200" step="50" value="700" class="sidebar-range">
          </div>
        </div>

        <div class="settings-group">
          <h4 class="settings-group-title">Writing Mode</h4>

          <div class="setting-item">
            <label class="setting-toggle">
              <input type="checkbox" id="setting-focus-mode">
              <span>Focus Mode</span>
            </label>
            <p class="setting-desc">Hide UI elements while writing</p>
          </div>

          <div class="setting-item">
            <label class="setting-toggle">
              <input type="checkbox" id="setting-typewriter">
              <span>Typewriter Mode</span>
            </label>
            <p class="setting-desc">Keep cursor centered on screen</p>
          </div>

          <div class="setting-item">

            <label class="setting-toggle">
              <input type="checkbox" id="setting-paragraph-focus">
              <span>Paragraph Focus</span>
            </label>
            <p class="setting-desc">Dim all paragraphs except current</p>
          </div>
        </div>

        <div class="settings-group">
          <h4 class="settings-group-title">Editor</h4>

          <div class="setting-item">
            <label class="setting-toggle">
              <input type="checkbox" id="setting-spellcheck" checked>
              <span>Spell Check</span>
            </label>
          </div>

          <div class="setting-item">
            <label class="setting-toggle">
              <input type="checkbox" id="setting-autocorrect">
              <span>Auto-correct</span>
            </label>
          </div>

          <div class="setting-item">
            <label class="setting-toggle">
              <input type="checkbox" id="setting-show-word-count" checked>
              <span>Show Word Count</span>
            </label>
          </div>
        </div>

        <div class="settings-group">
          <h4 class="settings-group-title">Data</h4>
          <div class="setting-actions">
            <button class="btn-small" id="export-html-btn">Export HTML</button>
            <button class="btn-small" id="export-md-btn">Export Markdown</button>
            <button class="btn-small" id="export-txt-btn">Export Plain Text</button>
            <button class="btn-small" id="import-btn">Import File</button>
          </div>
        </div>
      </div>
    `;
  }

  bind() {
    // Tab switching
    this.on('click', '.sidebar-tab', (e) => {
      const tab = e.target.closest('.sidebar-tab').dataset.tab;
      this.setState({ activeTab: tab });
    });

    // Outline navigation
    this.on('click', '.outline-item', (e) => {
      const id = e.target.closest('.outline-item').dataset.headingId;
      this.emit('navigate-heading', id);
    });

    // Document list
    this.on('click', '.doc-item', (e) => {
      const id = e.target.closest('.doc-item').dataset.docId;
      this.emit('open-document', id);
    });

    this.on('click', '#new-doc-btn', () => {
      this.emit('new-document');
    });

    this.on('input', '#doc-search-input', (e) => {
      this.emit('search-documents', e.target.value);
    });

    // Goal
    this.on('click', '#set-goal-btn', () => {
      const input = this.el.querySelector('#goal-input');
      const val = parseInt(input?.value);
      if (val > 0) {
        this.emit('set-goal', val);
      }
    });

    this.on('click', '#clear-goal-btn', () => {
      this.emit('clear-goal');
    });

    // Settings bindings
    this.on('change', '#setting-theme', (e) => {
      this.emit('setting-change', { key: 'theme', value: e.target.value });
    });

    this.on('change', '#setting-font', (e) => {
      this.emit('setting-change', { key: 'fontFamily', value: e.target.value });
    });

    this.on('input', '#setting-font-size', (e) => {
      const val = e.target.value;
      const label = this.el.querySelector('#font-size-val');
      if (label) label.textContent = val;
      this.emit('setting-change', { key: 'fontSize', value: parseInt(val) });
    });

    this.on('input', '#setting-line-height', (e) => {
      const val = e.target.value;
      const label = this.el.querySelector('#line-height-val');
      if (label) label.textContent = val;
      this.emit('setting-change', { key: 'lineHeight', value: parseFloat(val) });
    });

    this.on('input', '#setting-editor-width', (e) => {
      const val = e.target.value;
      const label = this.el.querySelector('#editor-width-val');
      if (label) label.textContent = val;
      this.emit('setting-change', { key: 'maxWidth', value: parseInt(val) });
    });

    this.on('change', '#setting-focus-mode', (e) => {
      this.emit('setting-change', { key: 'focusMode', value: e.target.checked });
    });

    this.on('change', '#setting-typewriter', (e) => {
      this.emit('setting-change', { key: 'typewriterMode', value: e.target.checked });
    });

    this.on('change', '#setting-paragraph-focus', (e) => {
      this.emit('setting-change', { key: 'paragraphFocus', value: e.target.checked });
    });

    this.on('change', '#setting-spellcheck', (e) => {
      this.emit('setting-change', { key: 'spellcheck', value: e.target.checked });
    });

    this.on('change', '#setting-autocorrect', (e) => {
      this.emit('setting-change', { key: 'autocorrect', value: e.target.checked });
    });

    this.on('change', '#setting-show-word-count', (e) => {
      this.emit('setting-change', { key: 'showWordCount', value: e.target.checked });
    });

    // Export/Import
    this.on('click', '#export-html-btn', () => {

      this.emit('export', 'html');
    });

    this.on('click', '#export-md-btn', () => {
      this.emit('export', 'markdown');
    });

    this.on('click', '#export-txt-btn', () => {
      this.emit('export', 'text');
    });

    this.on('click', '#import-btn', () => {
      this.emit('import');
    });

    // Restore settings values after render
    this.restoreSettingsUI();
  }

  restoreSettingsUI() {
    // This would be called after render to set current values on inputs
    // The actual values come from the app state
  }

  toggle() {
    this.setState({ visible: !this.state.visible });
  }

  show() {
    this.setState({ visible: true });
  }

  hide() {
    this.setState({ visible: false });
  }

  setOutline(items) {
    this.setState({ outlineItems: items });
  }

  setDocuments(docs) {
    this.setState({ documents: docs });
  }

  setStats(stats) {
    this.setState({ stats: { ...this.state.stats, ...stats } });
  }

  formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    if (diff < 604800000) return Math.floor(diff / 86400000) + 'd ago';

    return d.toLocaleDateString();
  }

  escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
