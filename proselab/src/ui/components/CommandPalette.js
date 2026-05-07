export class CommandPalette extends Component {
  setup() {
    this.state = {
      visible: false,
      query: '',
      commands: [],
      filteredCommands: [],
      selectedIndex: 0
    };
  }

  template() {
    const s = this.state;
    if (!s.visible) return '<div class="command-palette command-palette-hidden"></div>';

    return `
      <div class="command-palette-overlay">
        <div class="command-palette">
          <div class="command-input-wrap">
            <span class="command-icon">⌘</span>
            <input type="text" id="command-input" class="command-input" 
              placeholder="Type a command..." value="${this.escapeAttr(s.query)}" autofocus>
          </div>
          <div class="command-list">
            ${s.filteredCommands.length === 0 ? 
              '<div class="command-empty">No matching commands</div>' :
              s.filteredCommands.map((cmd, i) => `
                <div class="command-item ${i === s.selectedIndex ? 'selected' : ''}" data-index="${i}" data-command="${cmd.id}">
                  <div class="command-info">
                    <span class="command-name">${this.highlightMatch(cmd.name, s.query)}</span>
                    ${cmd.description ? `<span class="command-desc">${this.escapeHTML(cmd.description)}</span>` : ''}
                  </div>
                  ${cmd.shortcut ? `<span class="command-shortcut">${cmd.shortcut}</span>` : ''}
                </div>
              `).join('')
            }
          </div>
        </div>
      </div>
    `;
  }

  bind() {
    this.on('input', '#command-input', (e) => {
      const query = e.target.value;
      this.state.query = query;
      this.filterCommands(query);
    });

    this.on('keydown', '#command-input', (e) => {
      const filtered = this.state.filteredCommands;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          this.setState({
            selectedIndex: Math.min(this.state.selectedIndex + 1, filtered.length - 1)
          });
          this.scrollToSelected();
          break;

        case 'ArrowUp':
          e.preventDefault();
          this.setState({
            selectedIndex: Math.max(this.state.selectedIndex - 1, 0)
          });
          this.scrollToSelected();
          break;

        case 'Enter':
          e.preventDefault();
          if (filtered[this.state.selectedIndex]) {
            this.executeCommand(filtered[this.state.selectedIndex]);
          }
          break;

        case 'Escape':
          e.preventDefault();
          this.close();
          break;
      }
    });

    this.on('click', '.command-item', (e) => {
      const index = parseInt(e.target.closest('.command-item').dataset.index);
      const cmd = this.state.filteredCommands[index];
      if (cmd) this.executeCommand(cmd);
    });

    this.on('click', '.command-palette-overlay', (e) => {
      if (e.target.classList.contains('command-palette-overlay')) {
        this.close();
      }
    });

    // Focus input
    if (this.state.visible) {
      requestAnimationFrame(() => {

        const input = this.el.querySelector('#command-input');
        if (input) {
          input.focus();
        }
      });
    }
  }

  filterCommands(query) {
    const q = query.toLowerCase().trim();
    let filtered;

    if (!q) {
      filtered = this.state.commands.slice(0, 20);
    } else {
      filtered = this.state.commands
        .map(cmd => {
          const name = cmd.name.toLowerCase();
          const desc = (cmd.description || '').toLowerCase();
          let score = 0;

          if (name === q) score = 100;
          else if (name.startsWith(q)) score = 80;
          else if (name.includes(q)) score = 60;
          else if (desc.includes(q)) score = 40;
          else {
            // Fuzzy match
            let qi = 0;
            for (let i = 0; i < name.length && qi < q.length; i++) {
              if (name[i] === q[qi]) qi++;
            }
            if (qi === q.length) score = 20;
          }

          return { ...cmd, score };
        })
        .filter(cmd => cmd.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);
    }

    this.setState({ filteredCommands: filtered, selectedIndex: 0 });
  }

  executeCommand(cmd) {
    this.close();
    this.emit('execute-command', cmd.id, cmd);
    if (typeof cmd.action === 'function') {
      cmd.action();
    }
  }

  scrollToSelected() {
    const list = this.el.querySelector('.command-list');
    const selected = this.el.querySelector('.command-item.selected');
    if (list && selected) {
      const listRect = list.getBoundingClientRect();
      const itemRect = selected.getBoundingClientRect();
      if (itemRect.bottom > listRect.bottom) {
        selected.scrollIntoView({ block: 'nearest' });
      } else if (itemRect.top < listRect.top) {
        selected.scrollIntoView({ block: 'nearest' });
      }
    }
  }

  open() {
    this.setState({
      visible: true,
      query: '',
      selectedIndex: 0,
      filteredCommands: this.state.commands.slice(0, 20)
    });
  }

  close() {
    this.setState({ visible: false, query: '' });
    this.emit('command-palette-close');
  }

  toggle() {
    if (this.state.visible) {
      this.close();
    } else {
      this.open();
    }
  }

  setCommands(commands) {
    this.state.commands = commands;
    this.filterCommands(this.state.query);
  }

  highlightMatch(text, query) {
    if (!query) return this.escapeHTML(text);
    const escaped = this.escapeHTML(text);
    const q = query.toLowerCase();
    const t = text.toLowerCase();
    const idx = t.indexOf(q);
    if (idx === -1) return escaped;

    const before = this.escapeHTML(text.slice(0, idx));
    const match = this.escapeHTML(text.slice(idx, idx + query.length));
    const after = this.escapeHTML(text.slice(idx + query.length));
    return `${before}<mark>${match}</mark>${after}`;
  }

  escapeAttr(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }
}
