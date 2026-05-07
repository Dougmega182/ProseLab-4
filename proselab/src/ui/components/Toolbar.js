export class Toolbar {
  constructor(editor, options = {}) {
    this.editor = editor;
    this.options = Object.assign({
      container: null,
      position: 'top',       // 'top', 'bottom', 'floating'
      groups: null,           // custom button groups
      sticky: false,
      stickyOffset: 0,
    }, options);

    this.el = null;
    this.buttons = {};
    this.activeFormats = {};

    this.defaultGroups = [
      {
        name: 'history',
        buttons: [
          { command: 'undo', icon: '↶', title: 'Undo (Ctrl+Z)' },
          { command: 'redo', icon: '↷', title: 'Redo (Ctrl+Y)' },
        ]
      },
      {
        name: 'block',
        buttons: [
          { command: 'formatBlock', value: 'p', icon: '¶', title: 'Paragraph' },
          { command: 'formatBlock', value: 'h1', icon: 'H1', title: 'Heading 1' },
          { command: 'formatBlock', value: 'h2', icon: 'H2', title: 'Heading 2' },
          { command: 'formatBlock', value: 'h3', icon: 'H3', title: 'Heading 3' },
          { command: 'formatBlock', value: 'pre', icon: '⌨', title: 'Code Block' },
          { command: 'formatBlock', value: 'blockquote', icon: '❝', title: 'Blockquote' },
        ]
      },
      {
        name: 'inline',
        buttons: [
          { command: 'bold', icon: 'B', title: 'Bold (Ctrl+B)', style: 'font-weight:bold' },
          { command: 'italic', icon: 'I', title: 'Italic (Ctrl+I)', style: 'font-style:italic' },
          { command: 'underline', icon: 'U', title: 'Underline (Ctrl+U)', style: 'text-decoration:underline' },
          { command: 'strikethrough', icon: 'S', title: 'Strikethrough', style: 'text-decoration:line-through' },
          { command: 'code', icon: '<>', title: 'Inline Code' },
        ]
      },
      {
        name: 'list',
        buttons: [
          { command: 'insertUnorderedList', icon: '•≡', title: 'Bullet List' },
          { command: 'insertOrderedList', icon: '1≡', title: 'Numbered List' },
          { command: 'indent', icon: '→≡', title: 'Indent' },
          { command: 'outdent', icon: '←≡', title: 'Outdent' },
        ]
      },
      {
        name: 'insert',
        buttons: [
          { command: 'createLink', icon: '🔗', title: 'Insert Link (Ctrl+K)' },
          { command: 'insertImage', icon: '🖼', title: 'Insert Image' },
          { command: 'insertHorizontalRule', icon: '―', title: 'Horizontal Rule' },
          { command: 'insertTable', icon: '⊞', title: 'Insert Table' },
        ]
      },
    ];

    this.init();
  }

  init() {
    this.el = document.createElement('div');
    this.el.className = 'rte-toolbar';
    this.el.setAttribute('role', 'toolbar');
    this.el.setAttribute('aria-label', 'Text formatting');

    const groups = this.options.groups || this.defaultGroups;

    groups.forEach(group => {
      const groupEl = document.createElement('div');
      groupEl.className = 'rte-toolbar-group';
      groupEl.dataset.group = group.name;

      group.buttons.forEach(btn => {
        const button = this.createButton(btn);
        groupEl.appendChild(button);
      });

      this.el.appendChild(groupEl);
    });

    // Insert toolbar
    if (this.options.container) {
      const container = typeof this.options.container === 'string'
        ? document.querySelector(this.options.container)
        : this.options.container;
      container.appendChild(this.el);
    } else if (this.options.position === 'bottom') {
      this.editor.el.parentNode.insertBefore(this.el, this.editor.el.nextSibling);
    } else {
      this.editor.el.parentNode.insertBefore(this.el, this.editor.el);

    }

    if (this.options.sticky) {
      this.el.style.position = 'sticky';
      this.el.style.top = (this.options.stickyOffset || 0) + 'px';
      this.el.style.zIndex = '100';
    }

    // Listen for selection changes to update active states
    this.editor.on('selection-change', () => this.updateActiveStates());

    // Apply default styles
    this.applyStyles();
  }

  createButton(config) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rte-toolbar-btn';
    btn.innerHTML = config.icon;
    btn.title = config.title || '';
    btn.dataset.command = config.command;
    if (config.value) btn.dataset.value = config.value;
    if (config.style) btn.style.cssText = config.style;

    btn.setAttribute('aria-label', config.title || config.command);
    btn.setAttribute('tabindex', '-1');

    btn.addEventListener('mousedown', (e) => {
      e.preventDefault(); // Prevent focus loss from editor
    });

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      this.executeCommand(config.command, config.value);
    });

    const key = config.command + (config.value ? ':' + config.value : '');
    this.buttons[key] = btn;

    return btn;
  }

  executeCommand(command, value) {
    switch (command) {
      case 'undo':
        this.editor.undo();
        break;
      case 'redo':
        this.editor.redo();
        break;
      case 'bold':
      case 'italic':
      case 'underline':
      case 'strikethrough':
        this.editor.toggleInline(command);
        break;
      case 'code':
        this.editor.toggleInline('code');
        break;
      case 'formatBlock':
        this.editor.setBlockType(value);
        break;
      case 'insertUnorderedList':
        this.editor.toggleList('ul');
        break;
      case 'insertOrderedList':
        this.editor.toggleList('ol');
        break;
      case 'indent':
        this.editor.indent();
        break;
      case 'outdent':
        this.editor.outdent();
        break;
      case 'createLink':
        this.editor.createLink();
        break;
      case 'insertImage':
        this.editor.insertImage();
        break;
      case 'insertHorizontalRule':
        this.editor.insertHorizontalRule();
        break;
      case 'insertTable':
        this.editor.insertTable();
        break;
      default:
        this.editor.focus();
        document.execCommand(command, false, value);
        break;
    }

    this.updateActiveStates();
  }

  updateActiveStates() {
    const formats = this.editor.getActiveFormats();
    const blockType = this.editor.getCurrentBlockType();

    // Update inline format buttons
    for (const [format, active] of Object.entries(formats)) {
      const key = format;
      const btn = this.buttons[key];
      if (btn) {
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', active);
      }
    }

    // Update block type buttons
    for (const [key, btn] of Object.entries(this.buttons)) {
      if (key.startsWith('formatBlock:')) {
        const value = key.split(':')[1];
        const isActive = blockType === value;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-pressed', isActive);
      }
    }

    // Update list buttons
    const listBtn = this.buttons['insertUnorderedList'];
    if (listBtn) {
      const inUL = blockType === 'li' && this.editor.getCurrentBlock()?.parentNode?.tagName === 'UL';
      listBtn.classList.toggle('active', inUL);
    }

    const olBtn = this.buttons['insertOrderedList'];
    if (olBtn) {
      const inOL = blockType === 'li' && this.editor.getCurrentBlock()?.parentNode?.tagName === 'OL';
      olBtn.classList.toggle('active', inOL);
    }
  }

  applyStyles() {
    if (document.getElementById('rte-toolbar-styles')) return;

    const style = document.createElement('style');
    style.id = 'rte-toolbar-styles';
    style.textContent = `
      .rte-toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 2px;
        padding: 6px 8px;
        background: #f8f9fa;
        border: 1px solid #dee2e6;
        border-radius: 6px 6px 0 0;
        user-select: none;
      }

      .rte-toolbar-group {
        display: flex;
        gap: 1px;
        padding: 0 4px;
        border-right: 1px solid #dee2e6;
      }

      .rte-toolbar-group:last-child {
        border-right: none;
      }

      .rte-toolbar-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 32px;
        height: 32px;
        padding: 4px 6px;
        border: 1px solid transparent;
        border-radius: 4px;
        background: transparent;
        color: #495057;
        font-size: 14px;
        font-family: inherit;

        cursor: pointer;
        transition: all 0.15s ease;
        line-height: 1;
      }

      .rte-toolbar-btn:hover {
        background: #e9ecef;
        border-color: #ced4da;
        color: #212529;
      }

      .rte-toolbar-btn.active {
        background: #dee2e6;
        border-color: #ced4da;
        color: #0d6efd;
      }

      .rte-toolbar-btn:focus-visible {
        outline: 2px solid #0d6efd;
        outline-offset: 1px;
      }
    `;
    document.head.appendChild(style);
  }

  show() {
    this.el.style.display = 'flex';
  }

  hide() {
    this.el.style.display = 'none';
  }

  destroy() {
    if (this.el && this.el.parentNode) {
      this.el.parentNode.removeChild(this.el);
    }
  }
}