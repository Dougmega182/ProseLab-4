export class FindReplace extends Component {
  setup() {
    this.state = {
      visible: false,
      showReplace: false,
      findText: '',
      replaceText: '',
      caseSensitive: false,
      wholeWord: false,
      useRegex: false,
      matchCount: 0,
      currentMatch: 0,
      matches: []
    };
    this._highlights = [];
  }

  template() {
    if (!this.state.visible) return '<div class="find-replace hidden"></div>';

    const s = this.state;
    return `
      <div class="find-replace">
        <div class="find-replace-row">
          <div class="find-input-wrap">
            <input type="text" id="find-input" class="find-input" 
                   placeholder="Find..." value="${this.escapeAttr(s.findText)}"
                   autocomplete="off" spellcheck="false">
            <span class="find-count">${s.matchCount > 0 ? `${s.currentMatch}/${s.matchCount}` : 'No results'}</span>
          </div>
          <div class="find-options">
            <button class="find-opt-btn ${s.caseSensitive ? 'active' : ''}" 
                    data-opt="caseSensitive" title="Match Case">Aa</button>
            <button class="find-opt-btn ${s.wholeWord ? 'active' : ''}" 
                    data-opt="wholeWord" title="Whole Word">W</button>
            <button class="find-opt-btn ${s.useRegex ? 'active' : ''}" 
                    data-opt="useRegex" title="Use Regex">.*</button>          </div>
          

          <div class="find-actions">
            <button class="find-btn" data-action="prev" title="Previous (Shift+Enter)">↑</button>
            <button class="find-btn" data-action="next" title="Next (Enter)">↓</button>
            <button class="find-btn" data-action="toggle-replace" title="Toggle Replace">
              ${s.showReplace ? '▼' : '▶'} Replace
            </button>
            <button class="find-btn find-close" data-action="close" title="Close (Esc)">✕</button>
          </div>
        </div>
        ${s.showReplace ? `
          <div class="find-replace-row">
            <div class="find-input-wrap">
              <input type="text" id="replace-input" class="find-input" 
                     placeholder="Replace..." value="${this.escapeAttr(s.replaceText)}"
                     autocomplete="off" spellcheck="false">
            </div>
            <div class="replace-actions">
              <button class="find-btn" data-action="replace" title="Replace">Replace</button>
              <button class="find-btn" data-action="replace-all" title="Replace All">All</button>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  afterMount() {
    if (!this.state.visible) return;

    const findInput = this.$('#find-input');
    const replaceInput = this.$('#replace-input');

    if (findInput) {
      this.on(findInput, 'input', (e) => {
        this.state.findText = e.target.value;
        this.performFind();
      });

      this.on(findInput, 'keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (e.shiftKey) {
            this.findPrev();
          } else {
            this.findNext();
          }
        }
        if (e.key === 'Escape') {
          this.close();
        }
      });

      // Auto-focus
      setTimeout(() => findInput.focus(), 50);
      findInput.select();
    }

    if (replaceInput) {
      this.on(replaceInput, 'input', (e) => {
        this.state.replaceText = e.target.value;
      });

      this.on(replaceInput, 'keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.replaceCurrent();
        }
        if (e.key === 'Escape') {
          this.close();
        }
      });
    }

    // Button clicks
    this.on(this.el, 'click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const optBtn = e.target.closest('[data-opt]');
      if (optBtn) {
        const opt = optBtn.dataset.opt;
        this.state[opt] = !this.state[opt];
        optBtn.classList.toggle('active');
        this.performFind();
        return;
      }

      const action = btn.dataset.action;
      switch (action) {
        case 'next': this.findNext(); break;
        case 'prev': this.findPrev(); break;
        case 'replace': this.replaceCurrent(); break;
        case 'replace-all': this.replaceAll(); break;
        case 'toggle-replace':
          this.state.showReplace = !this.state.showReplace;
          this.render();
          break;
        case 'close': this.close(); break;
      }
    });
  }

  open(withReplace = false) {
    this.state.visible = true;
    this.state.showReplace = withReplace;

    // Pre-fill with selected text
    const sel = window.getSelection();
    if (sel && sel.toString().length > 0 && sel.toString().length < 100) {
      this.state.findText = sel.toString();
    }

    this.render();
  }

  close() {
    this.clearHighlights();
    this.state.visible = false;
    this.state.matches = [];
    this.state.matchCount = 0;
    this.state.currentMatch = 0;
    this.render();
    this.emit('find-close');
  }

  performFind() {
    this.clearHighlights();

    const query = this.state.findText;
    if (!query) {
      this.state.matchCount = 0;
      this.state.currentMatch = 0;
      this.updateCount();
      return;
    }

    this.emit('find-request', {
      query,
      caseSensitive: this.state.caseSensitive,
      wholeWord: this.state.wholeWord,
      useRegex: this.state.useRegex
    });
  }

  setMatches(matches) {
    this.state.matches = matches;
    this.state.matchCount = matches.length;
    this.state.currentMatch = matches.length > 0 ? 1 : 0;
    this.updateCount();
    this.highlightMatches();
    if (matches.length > 0) {
      this.scrollToMatch(0);
    }
  }

  highlightMatches() {
    // This emits to the editor to handle highlighting
    this.emit('find-highlight', { matches: this.state.matches, current: this.state.currentMatch - 1 });

  }

  clearHighlights() {
    this.emit('find-clear-highlights');
  }

  findNext() {
    if (this.state.matchCount === 0) return;
    this.state.currentMatch = (this.state.currentMatch % this.state.matchCount) + 1;
    this.updateCount();
    this.scrollToMatch(this.state.currentMatch - 1);
    this.highlightMatches();
  }

  findPrev() {
    if (this.state.matchCount === 0) return;
    this.state.currentMatch = this.state.currentMatch <= 1 ? this.state.matchCount : this.state.currentMatch - 1;
    this.updateCount();
    this.scrollToMatch(this.state.currentMatch - 1);
    this.highlightMatches();
  }

  replaceCurrent() {
    if (this.state.matchCount === 0) return;
    this.emit('find-replace-one', {
      matchIndex: this.state.currentMatch - 1,
      replaceText: this.state.replaceText
    });
    this.performFind();
  }

  replaceAll() {
    if (this.state.matchCount === 0) return;
    this.emit('find-replace-all', {
      findText: this.state.findText,
      replaceText: this.state.replaceText,
      caseSensitive: this.state.caseSensitive,
      wholeWord: this.state.wholeWord,
      useRegex: this.state.useRegex
    });
    this.performFind();
  }

  scrollToMatch(index) {
    this.emit('find-scroll-to', { index });
  }

  updateCount() {
    const countEl = this.el.querySelector('.find-count');
    if (countEl) {
      countEl.textContent = this.state.matchCount > 0
        ? `${this.state.currentMatch}/${this.state.matchCount}`
        : 'No results';
    }
  }
}
