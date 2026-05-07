export class InlineFormatPopover {
  constructor(editor) {
    this.editor = editor;
    this.el = null;
    this.visible = false;
    this.build();
  }

  build() {
    this.el = document.createElement('div');
    this.el.className = 'rte-inline-popover';
    this.el.style.display = 'none';
    this.el.contentEditable = 'false';

    const buttons = [
      { cmd: 'bold', icon: '<strong>B</strong>', title: 'Bold' },
      { cmd: 'italic', icon: '<em>I</em>', title: 'Italic' },
      { cmd: 'underline', icon: '<u>U</u>', title: 'Underline' },
      { cmd: 'strikethrough', icon: '<s>S</s>', title: 'Strikethrough' },
      { cmd: 'code', icon: '<code>&lt;/&gt;</code>', title: 'Inline Code' },
      { cmd: 'link', icon: '🔗', title: 'Link' }
    ];

    buttons.forEach(btn => {
      const button = document.createElement('button');
      button.className = 'rte-inline-popover-btn';
      button.innerHTML = btn.icon;
      button.title = btn.title;
      button.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (btn.cmd === 'link') {
          this.editor.linkPopover.show();
          this.hide();
        } else if (btn.cmd === 'code') {
          this.editor.toggleInlineCode();
        } else {
          document.execCommand(btn.cmd, false, null);
          this.editor.history.saveState();
          this.editor.emitChange();
        }
        this.updateButtonStates();

      });
      this.el.appendChild(button);
    });
  }

  updateButtonStates() {
    const buttons = this.el.querySelectorAll('.rte-inline-popover-btn');
    const cmds = ['bold', 'italic', 'underline', 'strikethrough', 'code', 'link'];
    cmds.forEach((cmd, i) => {
      if (cmd === 'link' || cmd === 'code') return;
      const active = document.queryCommandState(cmd);
      buttons[i].classList.toggle('active', active);
    });
  }

  show() {
    const sel = window.getSelection();
    if (!sel.rangeCount || sel.isCollapsed) {
      this.hide();
      return;
    }

    const range = sel.getRangeAt(0);
    if (!this.editor.el.contains(range.commonAncestorContainer)) {
      this.hide();
      return;
    }

    this.updateButtonStates();
    this.el.style.display = 'flex';
    this.visible = true;
    this.position(range);
  }

  hide() {
    this.el.style.display = 'none';
    this.visible = false;
  }

  position(range) {
    const rect = range.getBoundingClientRect();
    const editorRect = this.editor.wrapper.getBoundingClientRect();
    const popoverRect = this.el.getBoundingClientRect();

    let top = rect.top - editorRect.top - popoverRect.height - 8;
    let left = rect.left - editorRect.left + (rect.width / 2) - (popoverRect.width / 2);

    // If above would go off top, show below
    if (top < 0) {
      top = rect.bottom - editorRect.top + 8;
    }

    // Keep within horizontal bounds
    if (left < 0) left = 8;
    if (left + popoverRect.width > editorRect.width) {
      left = editorRect.width - popoverRect.width - 8;
    }

    this.el.style.top = top + 'px';
    this.el.style.left = left + 'px';
  }
}


// ============================================================
// Toolbar
// ============================================================

