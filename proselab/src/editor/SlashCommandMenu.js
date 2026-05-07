export class SlashCommandMenu {
  constructor(editor) {
    this.editor = editor;
    this.el = null;
    this.isVisible = false;
    this.selectedIndex = 0;
    this.filteredCommands = [];
    this.query = '';
    this.triggerRange = null;

    this.commands = [
      { id: 'h1', label: 'Heading 1', description: 'Large heading', icon: 'H1', action: () => this.editor.setBlockType('h1') },
      { id: 'h2', label: 'Heading 2', description: 'Medium heading', icon: 'H2', action: () => this.editor.setBlockType('h2') },
      { id: 'h3', label: 'Heading 3', description: 'Small heading', icon: 'H3', action: () => this.editor.setBlockType('h3') },
      { id: 'p', label: 'Paragraph', description: 'Plain text', icon: '¶', action: () => this.editor.setBlockType('p') },
      { id: 'quote', label: 'Quote', description: 'Blockquote', icon: '❝', action: () => this.editor.setBlockType('blockquote') },
      { id: 'ul', label: 'Bullet List', description: 'Unordered list', icon: '•', action: () => this.editor.toggleList('ul') },
      { id: 'ol', label: 'Numbered List', description: 'Ordered list', icon: '1.', action: () => this.editor.toggleList('ol') },
      { id: 'checklist', label: 'Checklist', description: 'Task list', icon: '☑', action: () => this.editor.insertCheckbox() },
      { id: 'code', label: 'Code Block', description: 'Preformatted code', icon: '{ }', action: () => this.editor.setBlockType('pre') },
      { id: 'hr', label: 'Divider', description: 'Horizontal rule', icon: '—', action: () => this.editor.insertHorizontalRule() },
      { id: 'table', label: 'Table', description: 'Insert a table', icon: '▦', action: () => this.editor.insertTable() },
      { id: 'image', label: 'Image', description: 'Upload an image', icon: '🖼', action: () => this.editor.insertImageFromFile() },
      { id: 'link', label: 'Link', description: 'Insert a link', icon: '🔗', action: () => this.editor.insertLink() },
    ];

    this.init();
  }

  init() {
    this.el = document.createElement('div');
    this.el.className = 'rte-slash-menu';
    this.el.style.display = 'none';
    document.body.appendChild(this.el);

    this.editor.el.addEventListener('keydown', (e) => this.onKeyDown(e));
    this.editor.el.addEventListener('input', (e) => this.onInput(e));

    document.addEventListener('click', (e) => {
      if (this.isVisible && !this.el.contains(e.target)) {
        this.hide();
      }
    });

    this.applyStyles();
  }

  onInput(e) {
    if (!this.isVisible) {
      // Check if user typed '/'
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return;

      const range = sel.getRangeAt(0);
      const block = this.editor.getCurrentBlock();
      if (!block) return;

      const text = block.textContent;
      if (text === '/') {

        this.query = '';
        this.triggerRange = range.cloneRange();
        this.filteredCommands = [...this.commands];
        this.selectedIndex = 0;
        this.render();
        this.show();
        return;
      }
    }

    if (this.isVisible) {
      const block = this.editor.getCurrentBlock();
      if (!block) { this.hide(); return; }

      const text = block.textContent;
      const slashIndex = text.lastIndexOf('/');
      if (slashIndex === -1) { this.hide(); return; }

      this.query = text.substring(slashIndex + 1).toLowerCase();
      this.filteredCommands = this.commands.filter(cmd =>
        cmd.label.toLowerCase().includes(this.query) ||
        cmd.description.toLowerCase().includes(this.query) ||
        cmd.id.toLowerCase().includes(this.query)
      );

      if (this.filteredCommands.length === 0) {
        this.hide();
        return;
      }

      this.selectedIndex = Math.min(this.selectedIndex, this.filteredCommands.length - 1);
      this.render();
      this.position();
    }
  }

  onKeyDown(e) {
    if (!this.isVisible) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.selectedIndex = (this.selectedIndex + 1) % this.filteredCommands.length;
        this.render();
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.selectedIndex = (this.selectedIndex - 1 + this.filteredCommands.length) % this.filteredCommands.length;
        this.render();
        break;
      case 'Enter':
        e.preventDefault();
        this.executeSelected();
        break;
      case 'Escape':
        e.preventDefault();
        this.hide();
        break;
      case 'Tab':
        e.preventDefault();
        this.executeSelected();
        break;
    }
  }

  executeSelected() {
    const cmd = this.filteredCommands[this.selectedIndex];
    if (!cmd) return;

    // Remove the slash command text from the block
    const block = this.editor.getCurrentBlock();
    if (block) {
      const text = block.textContent;
      const slashIndex = text.lastIndexOf('/');
      if (slashIndex !== -1) {
        block.textContent = text.substring(0, slashIndex);
        if (!block.textContent) {
          block.innerHTML = '<br>';
        }
        // Place cursor at end
        const sel = window.getSelection();
        const range = document.createRange();
        if (block.childNodes.length > 0) {
          const lastChild = block.childNodes[block.childNodes.length - 1];
          if (lastChild.nodeType === Node.TEXT_NODE) {
            range.setStart(lastChild, lastChild.textContent.length);
          } else {
            range.setStartAfter(lastChild);
          }
        } else {
          range.setStart(block, 0);
        }
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }

    this.hide();
    cmd.action();
    this.editor.saveState();
  }

  render() {
    this.el.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'rte-slash-header';
    header.textContent = 'Commands';
    this.el.appendChild(header);

    this.filteredCommands.forEach((cmd, i) => {
      const item = document.createElement('div');
      item.className = 'rte-slash-item' + (i === this.selectedIndex ? ' selected' : '');

      const icon = document.createElement('span');
      icon.className = 'rte-slash-icon';
      icon.textContent = cmd.icon;

      const info = document.createElement('div');
      info.className = 'rte-slash-info';

      const label = document.createElement('div');
      label.className = 'rte-slash-label';
      label.textContent = cmd.label;

      const desc = document.createElement('div');
      desc.className = 'rte-slash-desc';
      desc.textContent = cmd.description;

      info.appendChild(label);
      info.appendChild(desc);
      item.appendChild(icon);
      item.appendChild(info);

      item.addEventListener('mouseenter', () => {
        this.selectedIndex = i;
        this.render();
      });

      item.addEventListener('click', (e) => {
        e.preventDefault();
        this.selectedIndex = i;
        this.executeSelected();
      });

      this.el.appendChild(item);
    });

    // Scroll selected into view
    const selectedEl = this.el.querySelector('.rte-slash-item.selected');
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }

  show() {
    this.el.style.display = 'block';
    this.isVisible = true;
    this.position();
  }

  position() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    let left = rect.left;
    let top = rect.bottom + 4 + window.scrollY;

    const menuRect = this.el.getBoundingClientRect();

    if (left + menuRect.width > window.innerWidth - 8) {
      left = window.innerWidth - menuRect.width - 8;
    }
    if (left < 8) left = 8;

    // If menu would go below viewport, show above
    if (top + menuRect.height > window.scrollY + window.innerHeight - 8) {
      top = rect.top - menuRect.height - 4 + window.scrollY;
    }

    this.el.style.left = left + 'px';
    this.el.style.top = top + 'px';
  }

  hide() {
    this.el.style.display = 'none';
    this.isVisible = false;
    this.query = '';
    this.selectedIndex = 0;
    this.triggerRange = null;
  }

  applyStyles() {
    if (document.getElementById('rte-slash-menu-styles')) return;

    const style = document.createElement('style');
    style.id = 'rte-slash-menu-styles';
    style.textContent = `
      .rte-slash-menu {
        position: absolute;
        z-index: 10001;
        width: 280px;
        max-height: 320px;
        overflow-y: auto;
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.12);
        padding: 4px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .rte-slash-header {
        padding: 6px 10px;
        font-size: 11px;
        font-weight: 600;
        color: #94a3b8;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .rte-slash-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 10px;
        border-radius: 6px;
        cursor: pointer;
        transition: background 0.1s;
      }

      .rte-slash-item:hover,
      .rte-slash-item.selected {
        background: #f1f5f9;
      }

      .rte-slash-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: 6px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        font-size: 14px;
        flex-shrink: 0;
      }

      .rte-slash-info {
        flex: 1;
        min-width: 0;
      }

      .rte-slash-label {
        font-size: 14px;
        font-weight: 500;
        color: #1e293b;
      }

      .rte-slash-desc {
        font-size: 12px;
        color: #94a3b8;
        margin-top: 1px;
      }
    `;
    document.head.appendChild(style);
  }

  destroy() {
    if (this.el && this.el.parentNode) {
      this.el.parentNode.removeChild(this.el);
    }
  }
}