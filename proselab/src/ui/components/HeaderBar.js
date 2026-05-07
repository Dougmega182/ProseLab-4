// src/ui/components/HeaderBar.js

import { Component } from '../component.js';

export class HeaderBar extends Component {
  template() {
    const project = this.props.project;
    const view = this.props.view || 'projects';

    return `
      <div class="header-left">
        <button class="btn-icon menu-toggle" id="menu-toggle" title="Toggle sidebar">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <h1 class="app-title">
          <span class="logo">✦</span>
          StoryForge
        </h1>
        ${view === 'editor' && project ? `
          <span class="header-separator">›</span>
          <span class="project-name">${this.escapeHtml(project.title)}</span>
        ` : ''}
      </div>
      <div class="header-center">
        ${view === 'editor' ? `
          <div class="word-count-display" id="word-count-display">
            <span id="wc-words">0 words</span>
            <span class="wc-sep">·</span>
            <span id="wc-chars">0 chars</span>
          </div>
        ` : ''}
      </div>
      <div class="header-right">
        ${view === 'editor' ? `
          <button class="btn-icon" id="btn-export" title="Export">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>
        ` : ''}
        <button class="btn-icon" id="btn-settings" title="Settings">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
          </svg>
        </button>
      </div>
    `;
  }

  afterMount() {
    this.on(this.$('#menu-toggle'), 'click', () => {
      this.props.onMenuToggle?.();
    });

   this.on(this.$('#btn-settings'), 'click', () => {
      this.props.router.navigate('/settings');
    });

    this.on(this.$('#btn-export'), 'click', () => {
      this.emit('export-request');
    });
  }

  updateWordCount(words, chars) {
    const wordsEl = this.$('#wc-words');
    const charsEl = this.$('#wc-chars');
    if (wordsEl) wordsEl.textContent = `${words.toLocaleString()} words`;
    if (charsEl) charsEl.textContent = `${chars.toLocaleString()} chars`;
  }

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
