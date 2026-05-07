export class LinkPopover {
  constructor(editor) {
    this.editor = editor;
    this.el = null;
    this.visible = false;
    this.savedRange = null;
    this.editingLink = null;
    this.build();
  }

  build() {
    this.el = document.createElement('div');
    this.el.className = 'rte-link-popover';
    this.el.style.display = 'none';

    this.el.innerHTML = `
      <input type="text" class="rte-link-url" placeholder="Enter URL..." />
      <input type="text" class="rte-link-text" placeholder="Link text (optional)" />
      <div class="rte-link-popover-buttons">
        <button class="rte-btn-danger rte-link-remove" style="display:none">Remove</button>
        <button class="rte-btn-secondary rte-link-cancel">Cancel</button>
        <button class="rte-btn-primary rte-link-save">Save</button>
      </div>
    `;

    this.urlInput = this.el.querySelector('.rte-link-url');
    this.textInput = this.el.querySelector('.rte-link-text');
    this.removeBtn = this.el.querySelector('.rte-link-remove');
    this.cancelBtn = this.el.querySelector('.rte-link-cancel');
    this.saveBtn = this.el.querySelector('.rte-link-save');

    this.saveBtn.addEventListener('click', (e) => {

      e.preventDefault();
      this.save();
    });

    this.cancelBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.hide();
    });

    this.removeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.removeLink();
    });

    this.urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.save();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.hide();
      }
    });

    this.textInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.save();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.hide();
      }
    });

    // Prevent clicks inside popover from stealing focus in a bad way
    this.el.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });
  }

  show(existingLink) {
    // Save current selection
    const sel = window.getSelection();
    if (sel.rangeCount > 0) {
      this.savedRange = sel.getRangeAt(0).cloneRange();
    }

    this.editingLink = existingLink || null;

    if (this.editingLink) {
      this.urlInput.value = this.editingLink.getAttribute('href') || '';
      this.textInput.value = this.editingLink.textContent || '';
      this.removeBtn.style.display = 'inline-block';
    } else {
      this.urlInput.value = '';
      this.textInput.value = sel.toString() || '';
      this.removeBtn.style.display = 'none';
    }

    this.el.style.display = 'block';
    this.visible = true;
    this.position();

    setTimeout(() => this.urlInput.focus(), 50);
  }

  hide() {
    this.el.style.display = 'none';
    this.visible = false;
    this.editingLink = null;

    // Restore focus to editor
    if (this.savedRange) {
      this.editor.el.focus();
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(this.savedRange);
      this.savedRange = null;
    }
  }

  save() {
    const url = this.urlInput.value.trim();
    if (!url) {
      this.hide();
      return;
    }

    // Ensure URL has protocol
    let href = url;
    if (!/^https?:\/\//i.test(href) && !href.startsWith('mailto:') && !href.startsWith('#')) {
      href = 'https://' + href;
    }

    const text = this.textInput.value.trim() || href;

    this.editor.history.saveStateImmediate();

    if (this.editingLink) {
      this.editingLink.setAttribute('href', href);
      this.editingLink.textContent = text;
    } else {
      // Restore selection
      if (this.savedRange) {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(this.savedRange);
      }

      const sel = window.getSelection();
      if (sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);

        const a = document.createElement('a');
        a.href = href;
        a.textContent = text;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';

        range.deleteContents();
        range.insertNode(a);

        // Move cursor after link
        range.setStartAfter(a);
        range.setEndAfter(a);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }

    this.savedRange = null;
    this.el.style.display = 'none';
    this.visible = false;
    this.editingLink = null;

    this.editor.el.focus();
    this.editor.history.saveStateImmediate();
    this.editor.emitChange();
  }

  removeLink() {
    if (!this.editingLink) return;

    this.editor.history.saveStateImmediate();

    const parent = this.editingLink.parentNode;
    while (this.editingLink.firstChild) {
      parent.insertBefore(this.editingLink.firstChild, this.editingLink);
    }
    parent.removeChild(this.editingLink);

    this.hide();
    this.editor.history.saveStateImmediate();
    this.editor.emitChange();
  }

  position() {
    if (!this.savedRange) return;

    const rect = this.savedRange.getBoundingClientRect();
    const editorRect = this.editor.wrapper.getBoundingClientRect();

    let top = rect.bottom - editorRect.top + 8;
    let left = rect.left - editorRect.left;

    // Keep within editor bounds
    const popoverWidth = 320;
    if (left + popoverWidth > editorRect.width) {
      left = editorRect.width - popoverWidth - 8;
    }
    if (left < 0) left = 8;

    this.el.style.top = top + 'px';
    this.el.style.left = left + 'px';
  }
}


// ============================================================
// Drag & Drop Manager
// ============================================================

class DragDropManager {
  constructor(editor) {
    this.editor = editor;
    this.draggedBlock = null;
    this.placeholder = null;

    this.dragHandle = null;
    this.init();
  }

  init() {
    this.editor.el.addEventListener('dragover', (e) => this.onDragOver(e));
    this.editor.el.addEventListener('drop', (e) => this.onDrop(e));
    this.editor.el.addEventListener('dragend', (e) => this.onDragEnd(e));

    // Handle file drops
    this.editor.el.addEventListener('dragover', (e) => {
      if (e.dataTransfer.types.includes('Files')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        this.editor.el.classList.add('rte-drag-over');
      }
    });

    this.editor.el.addEventListener('dragleave', (e) => {
      if (!this.editor.el.contains(e.relatedTarget)) {
        this.editor.el.classList.remove('rte-drag-over');
      }
    });

    this.editor.el.addEventListener('drop', (e) => {
      this.editor.el.classList.remove('rte-drag-over');
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        e.preventDefault();
        Array.from(files).forEach(file => {
          if (file.type.startsWith('image/')) {
            this.editor.insertImageFile(file);
          }
        });
      }
    });
  }

  addDragHandle(block) {
    if (block.querySelector('.rte-drag-handle')) return;
    if (['LI', 'TD', 'TH', 'TR'].includes(block.tagName)) return;

    const handle = document.createElement('div');
    handle.className = 'rte-drag-handle';
    handle.contentEditable = 'false';
    handle.innerHTML = '⠿';
    handle.draggable = true;
    handle.title = 'Drag to reorder';

    handle.addEventListener('dragstart', (e) => {
      this.draggedBlock = block;
      block.classList.add('rte-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', '');
    });

    block.style.position = 'relative';
    block.insertBefore(handle, block.firstChild);
  }

  removeDragHandles() {
    this.editor.el.querySelectorAll('.rte-drag-handle').forEach(h => h.remove());
  }

  onDragOver(e) {
    if (!this.draggedBlock) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const target = this.getDropTarget(e);
    if (target && target !== this.draggedBlock) {
      const rect = target.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;

      this.removePlaceholder();
      this.placeholder = document.createElement('div');
      this.placeholder.className = 'rte-drop-placeholder';

      if (e.clientY < midY) {
        target.parentNode.insertBefore(this.placeholder, target);
      } else {
        target.parentNode.insertBefore(this.placeholder, target.nextSibling);
      }
    }
  }

  onDrop(e) {
    if (!this.draggedBlock || !this.placeholder) return;
    e.preventDefault();

    this.editor.history.saveStateImmediate();
    this.placeholder.parentNode.insertBefore(this.draggedBlock, this.placeholder);
    this.cleanup();
    this.editor.history.saveStateImmediate();
    this.editor.emitChange();
  }

  onDragEnd(e) {
    this.cleanup();
  }

  cleanup() {
    if (this.draggedBlock) {
      this.draggedBlock.classList.remove('rte-dragging');
    }
    this.removePlaceholder();
    this.draggedBlock = null;
  }

  removePlaceholder() {
    if (this.placeholder && this.placeholder.parentNode) {
      this.placeholder.parentNode.removeChild(this.placeholder);
    }
    this.placeholder = null;
  }

  getDropTarget(e) {
    const elements = this.editor.el.children;
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      if (el === this.placeholder || el.classList.contains('rte-drag-handle')) continue;
      const rect = el.getBoundingClientRect();
      if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
        return el;
      }
    }
    return null;
  }
}