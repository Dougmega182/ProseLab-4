export class StatusBar extends Component {
  setup() {
    this.state = {
      wordCount: 0,
      charCount: 0,
      paragraphCount: 0,
      readingTime: '0 min',
      wordGoal: 0,
      wordGoalProgress: 0,
      saveStatus: 'saved', // 'saved', 'saving', 'unsaved', 'error'
      lastSaved: null,
      cursorPosition: { line: 1, col: 1 },
      selectedCount: 0,
      focusMode: false,
      typewriterMode: false
    };
  }

  template() {
    const s = this.state;
    const goalHtml = s.wordGoal > 0 ? `

      <div class="status-item status-goal">
        <div class="status-goal-bar">
          <div class="status-goal-fill" style="width: ${Math.min(s.wordGoalProgress, 100)}%"></div>
        </div>
        <span>${s.wordCount}/${s.wordGoal} (${Math.round(s.wordGoalProgress)}%)</span>
      </div>
    ` : '';

    const saveIcon = {
      saved: '✓',
      saving: '⏳',
      unsaved: '●',
      error: '⚠️'
    }[s.saveStatus] || '✓';

    const saveText = {
      saved: s.lastSaved ? `Saved ${this.timeAgo(s.lastSaved)}` : 'Saved',
      saving: 'Saving...',
      unsaved: 'Unsaved changes',
      error: 'Save error'
    }[s.saveStatus] || 'Saved';

    return `
      <div class="status-bar">
        <div class="status-left">
          <div class="status-item status-save status-${s.saveStatus}" title="${saveText}">
            <span class="status-icon">${saveIcon}</span>
            <span class="status-text">${saveText}</span>
          </div>
        </div>
        <div class="status-center">
          ${goalHtml}
        </div>
        <div class="status-right">
          ${s.selectedCount > 0 ? `
            <div class="status-item" title="Selected">
              <span>${s.selectedCount} selected</span>
            </div>
          ` : ''}
          <div class="status-item" title="Words">
            <span>${this.formatNumber(s.wordCount)} words</span>
          </div>
          <div class="status-item" title="Characters">
            <span>${this.formatNumber(s.charCount)} chars</span>
          </div>
          <div class="status-item" title="Reading time">
            <span>~${s.readingTime} read</span>
          </div>
          <div class="status-item status-cursor" title="Cursor position">
            <span>Ln ${s.cursorPosition.line}, Col ${s.cursorPosition.col}</span>
          </div>
          ${s.focusMode ? '<div class="status-item status-mode" title="Focus Mode">🎯</div>' : ''}
          ${s.typewriterMode ? '<div class="status-item status-mode" title="Typewriter Mode">⌨️</div>' : ''}
        </div>
      </div>
    `;
  }

  formatNumber(n) {
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return n.toString();
  }

  timeAgo(date) {
    if (!date) return '';
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 5) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  }

  updateStats(stats) {
    Object.assign(this.state, stats);
    this.render();
  }

  setSaveStatus(status, lastSaved) {
    this.state.saveStatus = status;
    if (lastSaved) this.state.lastSaved = lastSaved;
    this.render();
  }

  setCursorPosition(line, col) {
    this.state.cursorPosition = { line, col };
    const el = this.el.querySelector('.status-cursor span');
    if (el) el.textContent = `Ln ${line}, Col ${col}`;
  }

  setSelectedCount(count) {
    if (this.state.selectedCount !== count) {
      this.state.selectedCount = count;
      this.render();
    }
  }

  afterMount() {
    // Periodically update "time ago" for save status
    this._timeInterval = setInterval(() => {
      if (this.state.saveStatus === 'saved' && this.state.lastSaved) {
        const el = this.el.querySelector('.status-save .status-text');
        if (el) el.textContent = `Saved ${this.timeAgo(this.state.lastSaved)}`;
      }
    }, 30000);
  }

  destroy() {
    clearInterval(this._timeInterval);
    super.destroy();
  }
}
