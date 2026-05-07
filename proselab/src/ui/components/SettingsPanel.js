// src/ui/components/SettingsPanel.js

import { Component } from '../component.js';

export class SettingsPanel extends Component {
  setup() {
    this.state = {
      activeSection: 'editor',
      settings: this.props.settings || {}
    };
  }

  template() {
    const { activeSection } = this.state;

    return `
      <div class="settings-overlay">
        <div class="settings-panel">
          <div class="settings-header">
            <h2>Settings</h2>
            <button class="settings-close-btn" id="settings-close">✕</button>
          </div>
          <div class="settings-body">
            <nav class="settings-nav">
              <button class="settings-nav-item ${activeSection === 'editor' ? 'active' : ''}" data-section="editor">Editor</button>
              <button class="settings-nav-item ${activeSection === 'appearance' ? 'active' : ''}" data-section="appearance">Appearance</button>
              <button class="settings-nav-item ${activeSection === 'writing' ? 'active' : ''}" data-section="writing">Writing</button>
              <button class="settings-nav-item ${activeSection === 'ai' ? 'active' : ''}" data-section="ai">AI</button>
              <button class="settings-nav-item ${activeSection === 'backup' ? 'active' : ''}" data-section="backup">Backup</button>
              <button class="settings-nav-item ${activeSection === 'shortcuts' ? 'active' : ''}" data-section="shortcuts">Shortcuts</button>
              <button class="settings-nav-item ${activeSection === 'about' ? 'active' : ''}" data-section="about">About</button>
            </nav>
            <div class="settings-content" id="settings-content">
              ${this.renderSection(activeSection)}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderSection(section) {
    const s = this.state.settings;
    switch (section) {
      case 'editor': return this.renderEditorSettings(s);
      case 'appearance': return this.renderAppearanceSettings(s);
      case 'writing': return this.renderWritingSettings(s);
      case 'ai': return this.renderAISettings(s);
      case 'backup': return this.renderBackupSettings(s);
      case 'shortcuts': return this.renderShortcutsSettings();
      case 'about': return this.renderAbout();
      default: return '';
    }
  }

  renderEditorSettings(s) {
    return `
      <div class="settings-section">
        <h3>Editor Settings</h3>
        <label class="settings-label">
          <span>Font Family</span>
          <select class="settings-input" data-setting="editor.fontFamily">
            <option value="Georgia, serif" ${s.editor?.fontFamily === 'Georgia, serif' ? 'selected' : ''}>Georgia</option>
            <option value="'Times New Roman', serif" ${s.editor?.fontFamily === "'Times New Roman', serif" ? 'selected' : ''}>Times New Roman</option>
            <option value="'Palatino Linotype', serif" ${s.editor?.fontFamily === "'Palatino Linotype', serif" ? 'selected' : ''}>Palatino</option>
            <option value="'Courier New', monospace" ${s.editor?.fontFamily === "'Courier New', monospace" ? 'selected' : ''}>Courier New</option>
            <option value="'Merriweather', serif" ${s.editor?.fontFamily === "'Merriweather', serif" ? 'selected' : ''}>Merriweather</option>
            <option value="'Lora', serif" ${s.editor?.fontFamily === "'Lora', serif" ? 'selected' : ''}>Lora</option>
            <option value="system-ui, sans-serif" ${s.editor?.fontFamily === 'system-ui, sans-serif' ? 'selected' : ''}>System UI</option>
          </select>
        </label>
        <label class="settings-label">
          <span>Font Size</span>
          <div class="settings-range-wrapper">
            <input type="range" class="settings-range" data-setting="editor.fontSize"
                   min="12" max="28" step="1" value="${s.editor?.fontSize || 18}">
            <span class="settings-range-value">${s.editor?.fontSize || 18}px</span>
          </div>
        </label>
        <label class="settings-label">
          <span>Line Height</span>
          <div class="settings-range-wrapper">
            <input type="range" class="settings-range" data-setting="editor.lineHeight"
                   min="1.2" max="2.4" step="0.1" value="${s.editor?.lineHeight || 1.8}">
            <span class="settings-range-value">${s.editor?.lineHeight || 1.8}</span>
          </div>
        </label>
        <label class="settings-label">
          <span>Editor Width</span>
          <div class="settings-range-wrapper">
            <input type="range" class="settings-range" data-setting="editor.maxWidth"
                   min="500" max="1000" step="50" value="${s.editor?.maxWidth || 700}">
            <span class="settings-range-value">${s.editor?.maxWidth || 700}px</span>
          </div>
        </label>
        <label class="settings-label">
          <span>Paragraph Spacing</span>
          <div class="settings-range-wrapper">
            <input type="range" class="settings-range" data-setting="editor.paragraphSpacing"
                   min="0" max="2" step="0.1" value="${s.editor?.paragraphSpacing || 0.8}">
            <span class="settings-range-value">${s.editor?.paragraphSpacing || 0.8}em</span>
          </div>
        </label>
        <label class="settings-label settings-toggle">
          <span>Paragraph Indentation</span>
          <input type="checkbox" class="settings-checkbox" data-setting="editor.indentParagraphs"
                 ${s.editor?.indentParagraphs ? 'checked' : ''}>
          <span class="settings-toggle-slider"></span>
        </label>
        <label class="settings-label settings-toggle">
          <span>Show Paragraph Marks</span>
          <input type="checkbox" class="settings-checkbox" data-setting="editor.showParagraphMarks"
                 ${s.editor?.showParagraphMarks ? 'checked' : ''}>
          <span class="settings-toggle-slider"></span>
        </label>
        <label class="settings-label settings-toggle">
          <span>Spell Check</span>
          <input type="checkbox" class="settings-checkbox" data-setting="editor.spellCheck"
                 ${s.editor?.spellCheck !== false ? 'checked' : ''}>
          <span class="settings-toggle-slider"></span>
        </label>
        <label class="settings-label settings-toggle">
          <span>Smart Quotes</span>
          <input type="checkbox" class="settings-checkbox" data-setting="editor.smartQuotes"
                 ${s.editor?.smartQuotes !== false ? 'checked' : ''}>
          <span class="settings-toggle-slider"></span>
        </label>
        <label class="settings-label settings-toggle">
          <span>Smart Dashes</span>
          <input type="checkbox" class="settings-checkbox" data-setting="editor.smartDashes"
                 ${s.editor?.smartDashes !== false ? 'checked' : ''}>
          <span class="settings-toggle-slider"></span>
        </label>
      </div>
    `;
  }

  renderAppearanceSettings(s) {
    return `
      <div class="settings-section">
        <h3>Appearance</h3>
        <label class="settings-label">
          <span>Theme</span>
          <div class="settings-theme-grid">
            <button class="settings-theme-btn ${s.appearance?.theme === 'light' ? 'active' : ''}" data-setting="appearance.theme" data-value="light">
              <div class="theme-preview theme-preview-light"></div>
              <span>Light</span>
            </button>
            <button class="settings-theme-btn ${s.appearance?.theme === 'dark' ? 'active' : ''}" data-setting="appearance.theme" data-value="dark">
              <div class="theme-preview theme-preview-dark"></div>
              <span>Dark</span>
            </button>
            <button class="settings-theme-btn ${s.appearance?.theme === 'sepia' ? 'active' : ''}" data-setting="appearance.theme" data-value="sepia">
              <div class="theme-preview theme-preview-sepia"></div>
              <span>Sepia</span>
            </button>
            <button class="settings-theme-btn ${s.appearance?.theme === 'solarized' ? 'active' : ''}" data-setting="appearance.theme" data-value="solarized">
              <div class="theme-preview theme-preview-solarized"></div>
              <span>Solarized</span>
            </button>
            <button class="settings-theme-btn ${s.appearance?.theme === 'nord' ? 'active' : ''}" data-setting="appearance.theme" data-value="nord">
              <div class="theme-preview theme-preview-nord"></div>
              <span>Nord</span>
            </button>
          </div>
        </label>
        <label class="settings-label">
          <span>Accent Color</span>
         <input type="color" class="settings-color" data-setting="appearance.accentColor"
                 value="${s.appearance?.accentColor || '#4a9eff'}">
        </label>
        <label class="settings-label settings-toggle">
          <span>Focus Mode (dim non-active paragraphs)</span>
          <input type="checkbox" class="settings-checkbox" data-setting="appearance.focusMode"
                 ${s.appearance?.focusMode ? 'checked' : ''}>
          <span class="settings-toggle-slider"></span>
        </label>
        <label class="settings-label settings-toggle">
          <span>Typewriter Mode (keep cursor centered)</span>
          <input type="checkbox" class="settings-checkbox" data-setting="appearance.typewriterMode"
                 ${s.appearance?.typewriterMode ? 'checked' : ''}>
          <span class="settings-toggle-slider"></span>
        </label>
        <label class="settings-label settings-toggle">
          <span>Show Toolbar</span>
          <input type="checkbox" class="settings-checkbox" data-setting="appearance.showToolbar"
                 ${s.appearance?.showToolbar !== false ? 'checked' : ''}>
          <span class="settings-toggle-slider"></span>
        </label>
        <label class="settings-label settings-toggle">
          <span>Show Status Bar</span>
          <input type="checkbox" class="settings-checkbox" data-setting="appearance.showStatusBar"
                 ${s.appearance?.showStatusBar !== false ? 'checked' : ''}>
          <span class="settings-toggle-slider"></span>
        </label>
      </div>
    `;
  }

  renderWritingSettings(s) {
    return `
      <div class="settings-section">
        <h3>Writing Goals & Preferences</h3>
        <label class="settings-label">
          <span>Daily Word Goal</span>
          <input type="number" class="settings-input" data-setting="writing.dailyGoal"
                 value="${s.writing?.dailyGoal || 0}" min="0" max="50000" step="100"
                 placeholder="0 = disabled">
          <span class="settings-hint">Set to 0 to disable daily goal tracking</span>
        </label>
        <label class="settings-label">
          <span>Session Goal</span>
          <input type="number" class="settings-input" data-setting="writing.sessionGoal"
                 value="${s.writing?.sessionGoal || 0}" min="0" max="50000" step="100"
                 placeholder="0 = disabled">
        </label>
        <label class="settings-label">
          <span>Auto-save Interval</span>
          <select class="settings-input" data-setting="writing.autoSaveInterval">
            <option value="5000" ${s.writing?.autoSaveInterval === 5000 ? 'selected' : ''}>5 seconds</option>
            <option value="15000" ${s.writing?.autoSaveInterval === 15000 ? 'selected' : ''}>15 seconds</option>
            <option value="300000" ${(s.writing?.autoSaveInterval || 30000) === 30000 ? 'selected' : ''}>30 seconds</option>
            <option value="60000" ${s.writing?.autoSaveInterval === 60000 ? 'selected' : ''}>1 minute</option>
            <option value="300000" ${s.writing?.autoSaveInterval === 300000 ? 'selected' : ''}>5 minutes</option>
            <option value="0" ${s.writing?.autoSaveInterval === 0 ? 'selected' : ''}>Manual only</option>
          </select>
        </label>
        <label class="settings-label">
          <span>Default Chapter Prefix</span>
          <input type="text" class="settings-input" data-setting="writing.chapterPrefix"
                 value="${s.writing?.chapterPrefix || 'Chapter'}" placeholder="Chapter">
        </label>
        <label class="settings-label settings-toggle">
          <span>Track Writing Streaks</span>
          <input type="checkbox" class="settings-checkbox" data-setting="writing.trackStreaks"
                 ${s.writing?.trackStreaks !== false ? 'checked' : ''}>
          <span class="settings-toggle-slider"></span>
        </label>
        <label class="settings-label settings-toggle">
          <span>Show Writing Prompts on Start</span>
          <input type="checkbox" class="settings-checkbox" data-setting="writing.showPrompts"
                 ${s.writing?.showPrompts ? 'checked' : ''}>
          <span class="settings-toggle-slider"></span>
        </label>
      </div>
    `;
  }

  renderAISettings(s) {
    const provider = s.ai?.provider || 'none';
    return `
      <div class="settings-section">
        <h3>AI Assistant</h3>
        <label class="settings-label">
          <span>AI Provider</span>
          <select class="settings-input" data-setting="ai.provider" id="ai-provider-select">
            <option value="none" ${provider === 'none' ? 'selected' : ''}>None (Disabled)</option>
            <option value="openai" ${provider === 'openai' ? 'selected' : ''}>OpenAI (GPT)</option>
            <option value="anthropic" ${provider === 'anthropic' ? 'selected' : ''}>Anthropic (Claude)</option>
            <option value="local" ${provider === 'local' ? 'selected' : ''}>Local (Ollama/LM Studio)</option>
            <option value="custom" ${provider === 'custom' ? 'selected' : ''}>Custom API</option>
          </select>
  </label>
        ${provider === 'openai' ? `
          <label class="settings-label">
            <span>API Key</span>
            <input type="password" class="settings-input" data-setting="ai.apiKey"
                   value="${s.ai?.apiKey || ''}" placeholder="sk-...">
            <span class="settings-hint">Your key is stored locally and never sent to our servers.</span>
          </label>
          <label class="settings-label">
            <span>Model</span>
            <select class="settings-input" data-setting="ai.model">
              <option value="gpt-4o" ${s.ai?.model === 'gpt-4o' ? 'selected' : ''}>GPT-4o</option>
              <option value="gpt-4o-mini" ${s.ai?.model === 'gpt-4o-mini' ? 'selected' : ''}>GPT-4o Mini</option>
              <option value="gpt-4-turbo" ${s.ai?.model === 'gpt-4-turbo' ? 'selected' : ''}>GPT-4 Turbo</option>
            </select>
          </label>
        ` : ''}
        ${provider === 'anthropic' ? `
          <label class="settings-label">
            <span>API Key</span>
            <input type="password" class="settings-input" data-setting="ai.apiKey"
                   value="${s.ai?.apiKey || ''}" placeholder="sk-ant-...">
            <span class="settings-hint">Your key is stored locally and never sent to our servers.</span>
          </label>
          <label class="settings-label">
            <span>Model</span>
            <select class="settings-input" data-setting="ai.model">
              <option value="claude-3-5-sonnet-20241022" ${s.ai?.model === 'claude-3-5-sonnet-20241022' ? 'selected' : ''}>Claude 3.5 Sonnet</option>
              <option value="claude-3-5-haiku-20241022" ${s.ai?.model === 'claude-3-5-haiku-20241022' ? 'selected' : ''}>Claude 3.5 Haiku</option>
              <option value="claude-3-opus-20240229" ${s.ai?.model === 'claude-3-opus-20240229' ? 'selected' : ''}>Claude 3 Opus</option>
            </select>
          </label>
        ` : ''}
        ${provider === 'local' ? `
          <label class="settings-label">
            <span>Endpoint URL</span>
            <input type="text" class="settings-input" data-setting="ai.endpoint"
                   value="${s.ai?.endpoint || 'http://localhost:11434'}" placeholder="http://localhost:11434">
          </label>
          <label class="settings-label">
            <span>Model Name</span>
            <input type="text" class="settings-input" data-setting="ai.model"
                   value="${s.ai?.model || 'llama3'}" placeholder="llama3">
          </label>
        ` : ''}
        ${provider === 'custom' ? `
          <label class="settings-label">
            <span>API Endpoint</span>
            <input type="text" class="settings-input" data-setting="ai.endpoint"
                   value="${s.ai?.endpoint || ''}" placeholder="https://api.example.com/v1/chat/completions">
          </label>
          <label class="settings-label">
            <span>API Key</span>
            <input type="password" class="settings-input" data-setting="ai.apiKey"
                   value="${s.ai?.apiKey || ''}" placeholder="Your API key">
          </label>
          <label class="settings-label">
            <span>Model</span>
            <input type="text" class="settings-input" data-setting="ai.model"
                   value="${s.ai?.model || ''}" placeholder="Model identifier">
          </label>
        ` : ''}
        ${provider !== 'none' ? `
          <label class="settings-label">
            <span>Temperature (Creativity)</span>
            <div class="settings-range-wrapper">
              <input type="range" class="settings-range" data-setting="ai.temperature"
                     min="0" max="1.5" step="0.1" value="${s.ai?.temperature || 0.7}">
              <span class="settings-range-value">${s.ai?.temperature || 0.7}</span>
            </div>
            <span class="settings-hint">Lower = more predictable, Higher = more creative</span>
          </label>
          <label class="settings-label">
            <span>Max Tokens</span>
            <input type="number" class="settings-input" data-setting="ai.maxTokens"
                   value="${s.ai?.maxTokens || 2048}" min="256" max="8192" step="256">
          </label>
          <label class="settings-label">
            <span>Context Window</span>
            <select class="settings-input" data-setting="ai.contextWindow">
              <option value="current-chapter" ${(s.ai?.contextWindow || 'current-chapter') === 'current-chapter' ? 'selected' : ''}>Current chapter only</option>
              <option value="recent-chapters" ${s.ai?.contextWindow === 'recent-chapters' ? 'selected' : ''}>Recent chapters</option>
              <option value="full-project" ${s.ai?.contextWindow === 'full-project' ? 'selected' : ''}>Full project (may use more tokens)</option>
              <option value="selection" ${s.ai?.contextWindow === 'selection' ? 'selected' : ''}>Selected text only</option>
</select>
          </label>
          <label class="settings-label settings-toggle">
            <span>Include character notes in context</span>
            <input type="checkbox" class="settings-checkbox" data-setting="ai.includeNotes"
                   ${s.ai?.includeNotes !== false ? 'checked' : ''}>
            <span class="settings-toggle-slider"></span>
          </label>
          <div class="settings-actions">
            <button class="btn btn-sm" id="ai-test-connection">Test Connection</button>
            <span id="ai-test-result"></span>
          </div>
        ` : ''}
      </div>
    `;
  }

  renderBackupSettings(s) {
    return `
      <div class="settings-section">
        <h3>Backup & Data</h3>
        <div class="settings-group">
          <h4>Export</h4>
          <p class="settings-hint">Export your projects for backup or use in other applications.</p>
          <div class="settings-actions">
            <button class="btn btn-sm" data-action="export-all-json">Export All Projects (JSON)</button>
            <button class="btn btn-sm" data-action="export-current-md">Export Current Project (Markdown)</button>
            <button class="btn btn-sm" data-action="export-current-txt">Export Current Project (Plain Text)</button>
            <button class="btn btn-sm" data-action="export-current-docx">Export Current Project (DOCX)</button>
          </div>
        </div>
        <div class="settings-group">
          <h4>Import</h4>
          <p class="settings-hint">Import projects from backup files.</p>
          <div class="settings-actions">
            <button class="btn btn-sm" data-action="import-json">Import from JSON</button>
            <button class="btn btn-sm" data-action="import-md">Import from Markdown</button>
            <button class="btn btn-sm" data-action="import-txt">Import from Text File</button>
          </div>
          <input type="file" id="import-file-input" style="display:none" accept=".json,.md,.txt,.markdown">
        </div>
        <div class="settings-group">
          <h4>Auto-Backup</h4>
          <label class="settings-label settings-toggle">
            <span>Enable Auto-Backup</span>
            <input type="checkbox" class="settings-checkbox" data-setting="backup.autoBackup"
                   ${s.backup?.autoBackup !== false ? 'checked' : ''}>
            <span class="settings-toggle-slider"></span>
          </label>
          <label class="settings-label">
            <span>Keep Backup Versions</span>
            <select class="settings-input" data-setting="backup.maxVersions">
              <option value="5" ${s.backup?.maxVersions === 5 ? 'selected' : ''}>5 versions</option>
              <option value="10" ${(s.backup?.maxVersions || 10) === 10 ? 'selected' : ''}>10 versions</option>
              <option value="25" ${s.backup?.maxVersions === 25 ? 'selected' : ''}>25 versions</option>
              <option value="50" ${s.backup?.maxVersions === 50 ? 'selected' : ''}>50 versions</option>
            </select>
          </label>
        </div>
        <div class="settings-group settings-danger">
          <h4>Danger Zone</h4>
          <p class="settings-hint">These actions cannot be undone.</p>
          <div class="settings-actions">
            <button class="btn btn-sm btn-danger" data-action="clear-all-data">Clear All Data</button>
          </div>
        </div>
      </div>
    `;
  }

  renderShortcutsSettings() {
    const shortcuts = [
      { keys: 'Ctrl/⌘ + S', action: 'Save' },
      { keys: 'Ctrl/⌘ + B', action: 'Bold' },
      { keys: 'Ctrl/⌘ + I', action: 'Italic' },
      { keys: 'Ctrl/⌘ + Z', action: 'Undo' },
      { keys: 'Ctrl/⌘ + Shift + Z', action: 'Redo' },
      { keys: 'Ctrl/⌘ + Shift + F', action: 'Toggle Focus Mode' },
      { keys: 'Ctrl/⌘ + \\', action: 'Toggle Sidebar' },
      { keys: 'Ctrl/⌘ + Shift + \\', action: 'Toggle AI Panel' },
      { keys: 'Ctrl/⌘ + ,', action: 'Open Settings' },
      { keys: 'Ctrl/⌘ + N', action: 'New Chapter' },
      { keys: 'Ctrl/⌘ + Shift + N', action: 'New Project' },
      { keys: 'Ctrl/⌘ + F', action: 'Find & Replace' },
      { keys: 'Ctrl/⌘ + Enter', action: 'Insert Scene Break' },
      { keys: 'F11', action: 'Toggle Fullscreen' },
      { keys: 'Escape', action: 'Close Panel / Exit Focus Mode' },
      { keys: 'Ctrl/⌘ + 1', action: 'Heading 1' },
      { keys: 'Ctrl/⌘ + 2', action: 'Heading 2' },
      { keys: 'Ctrl/⌘ + 3', action: 'Heading 3' },
    ];
return `
      <div class="settings-section">
        <h3>Keyboard Shortcuts</h3>
        <div class="shortcuts-list">
          ${shortcuts.map(s => `
            <div class="shortcut-row">
              <span class="shortcut-keys">${s.keys}</span>
              <span class="shortcut-action">${s.action}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  renderAbout() {
    return `
      <div class="settings-section">
        <h3>About Canvas</h3>
        <div class="about-content">
          <div class="about-logo">📝</div>
          <h2>Canvas</h2>
          <p class="about-version">Version 1.0.0</p>
          <p class="about-desc">A distraction-free writing environment for novelists, screenwriters, and storytellers. Built with care for the craft of writing.</p>
          <div class="about-features">
            <h4>Features</h4>
            <ul>
              <li>Rich text editing with formatting toolbar</li>
              <li>Project & chapter organization</li>
              <li>AI-powered writing assistance</li>
              <li>Multiple themes and customization</li>
              <li>Focus and typewriter modes</li>
              <li>Word count tracking and goals</li>
              <li>Auto-save and version history</li>
              <li>Export to multiple formats</li>
              <li>Fully offline — your data stays on your device</li>
            </ul>
          </div>
          <p class="about-credits">Made with ❤️ for writers everywhere.</p>
        </div>
      </div>
    `;
  }

  afterMount() {
    // Section navigation
    this.on(this.el, 'click', (e) => {
      const navItem = e.target.closest('.settings-nav-item');
      if (navItem) {
        this.state.activeSection = navItem.dataset.section;
        this.el.querySelectorAll('.settings-nav-item').forEach(n => n.classList.remove('active'));
        navItem.classList.add('active');
        const content = this.$('#settings-content');
        if (content) {
          content.innerHTML = this.renderSection(this.state.activeSection);
          this.bindSectionEvents();
        }
      }
    });

    // Close button
    this.on(this.el, 'click', (e) => {
      if (e.target.id === 'settings-close' || e.target.classList.contains('settings-overlay')) {
        this.emit('settings-close');
      }
    });

    // Escape key
    this.on(document, 'keydown', (e) => {
      if (e.key === 'Escape') {
        this.emit('settings-close');
      }
    });

    this.bindSectionEvents();
  }

  bindSectionEvents() {
    // Range inputs — update display value
    this.el.querySelectorAll('.settings-range').forEach(range => {
      this.on(range, 'input', () => {
        const display = range.parentElement.querySelector('.settings-range-value');
        if (display) {
          const setting = range.dataset.setting;
          let suffix = '';
          if (setting.includes('fontSize') || setting.includes('maxWidth')) suffix = 'px';
          if (setting.includes('paragraphSpacing')) suffix = 'em';
          display.textContent = range.value + suffix;
        }
      });

      this.on(range, 'change', () => {
        this.handleSettingChange(range.dataset.setting, parseFloat(range.value));
      });
    });

    // Select inputs
    this.el.querySelectorAll('select.settings-input').forEach(select => {
      this.on(select, 'change', () => {
        let val = select.value;
        // Try to parse as number
        if (!isNaN(val) && val !== '') val = parseFloat(val);
        this.handleSettingChange(select.dataset.setting, val);

        // Re-render section if AI provider changed
        if (select.dataset.setting === 'ai.provider') {
          const content = this.$('#settings-content');
          if (content) {
            content.innerHTML = this.renderSection(this.state.activeSection);
            this.bindSectionEvents();
          }
        }
      });
    });

    // Text/number inputs
    this.el.querySelectorAll('input.settings-input[type="text"], input.settings-input[type="number"], input.settings-input[type="password"]').forEach(input => {
      this.on(input, 'change', () => {
        let val = input.value;
        if (input.type === 'number') val = parseFloat(val);
        this.handleSettingChange(input.dataset.setting, val);
      });
    });

    // Checkbox toggles
    this.el.querySelectorAll('.settings-checkbox').forEach(cb => {
      this.on(cb, 'change', () => {
        this.handleSettingChange(cb.dataset.setting, cb.checked);
      });
    });

    // Color inputs
    this.el.querySelectorAll('.settings-color').forEach(color => {
      this.on(color, 'change', () => {
        this.handleSettingChange(color.dataset.setting, color.value);
      });
    });

    // Theme buttons
    this.el.querySelectorAll('.settings-theme-btn').forEach(btn => {
      this.on(btn, 'click', () => {
        this.el.querySelectorAll('.settings-theme-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
       this.handleSettingChange(btn.dataset.setting, btn.dataset.value);
      });
    });

    // Action buttons
    this.el.querySelectorAll('[data-action]').forEach(btn => {
      this.on(btn, 'click', () => {
        this.emit('settings-action', { action: btn.dataset.action });
      });
    });

    // AI test connection
    const testBtn = this.$('#ai-test-connection');
    if (testBtn) {
      this.on(testBtn, 'click', () => {
        this.emit('settings-action', { action: 'test-ai-connection' });
      });
    }
  }

  handleSettingChange(path, value) {
    // Update nested setting in state
    const parts = path.split('.');
    let obj = this.state.settings;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!obj[parts[i]]) obj[parts[i]] = {};
      obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = value;

    this.emit('setting-changed', { path, value, settings: this.state.settings });
  }

  updateSettings(settings) {
    this.state.settings = settings;
  }

  showTestResult(success, message) {
    const result = this.$('#ai-test-result');
    if (result) {
      result.className = success ? 'test-success' : 'test-error';
      result.textContent = message;
    }
  }
}
