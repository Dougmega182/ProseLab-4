export class FloatingToolbar {
  constructor(editor) {
    this.editor = editor;
    this.el = null;
    this.isVisible = false;
    this.init();
  }

  init() {
    this.el = document.createElement('div');
    this.el.className = 'rte-floating-toolbar';
    this.el.style.display = 'none';
    document.body.appendChild(this.el);

    this.buildButtons();

    document.addEventListener('selectionchange', () => {
      this.onSelectionChange();
    });

    document.addEventListener('mousedown', (e) => {
      if (!this.el.contains(e.target)) {
        // Will hide on selectionchange
      }

    });

    this.el.addEventListener('mousedown', (e) => {
      e.preventDefault(); // Prevent losing selection
    });

    this.applyStyles();
  }

  buildButtons() {
    const buttons = [
      { cmd: 'bold', icon: '<b>B</b>', title: 'Bold' },
      { cmd: 'italic', icon: '<i>I</i>', title: 'Italic' },
      { cmd: 'underline', icon: '<u>U</u>', title: 'Underline' },
      { cmd: 'strikethrough', icon: '<s>S</s>', title: 'Strikethrough' },
      { cmd: 'code', icon: '&lt;/&gt;', title: 'Inline Code' },
      { cmd: 'link', icon: '🔗', title: 'Insert Link' },
      { cmd: 'h1', icon: 'H1', title: 'Heading 1' },
      { cmd: 'h2', icon: 'H2', title: 'Heading 2' },
      { cmd: 'h3', icon: 'H3', title: 'Heading 3' },
      { cmd: 'quote', icon: '❝', title: 'Blockquote' },
    ];

    buttons.forEach(btn => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'rte-float-btn';
      button.innerHTML = btn.icon;
      button.title = btn.title;
      button.dataset.cmd = btn.cmd;

      button.addEventListener('click', (e) => {
        e.preventDefault();
        this.executeCommand(btn.cmd);
      });

      this.el.appendChild(button);
    });
  }

  executeCommand(cmd) {
    switch (cmd) {
      case 'bold':
        this.editor.toggleBold();
        break;
      case 'italic':
        this.editor.toggleItalic();
        break;
      case 'underline':
        this.editor.toggleUnderline();
        break;
      case 'strikethrough':
        this.editor.toggleStrikethrough();
        break;
      case 'code':
        this.editor.toggleInlineCode();
        break;
      case 'link':
        this.editor.insertLink();
        break;
      case 'h1':
        this.editor.setBlockType('h1');
        break;
      case 'h2':
        this.editor.setBlockType('h2');
        break;
      case 'h3':
        this.editor.setBlockType('h3');
        break;
      case 'quote':
        this.editor.setBlockType('blockquote');
        break;
    }
    this.updateActiveStates();
  }

  onSelectionChange() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      this.hide();
      return;
    }

    const range = sel.getRangeAt(0);
    if (!this.editor.el.contains(range.commonAncestorContainer)) {
      this.hide();
      return;
    }

    const text = sel.toString().trim();
    if (!text) {
      this.hide();
      return;
    }

    this.show(range);
  }

  show(range) {
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      this.hide();
      return;
    }

    this.el.style.display = 'flex';
    this.isVisible = true;

    const toolbarRect = this.el.getBoundingClientRect();
    let left = rect.left + (rect.width / 2) - (toolbarRect.width / 2);
    let top = rect.top - toolbarRect.height - 8 + window.scrollY;

    // Keep within viewport
    if (left < 8) left = 8;
    if (left + toolbarRect.width > window.innerWidth - 8) {
      left = window.innerWidth - toolbarRect.width - 8;
    }
    if (top < window.scrollY + 8) {
      top = rect.bottom + 8 + window.scrollY;
    }

    this.el.style.left = left + 'px';
    this.el.style.top = top + 'px';

    this.updateActiveStates();
  }

  hide() {
    this.el.style.display = 'none';
    this.isVisible = false;
  }

  updateActiveStates() {
    this.el.querySelectorAll('.rte-float-btn').forEach(btn => {
      const cmd = btn.dataset.cmd;
      let active = false;

      switch (cmd) {
        case 'bold':
          active = document.queryCommandState('bold');
          break;
        case 'italic':
          active = document.queryCommandState('italic');
          break;
        case 'underline':
          active = document.queryCommandState('underline');
          break;
        case 'strikethrough':
          active = document.queryCommandState('strikeThrough');
          break;
        case 'code':
          active = this.editor.isInsideTag('CODE');
          break;
        case 'h1':
        case 'h2':
        case 'h3':
          const block = this.editor.getCurrentBlock();
          active = block && block.tagName === cmd.toUpperCase();
          break;
        case 'quote':
          const qBlock = this.editor.getCurrentBlock();
          active = qBlock && qBlock.tagName === 'BLOCKQUOTE';
          break;
      }

      btn.classList.toggle('active', active);
    });
  }

  

  applyStyles() {
    if (document.getElementById('rte-floating-toolbar-styles')) return;

    const style = document.createElement('style');
    style.id = 'rte-floating-toolbar-styles';
    style.textContent = `
      .rte-floating-toolbar {
        position: absolute;
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 2px;
        padding: 4px 6px;
        background: #1e1e1e;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: rte-float-in 0.15s ease-out;
      }

      @keyframes rte-float-in {
        from { opacity: 0; transform: translateY(4px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .rte-float-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 28px;
        border: none;
        border-radius: 4px;
        background: transparent;
        color: #e0e0e0;
        font-size: 13px;
        cursor: pointer;
        transition: background 0.1s, color 0.1s;
      }

      .rte-float-btn:hover {
        background: rgba(255,255,255,0.15);
        color: #fff;
      }

      .rte-float-btn.active {
        background: rgba(255,255,255,0.2);
        color: #60a5fa;
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