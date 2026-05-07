import { HistoryManager } from './HistoryManager.js';
import { Toolbar } from './Toolbar.js';
import { FloatingToolbar } from './FloatingToolbar.js';
import { SlashCommandMenu } from './SlashCommandMenu.js';
import { LinkPopover } from './LinkPopover.js';
import { TableManager } from './TableManager.js';
import { MarkdownShortcuts } from './MarkdownShortcuts.js';
import { DragDropHandler } from './DragDropHandler.js';
import { ClipboardHandler } from './ClipboardHandler.js';
import { InlineMarkdown } from './InlineMarkdown.js';
import { UndoManager } from './UndoManager.js';

export class RichTextEditor {
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;

    if (!this.container) {
      throw new Error('RichTextEditor: Container element not found');
    }

    this.options = {
      placeholder: options.placeholder || 'Start writing, or press / for commands...',
      toolbar: options.toolbar !== false,
      slashCommands: options
.slashCommands !== false,
      markdown: options.markdown !== false,
      dragDrop: options.dragDrop !== false,
      autosave: options.autosave || false,
      autosaveKey: options.autosaveKey || 'rte-autosave',
      autosaveInterval: options.autosaveInterval || 5000,
      onChange: options.onChange || null,
      onReady: options.onReady || null,
      maxHeight: options.maxHeight || null,
      minHeight: options.minHeight || '200px',
      customSlashCommands: options.customSlashCommands || [],
      toolbarButtons: options.toolbarButtons || null,
      ...options
    };

    this.init();
  }

  init() {
    this.applyBaseStyles();
    this.createEditor();

    // Initialize modules
    this.history = new HistoryManager(this);
    this.toolbar = this.options.toolbar ? new Toolbar(this) : null;
    this.clipboardHandler = new ClipboardHandler(this);
    this.dragDropHandler = this.options.dragDrop ? new DragDropHandler(this) : null;
    this.tableManager = new TableManager(this);
    this.linkPopover = new LinkPopover(this);
    this.slashMenu = this.options.slashCommands ? new SlashCommandMenu(this) : null;
    this.markdownShortcuts = this.options.markdown ? new MarkdownShortcuts(this) : null;
    this.inlineMarkdown = this.options.markdown ? new InlineMarkdown(this) : null;

    this.setupEventListeners();
    this.ensureContent();
    this.history.saveState();

    // Autosave
    if (this.options.autosave) {
      this.loadAutosave();
      this.autosaveTimer = setInterval(() => this.autoSave(), this.options.autosaveInterval);
    }

    if (this.options.onReady) {
      this.options.onReady(this);
    }
  }

  createEditor() {
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'rte-wrapper';

    this.el = document.createElement('div');
    this.el.className = 'rte-editor';
    this.el.contentEditable = 'true';
    this.el.setAttribute('role', 'textbox');
    this.el.setAttribute('aria-multiline', 'true');
    this.el.setAttribute('aria-label', 'Rich text editor');
    this.el.setAttribute('data-placeholder', this.options.placeholder);
    this.el.spellcheck = true;

    if (this.options.minHeight) {
      this.el.style.minHeight = this.options.minHeight;
    }
    if (this.options.maxHeight) {
      this.el.style.maxHeight = this.options.maxHeight;
      this.el.style.overflowY = 'auto';
    }

    this.wrapper.appendChild(this.el);
    this.container.appendChild(this.wrapper);
  }

  setupEventListeners() {
    // Input handling
    this.el.addEventListener('input', (e) => this.onInput(e));
    this.el.addEventListener('keydown', (e) => this.onKeyDown(e));
    this.el.addEventListener('keyup', () => this.onKeyUp());

    // Selection change for toolbar updates
    document.addEventListener('selectionchange', () => {
      if (this.el.contains(document.activeElement) || this.el === document.activeElement) {
        if (this.toolbar) this.toolbar.updateState();
      }
    });

    // Focus/blur for placeholder
    this.el.addEventListener('focus', () => {
      this.wrapper.classList.add('rte-focused');
    });

    this.el.addEventListener('blur', () => {
      this.wrapper.classList.remove('rte-focused');
    });

    // Click handler for links
    this.el.addEventListener('click', (e) => {
      const link = e.target.closest('a');
      if (link && this.el.contains(link)) {
        e.preventDefault();
        this.linkPopover.show(link);
      }

      // Handle checklist checkbox clicks
      if (e.target.type === 'checkbox' && e.target.closest('.rte-checklist-item')) {
        this.saveState();
      }
    });

    // Save state debounce
    this._saveDebounce = null;
  }

  onInput(e) {
    this.ensureContent();

    // Check markdown shortcuts on space
    if (e.inputType === 'insertText' && e.data === ' ') {
      if (this.markdownShortcuts && this.markdownShortcuts.check()) {
        return;
      }
    }

    // Check inline markdown
    if (e.inputType === 'insertText' && e.data && this.inlineMarkdown) {
      this.inlineMarkdown.check(e.data);
    }

    this.debounceSave();
    this.notifyChange();
  }

  onKeyDown(e) {
    // Undo/Redo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        this.history.redo();
      } else {
        this.history.undo();
      }
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
      e.preventDefault();
      this.history.redo();
      return;
    }

    // Keyboard shortcuts for formatting
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
          e.
preventDefault();
          this.execCommand('bold');
          return;
        case 'i':
          e.preventDefault();
          this.execCommand('italic');
          return;
        case 'u':
          e.preventDefault();
          this.execCommand('underline');
          return;
        case 'k':
          e.preventDefault();
          this.linkPopover.showInsertDialog();
          return;
        case 'd':
          e.preventDefault();
          this.execCommand('strikeThrough');
          return;
        case 'e':
          e.preventDefault();
          this.toggleInlineCode();
          return;
      }
    }

    // Enter key handling
    if (e.key === 'Enter') {
      this.handleEnter(e);
      return;
    }

    // Backspace handling
    if (e.key === 'Backspace') {
      this.handleBackspace(e);
      return;
    }

    // Slash command trigger
    if (e.key === '/' && this.slashMenu) {
      const block = this.getCurrentBlock();
      if (block && block.textContent.trim() === '') {
        // Will be handled after the character is inserted
      }
    }
  }

  onKeyUp() {
    if (this.toolbar) this.toolbar.updateState();
  }

  handleEnter(e) {
    const block = this.getCurrentBlock();
    if (!block) return;

    const tag = block.tagName.toLowerCase();

    // Shift+Enter: insert line break
    if (e.shiftKey) {
      e.preventDefault();
      document.execCommand('insertLineBreak');
      return;
    }

    // Exit heading on Enter at end of heading
    if (/^h[1-6]$/.test(tag)) {
      const sel = window.getSelection();
      const range = sel.getRangeAt(0);

      // Check if cursor is at the end
      if (this.isCursorAtEnd(block)) {
        e.preventDefault();
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        block.parentNode.insertBefore(p, block.nextSibling);
        const newRange = document.createRange();
        newRange.setStart(p, 0);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
        this.saveState();
        return;
      }
    }

    // Exit blockquote on double Enter (empty line)
    if (tag === 'blockquote' || block.closest('blockquote')) {
      if (block.textContent.trim() === '') {
        e.preventDefault();
        const bq = block.closest('blockquote') || block;
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        if (block.tagName.toLowerCase() === 'blockquote') {
          bq.parentNode.replaceChild(p, bq);
        } else {
          bq.parentNode.insertBefore(p, bq.nextSibling);
          block.remove();
          if (bq.children.length === 0) bq.remove();
        }
        const sel = window.getSelection();
        const range = document.createRange();
        range.setStart(p, 0);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        this.saveState();
        return;
      }
    }

    // Exit code block with triple Enter or Shift+Enter
    if (tag === 'pre' || block.closest('pre')) {
      // Default behavior for code blocks - insert newline
      return;
    }

    // Handle list items
    const li = block.closest ? block.closest('li') : null;
    if (li) {
      if (li.textContent.trim() === '') {
        e.preventDefault();
        const list = li.closest('ul, ol');
        if (list) {
          const p = document.createElement('p');
          p.innerHTML = '<br>';
          list.parentNode.insertBefore(p, list.nextSibling);
          li.remove();
          if (list.children.length === 0) list.remove();
          const sel = window.getSelection();
          const range = document.createRange();
          range.setStart(p, 0);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
          this.saveState();
        }
        return;
      }
    }

    // Default: let browser handle, then save state
    setTimeout(() => {
      this.ensureContent();
      this.saveState();
    }, 0);
  }

  handleBackspace(e) {
    const block = this.getCurrentBlock();
    if (!block) return;

    const tag = block.tagName.toLowerCase();

    // Convert heading/blockquote back to paragraph on backspace at start
    if (this.isCursorAtStart(block)) {
      if (/^h[1-6]$/.test(tag) || tag === 'blockquote') {
        e.preventDefault();
        const p = document.createElement('p');
        p.innerHTML = block.innerHTML;
        block.parentNode.replaceChild(p, block);
        const sel = window.getSelection();
        const range = document.createRange();
        range.setStart(p, 0);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        this.saveState();
        return;
      }
    }
  }

  // ---- Utility Methods ----

  execCommand(command, value = null) {
    this.el.focus();
    document.execCommand(command, false, value);
    this.saveState();
    if (this.toolbar) this.toolbar.updateState();
  }

  toggleInlineCode() {
    const sel = window
.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);

    if (range.collapsed) return;

    // Check if already in code
    let node = range.commonAncestorContainer;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    const existingCode = node.closest('code');

    if (existingCode && !existingCode.closest('pre')) {
      // Remove code formatting
      const parent = existingCode.parentNode;
      while (existingCode.firstChild) {
        parent.insertBefore(existingCode.firstChild, existingCode);
      }
      parent.removeChild(existingCode);
    } else {
      // Apply code formatting
      const content = range.extractContents();
      const code = document.createElement('code');
      code.appendChild(content);
      range.insertNode(code);

      // Place cursor after
      const newRange = document.createRange();
      newRange.setStartAfter(code);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
    }

    this.saveState();
  }

  formatBlock(tag) {
    const block = this.getCurrentBlock();
    if (!block) return;

    if (block.tagName.toLowerCase() === tag) {
      // Toggle off - convert to paragraph
      tag = 'p';
    }

    const newBlock = document.createElement(tag);
    newBlock.innerHTML = block.innerHTML;
    block.parentNode.replaceChild(newBlock, block);

    // Restore cursor
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(newBlock);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);

    this.saveState();
    if (this.toolbar) this.toolbar.updateState();
  }

  toggleList(type) {
    const block = this.getCurrentBlock();
    if (!block) return;

    const li = block.closest ? block.closest('li') : null;

    if (li) {
      const list = li.closest('ul, ol');
      if (list) {
        const currentType = list.tagName.toLowerCase();
        if (currentType === type) {
          // Remove list - convert items to paragraphs
          const items = Array.from(list.querySelectorAll('li'));
          const fragment = document.createDocumentFragment();
          items.forEach(item => {
            const p = document.createElement('p');
            p.innerHTML = item.innerHTML;
            fragment.appendChild(p);
          });
          list.parentNode.replaceChild(fragment, list);
        } else {
          // Switch list type
          const newList = document.createElement(type);
          newList.innerHTML = list.innerHTML;
          if (list.className) newList.className = list.className;
          list.parentNode.replaceChild(newList, list);
        }
      }
    } else {
      // Convert block to list
      const list = document.createElement(type);
      const liNew = document.createElement('li');
      liNew.innerHTML = block.innerHTML;
      list.appendChild(liNew);
      block.parentNode.replaceChild(list, block);

      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(liNew);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }

    this.saveState();
    if (this.toolbar) this.toolbar.updateState();
  }

  toggleBlockquote() {
    const block = this.getCurrentBlock();
    if (!block) return;

    if (block.tagName.toLowerCase() === 'blockquote' || block.closest('blockquote')) {
      const bq = block.tagName.toLowerCase() === 'blockquote' ? block : block.closest('blockquote');
      const p = document.createElement('p');
      p.innerHTML = bq.innerHTML;
      bq.parentNode.replaceChild(p, bq);
    } else {
      const bq = document.createElement('blockquote');
      bq.innerHTML = block.innerHTML;
      block.parentNode.replaceChild(bq, block);
    }

    this.saveState();
    if (this.toolbar) this.toolbar.updateState();
  }

  toggleCodeBlock() {
    const block = this.getCurrentBlock();
    if (!block) return;

    if (block.tagName.toLowerCase() === 'pre' || block.closest('pre')) {
      const pre = block.tagName.toLowerCase() === 'pre' ? block : block.closest('pre');
      const p = document.createElement('p');
      p.textContent = pre.textContent;
      pre.parentNode.replaceChild(p, pre);
    } else {
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      code.textContent = block.textContent;
      pre.appendChild(code);
      block.parentNode.replaceChild(pre, block);
    }

    this.saveState();
    if (this.toolbar) this.toolbar.updateState();
  }

  insertHorizontalRule() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const block = this.getCurrentBlock();
    if (!block) return;

    const hr = document.createElement('hr');
    const p = document.createElement('p');
    p.innerHTML = '<br>';

    block.parentNode.insertBefore(hr, block.nextSibling);
    hr.parentNode.insertBefore(p, hr.nextSibling);

    if (block.textContent.trim() === '') {
      block.remove();
    }

    const range = document.createRange();
    range.set
Start(p, 0);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);

    this.saveState();
  }

  insertImage(src, alt = '') {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      this.el.focus();
    }

    const figure = document.createElement('figure');
    figure.contentEditable = 'false';

    const img = document.createElement('img');
    img.src = src;
    img.alt = alt;
    img.style.maxWidth = '100%';
    img.style.height = 'auto';

    // Resize handle
    const resizeWrapper = document.createElement('div');
    resizeWrapper.className = 'rte-image-wrapper';
    resizeWrapper.contentEditable = 'false';
    resizeWrapper.appendChild(img);

    figure.appendChild(resizeWrapper);

    const caption = document.createElement('figcaption');
    caption.contentEditable = 'true';
    caption.setAttribute('data-placeholder', 'Add a caption...');
    caption.innerHTML = '<br>';
    figure.appendChild(caption);

    const block = this.getCurrentBlock();
    if (block && block.textContent.trim() === '') {
      block.parentNode.replaceChild(figure, block);
    } else if (block) {
      block.parentNode.insertBefore(figure, block.nextSibling);
    } else {
      this.el.appendChild(figure);
    }

    // Add paragraph after figure
    const p = document.createElement('p');
    p.innerHTML = '<br>';
    figure.parentNode.insertBefore(p, figure.nextSibling);

    // Setup image resize
    this.setupImageResize(img, resizeWrapper);

    this.saveState();
  }

  setupImageResize(img, wrapper) {
    const handles = ['nw', 'ne', 'sw', 'se'];
    handles.forEach(pos => {
      const handle = document.createElement('div');
      handle.className = `rte-resize-handle rte-resize-${pos}`;
      handle.contentEditable = 'false';
      wrapper.appendChild(handle);

      handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = img.offsetWidth;
        const startHeight = img.offsetHeight;
        const aspectRatio = startWidth / startHeight;

        const onMouseMove = (e) => {
          let dx = e.clientX - startX;
          let dy = e.clientY - startY;

          if (pos.includes('w')) dx = -dx;
          if (pos.includes('n')) dy = -dy;

          let newWidth = startWidth + dx;
          let newHeight = newWidth / aspectRatio;

          // Minimum size
          newWidth = Math.max(50, newWidth);
          newHeight = Math.max(50, newHeight);

          // Maximum size
          const maxWidth = this.el.clientWidth - 40;
          if (newWidth > maxWidth) {
            newWidth = maxWidth;
            newHeight = newWidth / aspectRatio;
          }

          img.style.width = newWidth + 'px';
          img.style.height = newHeight + 'px';
        };

        const onMouseUp = () => {
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          this.saveState();
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });
    });

    // Click to select
    wrapper.addEventListener('click', () => {
      wrapper.classList.toggle('rte-selected');
    });

    // Remove selection when clicking elsewhere
    document.addEventListener('click', (e) => {
      if (!wrapper.contains(e.target)) {
        wrapper.classList.remove('rte-selected');
      }
    });
  }

  // ---- Block/Cursor Utilities ----

  getCurrentBlock() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;

    let node = sel.getRangeAt(0).startContainer;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;

    // Walk up to find direct child of editor
    while (node && node.parentElement !== this.el) {
      if (node.parentElement === null || node === this.el) return null;
      node = node.parentElement;
    }

    return node;
  }

  isCursorAtStart(block) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return false;

    const range = sel.getRangeAt(0);
    if (!range.collapsed) return false;

    const blockRange = document.createRange();
    blockRange.selectNodeContents(block);
    blockRange.setEnd(range.startContainer, range.startOffset);

    return blockRange.toString().length === 0;
  }

  isCursorAtEnd(block) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return false;

    const range = sel.getRangeAt(0);
    if (!range.collapsed) return false;

    const blockRange = document.createRange();
    blockRange.selectNodeContents(block);
    blockRange.setStart(range.endContainer, range.endOffset);

    return blockRange.toString().length === 0;
  }

  setCursorToEnd() {
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(this.el);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  ensureContent() {
    if (this.el.innerHTML.trim() === '' || this.el.innerHTML === '<br>') {
      this.el.innerHTML = '<p><br></p>';
    }

    // Wrap orphan text nodes in paragraphs
    Array.from(this.el.childNodes).forEach(node => {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== '') {
        const p = document.createElement('p');
        node.parentNode.replaceChild(p, node);
        p.appendChild(node);
      }
    });
  }

  // ---- State Management ----

  saveState() {
    this.history.saveState();
  }

  debounceSave() {
    clearTimeout(this._saveDebounce);
    this._saveDebounce = setTimeout(() => {
      this.saveState();
    }, 300);
  }

  notifyChange() {
    if (this.options.onChange) {
      this.options.onChange({
        html: this.getHTML(),
        text: this.getText(),
        editor: this
      });
    }
  }

  // ---- Autosave ----

  autoSave() {
    try {
      localStorage.setItem(this.options.autosaveKey, this.getHTML());
    } catch (e) {
      console.warn('RTE: Autosave failed', e);
    }
  }

  loadAutosave() {
    try {
      const saved = localStorage.getItem(this.options.autosaveKey);
      if (saved) {
        this.el.innerHTML = saved;
        this.ensureContent();
      }
    } catch (e) {
      console.warn('RTE: Load autosave failed', e);
    }
  }

  clearAutosave() {
    try {
      localStorage.removeItem(this.options.autosaveKey);
    } catch (e) {
      // ignore
    }
  }

  // ---- Public API ----

  getHTML() {
    // Clean up the HTML before returning
    const clone = this.el.cloneNode(true);

    // Remove any UI artifacts
    clone.querySelectorAll('.rte-resize-handle, .rte-slash-menu').forEach(el => el.remove());

    return clone.innerHTML;
  }

  getText() {
    return this.el.textContent || '';
  }

  setHTML(html) {
    this.el.innerHTML = html;
    this.ensureContent();
    this.saveState();
  }

  clear() {
    this.el.innerHTML = '<p><br></p>';
    this.history.clear();
    this.saveState();
  }

  focus() {
    this.el.focus();
  }

  blur() {
    this.el.blur();
  }

  isEmpty() {
    const text = this.el.textContent.trim();
    return text === '' || text === '\u200B';
  }

  getWordCount() {
    const text = this.getText().trim();
    if (!text) return 0;
    return text.split(/\s+/).filter(w => w.length > 0).length;
  }

  getCharCount() {
    return this.getText().length;
  }

  insertHTML(html) {
    this.el.focus();
    document.execCommand('insertHTML', false, html);
    this.saveState();
  }

  insertText(text) {
    this.el.focus();
    document.execCommand('insertText', false, text);
    this.saveState();
  }

  destroy() {
    if (this.autosaveTimer) {
      clearInterval(this.autosaveTimer);
    }

    if (this.slashMenu) {
      this.slashMenu.destroy();
    }

    if (this.toolbar) {
      this.toolbar.destroy();
    }

    if (this.linkPopover) {
      this.linkPopover.destroy();
    }

    if (this.dragDropHandler) {
      this.dragDropHandler.destroy();
    }

    // Remove the wrapper
    if (this.wrapper && this.wrapper.parentNode) {
      this.wrapper.parentNode.removeChild(this.wrapper);
    }

    // Remove injected styles
    const styleEl = document.getElementById('rte-base-styles');
    if (styleEl) styleEl.remove();
  }

  // ---- Styles ----

  applyBaseStyles() {
    if (document.getElementById('rte-base-styles')) return;

    const style = document.createElement('style');
    style.id = 'rte-base-styles';
    style.textContent = `
      .rte-wrapper {
        position: relative;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        background: #fff;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        transition: border-color 0.15s ease;
      }

      .rte-wrapper.rte-focused {
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }

      .rte-editor {
        padding: 16px 24px;
        outline: none;
        line-height: 1.7;
        color: #1f2937;
        font-size: 16px;
      }

      .rte-editor:empty::before {
        content: attr(data-placeholder);
        color: #9ca3af;
        pointer-events: none;
        position: absolute;
      }

      .rte-editor p {
        margin: 0 0
 0.5em 0;
      }

      .rte-editor p:first-child {
        margin-top: 0;
      }

      .rte-editor h1 {
        font-size: 2em;
        font-weight: 700;
        margin: 1em 0 0.5em 0;
        line-height: 1.3;
        color: #111827;
      }

      .rte-editor h2 {
        font-size: 1.5em;
        font-weight: 600;
        margin: 0.8em 0 0.4em 0;
        line-height: 1.35;
        color: #111827;
      }

      .rte-editor h3 {
        font-size: 1.25em;
        font-weight: 600;
        margin: 0.7em 0 0.35em 0;
        line-height: 1.4;
        color: #111827;
      }

      .rte-editor h4 {
        font-size: 1.1em;
        font-weight: 600;
        margin: 0.6em 0 0.3em 0;
        color: #374151;
      }

      .rte-editor h5 {
        font-size: 1em;
        font-weight: 600;
        margin: 0.5em 0 0.25em 0;
        color: #374151;
      }

      .rte-editor h6 {
        font-size: 0.9em;
        font-weight: 600;
        margin: 0.5em 0 0.25em 0;
        color: #6b7280;
      }

      .rte-editor blockquote {
        border-left: 3px solid #3b82f6;
        margin: 0.8em 0;
        padding: 0.5em 1em;
        color: #4b5563;
        background: #f9fafb;
        border-radius: 0 4px 4px 0;
      }

      .rte-editor pre {
        background: #1f2937;
        color: #e5e7eb;
        padding: 16px 20px;
        border-radius: 6px;
        overflow-x: auto;
        margin: 0.8em 0;
        font-family: 'SF Mono', 'Fira Code', 'Fira Mono', Menlo, Consolas, monospace;
        font-size: 0.9em;
        line-height: 1.6;
      }

      .rte-editor pre code {
        background: none;
        padding: 0;
        border-radius: 0;
        color: inherit;
        font-size: inherit;
      }

      .rte-editor code {
        background: #f3f4f6;
        color: #ef4444;
        padding: 2px 6px;
        border-radius: 4px;
        font-family: 'SF Mono', 'Fira Code', 'Fira Mono', Menlo, Consolas, monospace;
        font-size: 0.88em;
      }

      .rte-editor ul,
      .rte-editor ol {
        margin: 0.5em 0;
        padding-left: 1.5em;
      }

      .rte-editor li {
        margin: 0.2em 0;
      }

      .rte-editor hr {
        border: none;
        border-top: 2px solid #e5e7eb;
        margin: 1.5em 0;
      }

      .rte-editor a {
        color: #3b82f6;
        text-decoration: underline;
        cursor: pointer;
      }

      .rte-editor a:hover {
        color: #2563eb;
      }

      .rte-editor mark {
        background: #fef08a;
        padding: 1px 3px;
        border-radius: 2px;
      }

      .rte-editor img {
        max-width: 100%;
        height: auto;
        border-radius: 4px;
      }

      .rte-editor figure {
        margin: 1em 0;
        text-align: center;
      }

      .rte-editor figcaption {
        font-size: 0.9em;
        color: #6b7280;
        margin-top: 0.5em;
        font-style: italic;
      }

      .rte-editor figcaption:empty::before {
        content: attr(data-placeholder);
        color: #9ca3af;
      }

      .rte-editor table {
        border-collapse: collapse;
        width: 100%;
        margin: 1em 0;
      }

      .rte-editor th,
      .rte-editor td {
        border: 1px solid #d1d5db;
        padding: 8px 12px;
        text-align: left;
        min-width: 80px;
      }

      .rte-editor th {
        background: #f9fafb;
        font-weight: 600;
      }

      .rte-editor tr:hover td {
        background: #f9fafb;
      }

      /* Checklist */
      .rte-checklist {
        list-style: none;
        padding-left: 0;
      }

      .rte-checklist-item {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        margin: 4px 0;
      }

      .rte-checklist-item input[type="checkbox"] {
        margin-top: 5px;
        cursor:
 pointer;
        width: 16px;
        height: 16px;
      }

      .rte-checklist-item.checked span {
        text-decoration: line-through;
        color: #9ca3af;
      }

      /* Image wrapper and resize */
      .rte-image-wrapper {
        position: relative;
        display: inline-block;
        max-width: 100%;
      }

      .rte-image-wrapper .rte-resize-handle {
        display: none;
        position: absolute;
        width: 10px;
        height: 10px;
        background: #3b82f6;
        border: 2px solid #fff;
        border-radius: 50%;
        z-index: 10;
      }

      .rte-image-wrapper.rte-selected .rte-resize-handle {
        display: block;
      }

      .rte-image-wrapper.rte-selected {
        outline: 2px solid #3b82f6;
        outline-offset: 2px;
        border-radius: 4px;
      }

      .rte-resize-nw { top: -5px; left: -5px; cursor: nw-resize; }
      .rte-resize-ne { top: -5px; right: -5px; cursor: ne-resize; }
      .rte-resize-sw { bottom: -5px; left: -5px; cursor: sw-resize; }
      .rte-resize-se { bottom: -5px; right: -5px; cursor: se-resize; }

      /* Toolbar */
      .rte-toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 2px;
        padding: 8px 12px;
        border-bottom: 1px solid #e5e7eb;
        background: #f9fafb;
        border-radius: 8px 8px 0 0;
        align-items: center;
        position: sticky;
        top: 0;
        z-index: 10;
      }

      .rte-toolbar-group {
        display: flex;
        gap: 2px;
        align-items: center;
      }

      .rte-toolbar-group + .rte-toolbar-group {
        margin-left: 4px;
        padding-left: 6px;
        border-left: 1px solid #e5e7eb;
      }

      .rte-toolbar button {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border: none;
        background: transparent;
        border-radius: 4px;
        cursor: pointer;
        color: #4b5563;
        font-size: 14px;
        transition: all 0.15s ease;
        padding: 0;
      }

      .rte-toolbar button:hover {
        background: #e5e7eb;
        color: #1f2937;
      }

      .rte-toolbar button.active {
        background: #dbeafe;
        color: #2563eb;
      }

      .rte-toolbar button:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      .rte-toolbar button svg {
        width: 18px;
        height: 18px;
        stroke: currentColor;
        fill: none;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      .rte-toolbar select {
        height: 32px;
        border: 1px solid #d1d5db;
        border-radius: 4px;
        background: #fff;
        color: #374151;
        font-size: 13px;
        padding: 0 8px;
        cursor: pointer;
        outline: none;
      }

      .rte-toolbar select:focus {
        border-color: #3b82f6;
      }

      .rte-toolbar .rte-separator {
        width: 1px;
        height: 24px;
        background: #e5e7eb;
        margin: 0 4px;
      }

      /* Slash command menu */
      .rte-slash-menu {
        position: absolute;
        z-index: 1000;
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1), 0 4px 10px rgba(0, 0, 0, 0.05);
        max-height: 320px;
        overflow-y: auto;
        min-width: 240px;
        padding: 4px;
      }

      .rte-slash-menu-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 12px;
        cursor: pointer;
        border-radius: 6px;
        transition: background 0.1s ease;
      }

      .rte-slash-menu-item:hover,
      .rte-slash-menu-item.active {
        background: #f3f4f6;
      }

      .rte-slash-menu-item-icon {
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f3f4f6;
        border-radius: 6px;
        font-size: 18px;
        flex-shrink: 0;
      }

      .rte-slash-menu-item.active .rte-slash-menu-item-icon {
        background: #dbeafe;
      }

      .rte-slash-menu-item-text {
        display: flex;
        flex-direction: column;
      }

      .rte-slash-menu-item-title {
        font-size: 14px;
        font-weight: 500;
        color: #1f2937;
      }

      .rte-slash-menu-item-desc {
        font-size: 12px;
        color: #6b7280;
      }

      .rte-slash-menu-empty {
        padding: 16px;
        text-align: center;
        color: #9ca3af;
        font-size: 14px;
      }

      /* Link popover */
      .rte-link-popover {
        position: absolute;
        z-index: 1000;
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
        padding: 12px;
        min-width: 300px;
      }

      .rte-link-popover input {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        font-size: 14px;
        outline: none;
        box-sizing: border-box;
        margin-bottom: 8px;
        transition: border-color 0.15s ease;
      }

      .rte-link-popover input:focus {
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }

      .rte-link-popover-buttons {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
      }

      .rte-link-popover-buttons button {
        padding: 6px 14px;
        border: none;
        border-radius: 6px;
        font-size: 13px;
        cursor: pointer;
        font-weight: 500;
        transition: all 0.15s ease;
      }

      .rte-link-popover-buttons .rte-btn-primary {
        background: #3b82f6;
        color: #fff;
      }

      .rte-link-popover-buttons .rte-btn-primary:hover {
        background: #2563eb;
      }

      .rte-link-popover-buttons .rte-btn-secondary {
        background: #f3f4f6;
        color: #374151;
      }

      .rte-link-popover-buttons .rte-btn-secondary:hover {
        background: #e5e7eb;
      }

      .rte-link-popover-buttons .rte-btn-danger {
        background: #fef2f2;
        color: #ef4444;
      }

      .rte-link-popover-buttons .rte-btn-danger:hover {
        background: #fee2e2;
      }

      /* Link hover tooltip */
      .rte-link-tooltip {
        position: absolute;
        z-index: 999;
        background: #1f2937;
        color: #fff;
        padding: 4px 10px;
        border-radius: 4px;
        font-size: 12px;
        white-space: nowrap;
        pointer-events: auto;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .rte-link-tooltip a {
        color: #93c5fd;
        text-decoration: none;
      }

      .rte-link-tooltip a:hover {
        text-decoration: underline;
      }

      .rte-link-tooltip button {
        background: none;
        border: none;
        color: #9ca3af;
        cursor: pointer;
        padding: 2px;
        font-size: 12px;
      }

      .rte-link-tooltip button:hover {
        color: #fff;
      }

      /* Drag and drop */
      .rte-drag-over {
        background: #eff6ff !important;
      }

      .rte-drag-indicator {
        position: absolute;
        left: 0;
        right: 0;
        height: 3px;
        background: #3b82f6;
        border-radius: 2px;
        pointer-events: none;
        z-index: 100;
      }

      .rte-drag-handle {
        position: absolute;
        left: -24px;
        top: 50%;
        transform: translateY(-50%);
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: grab;
        color: #d1d5db;
        border-radius: 4px;
        opacity: 0;
        transition: opacity 0.15s ease;
      }

      .rte-editor > *:hover > .rte-drag-handle,
      .rte-drag-handle:hover {
        opacity: 1;
        color: #9ca3af;
      }

      /* Word count bar */
      .rte-status-bar {
        display: flex;
        justify-content: flex-end;
        gap: 16px;
        padding: 6px 16px;
        border-top: 1px solid #e5e7eb;
        background: #f9fafb;
        border-radius: 0 0 8px 8px;
        font-size: 12px;
        color: #9ca3af;
      
      }

      /* Scrollbar styling */
      .rte-slash-menu::-webkit-scrollbar {
        width: 6px;
      }

      .rte-slash-menu::-webkit-scrollbar-track {
        background: transparent;
      }

      .rte-slash-menu::-webkit-scrollbar-thumb {
        background: #d1d5db;
        border-radius: 3px;
      }

      .rte-slash-menu::-webkit-scrollbar-thumb:hover {
        background: #9ca3af;
      }

      /* Selection styling */
      .rte-editor ::selection {
        background: #bfdbfe;
      }

      /* Print styles */
      @media print {
        .rte-toolbar,
        .rte-status-bar,
        .rte-resize-handle,
        .rte-drag-handle {
          display: none !important;
        }

        .rte-wrapper {
          border: none !important;
          box-shadow: none !important;
        }
      }

      /* Animations */
      @keyframes rte-fade-in {
        from { opacity: 0; transform: translateY(-4px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .rte-slash-menu,
      .rte-link-popover {
        animation: rte-fade-in 0.15s ease;
      }

      /* Table cell selection */
      .rte-editor td.selected,
      .rte-editor th.selected {
        background: #dbeafe;
      }

      /* Placeholder for empty blocks */
      .rte-editor > *:only-child:empty::before {
        content: attr(data-placeholder);
        color: #9ca3af;
        pointer-events: none;
      }
    `;

    document.head.appendChild(style);
  }
}


// ============================================================
// Toolbar
// ============================================================

class RichTextToolbar {
  constructor(editor) {
    this.editor = editor;
    this.el = null;
    this.buttons = {};
    this.build();
  }

  build() {
    this.el = document.createElement('div');
    this.el.className = 'rte-toolbar';
    this.el.setAttribute('role', 'toolbar');

    const groups = this.getButtonGroups();

    groups.forEach((group, i) => {
      const groupEl = document.createElement('div');
      groupEl.className = 'rte-toolbar-group';

      group.forEach(btn => {
        if (btn.type === 'select') {
          const select = this.createSelect(btn);
          groupEl.appendChild(select);
        } else {
          const button = this.createButton(btn);
          groupEl.appendChild(button);
        }
      });

      this.el.appendChild(groupEl);
    });

    // Listen for selection changes to update active states
    document.addEventListener('selectionchange', () => {
      if (this.editor.el.contains(document.activeElement) ||
          document.activeElement === this.editor.el) {
        this.updateState();
      }
    });
  }

  getButtonGroups() {
    return [
      // Block type select
      [
        {
          type: 'select',
          id: 'blockType',
          options: [
            { value: 'p', label: 'Paragraph' },
            { value: 'h1', label: 'Heading 1' },
            { value: 'h2', label: 'Heading 2' },
            { value: 'h3', label: 'Heading 3' },
            { value: 'h4', label: 'Heading 4' },
            { value: 'h5', label: 'Heading 5' },
            { value: 'h6', label: 'Heading 6' },
          ],
          onChange: (value) => this.editor.formatBlock(value)
        }
      ],
      // Inline formatting
      [
        {
          id: 'bold',
          icon: this.icons.bold,
          title: 'Bold (Ctrl+B)',
          action: () => this.editor.toggleBold()
        },
        {
          id: 'italic',
          icon: this.icons.italic,
          title: 'Italic (Ctrl+I)',
          action: () => this.editor.toggleItalic()
        },
        {
          id: 'underline',
          icon: this.icons.underline,
          title: 'Underline (Ctrl+U)',
          action: () => this.editor.toggleUnderline()
        },
        {
          id: 'strikethrough',
          icon: this.icons.strikethrough,
          title: 'Strikethrough',
          action: () => this.editor.toggleStrikethrough()
        },
        {
          id: 'code',
          icon: this.icons.code,
          title: 'Inline Code',
          action: () => this.editor.toggleInlineCode()
        }
      ],
      // Lists
      [
        {
          id: 'ul',
          icon: this.icons.ul,
          title: 'Bullet List',
          action: () => this.editor.toggleList('ul')
        },
        {
          id: 'ol',
          icon: this.icons.ol,
          title: 'Numbered List',
          action: () => this.editor.toggleList('ol')
        },
        {
          id: 'checklist',
          icon: this.icons.checklist,
          title: 'Checklist',
          action: () => this.editor.insertChecklist()
        }
      ],
      // Block formatting
      [
        {
          id: 'blockquote',
          icon: this.icons.blockquote,
          title: 
'Blockquote',
          action: () => this.editor.toggleBlockquote()
        },
        {
          id: 'codeblock',
          icon: this.icons.codeblock,
          title: 'Code Block',
          action: () => this.editor.insertCodeBlock()
        },
        {
          id: 'hr',
          icon: this.icons.hr,
          title: 'Horizontal Rule',
          action: () => this.editor.insertHorizontalRule()
        }
      ],
      // Insert
      [
        {
          id: 'link',
          icon: this.icons.link,
          title: 'Insert Link (Ctrl+K)',
          action: () => this.editor.linkPopover.show()
        },
        {
          id: 'image',
          icon: this.icons.image,
          title: 'Insert Image',
          action: () => this.promptImage()
        },
        {
          id: 'table',
          icon: this.icons.table,
          title: 'Insert Table',
          action: () => this.editor.insertTable()
        }
      ],
      // History
      [
        {
          id: 'undo',
          icon: this.icons.undo,
          title: 'Undo (Ctrl+Z)',
          action: () => this.editor.history.undo()
        },
        {
          id: 'redo',
          icon: this.icons.redo,
          title: 'Redo (Ctrl+Y)',
          action: () => this.editor.history.redo()
        }
      ]
    ];
  }

  get icons() {
    return {
      bold: '<svg viewBox="0 0 24 24"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>',
      italic: '<svg viewBox="0 0 24 24"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>',
      underline: '<svg viewBox="0 0 24 24"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg>',
      strikethrough: '<svg viewBox="0 0 24 24"><path d="M16 4c-.5-1.5-2.5-3-5-3-3 0-5 2-5 4.5 0 2 1.5 3.5 3 4.5"/><path d="M8 20c.5 1.5 2.5 3 5 3 3 0 5-2 5-4.5 0-2-1.5-3.5-3-4.5"/><line x1="2" y1="12" x2="22" y2="12"/></svg>',
      code: '<svg viewBox="0 0 24 24"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
      ul: '<svg viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg>',
      ol: '<svg viewBox="0 0 24 24"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><text x="4" y="8" font-size="8" fill="currentColor" stroke="none" font-family="sans-serif">1</text><text x="4" y="14" font-size="8" fill="currentColor" stroke="none" font-family="sans-serif">2</text><text x="4" y="20" font-size="8" fill="currentColor" stroke="none" font-family="sans-serif">3</text></svg>',
      checklist: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="6" height="6" rx="1"/><polyline points="4.5 8 6 9.5 8.5 6.5" stroke-width="1.5"/><line x1="12" y1="8" x2="21" y2="8"/><rect x="3" y="14" width="6" height="6" rx="1"/><line x1="12" y1="17" x2="21" y2="17"/></svg>',
      blockquote: '<svg viewBox="0 0 24 24"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0
 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21" fill="none"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 8" fill="none"/></svg>',
      codeblock: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><polyline points="9 8 5 12 9 16"/><polyline points="15 8 19 12 15 16"/></svg>',
      hr: '<svg viewBox="0 0 24 24"><line x1="2" y1="12" x2="22" y2="12" stroke-width="2"/></svg>',
      link: '<svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
      image: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
      table: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>',
      undo: '<svg viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>',
      redo: '<svg viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>'
    };
  }

  createButton(config) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.innerHTML = config.icon;
    btn.title = config.title;
    btn.setAttribute('data-command', config.id);

    btn.addEventListener('mousedown', (e) => {
      e.preventDefault(); // Prevent focus loss
    });

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      config.action();
      this.updateState();
    });

    this.buttons[config.id] = btn;
    return btn;
  }

  createSelect(config) {
    const select = document.createElement('select');
    select.title = 'Block type';
    select.setAttribute('data-command', config.id);

    config.options.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      select.appendChild(option);
    });

    select.addEventListener('mousedown', (e) => {
      // Don't prevent default for select - it needs to open
    });

    select.addEventListener('change', (e) => {
      config.onChange(e.target.value);
      this.editor.el.focus();
    });

    this.buttons[config.id] = select;
    return select;
  }

  updateState() {
    // Update inline format buttons
    const inlineCommands = {
      bold: 'bold',
      italic: 'italic',
      underline: 'underline',
      strikethrough: 'strikeThrough'
    };

    Object.entries(inlineCommands).forEach(([id, command]) => {
      const btn = this.buttons[id];
      if (btn) {
        try {
          const active = document.queryCommandState(command);
          btn.classList.toggle('active', active);
        } catch (e) {
          // ignore
        }
      }
    });

    // Update block type select
    const blockSelect = this.buttons.blockType;
    if (blockSelect) {
      const block = this.editor.getParentBlock();
      if (block) {
        const tag = block.tagName.toLowerCase();
        if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
          blockSelect.value = tag;
        } else {
          blockSelect.value = 'p';
        }
      }
    }

    // Update list buttons
    const inList = (type) => {
      const block = this.editor.getParentBlock();
      if (!block) return false;
      const list = block.closest(type);
      return !!list;
    };

    if (this.buttons.ul) {
      this.buttons.ul.classList.toggle('active', inList('ul'));
    }
    if (this.buttons.ol) {
      this.buttons.ol.classList.toggle('active', inList('ol'));
    }

    // Update blockquote button
    if (this.buttons.blockquote) {
      const block = this.editor.getParentBlock();
      const inBlockquote = block && !!block.closest('blockquote');
      this.buttons.blockquote.classList.toggle('active', inBlockquote);
    }

    // Update code button
    if (this.buttons.code) {
      const sel = window.getSelection();
      if (sel.rangeCount > 0) {
        const node = sel.anchorNode;
        const codeParent = node && (node.nodeType === 3 ? node.parentElement : node).closest('code');
        const inPre = codeParent && codeParent.closest('pre');
        this.buttons.code.classList.toggle('active', !!codeParent && !inPre);
      }
    }

    // Update undo/redo
    if (this.buttons.undo) {
      this.buttons.undo.disabled = !this.editor.history.canUndo();
    }
    if (this.buttons.redo) {
      this.buttons.redo.disabled = !this.editor.history.canRedo();
    }
  }

  promptImage() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        this.editor.insertImageFile(file);
      }
    });
    input.click();
  }
}


// ============================================================
// History (Undo/Redo)
// ============================================================

class RichTextHistory {
  constructor(editor) {
    this.editor = editor;
    this.undoStack = [];
    this.redoStack = [];
    this.maxSize = 100;
    this.debounceTimer = null;
    this.lastSavedContent = '';
  }

  saveState() {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this._pushState();
    }, 300);
  }

  saveStateImmediate() {
    clearTimeout(this.debounceTimer);
    this._pushState();
  }

  _pushState() {
    const content = this.editor.el.innerHTML;
    if (content === this.lastSavedContent) return;

    this.undoStack.push({
      html: content,
      selection: this.saveSelection()
    });

    if (this.undoStack.length > this.maxSize) {
      this.undoStack.shift();
    }

    this.redoStack = [];
    this.lastSavedContent = content;
  }

  undo() {
    if (!this.canUndo()) return;

    const currentContent = this.editor.el.innerHTML;
    this.redoStack.push({
      html: currentContent,
      selection: this.saveSelection()
    });

    const state = this.undoStack.pop();
    this.lastSavedContent = state.html;
    this.editor.el.innerHTML = state.html;

    if (state.selection) {
      this.restoreSelection(state.selection);
    }

    this.editor.emitChange();
    this.editor.toolbar.updateState();
  }

  redo() {
    if (!this.canRedo()) return;

    const currentContent = this.editor.el.innerHTML;
    this.undoStack.push({
      html: currentContent,
      selection: this.saveSelection()
    });

    const state = this.redoStack.pop();
    this.lastSavedContent = state.html;
    this.editor.el.innerHTML = state.html;

    if (state.selection) {
      this.restoreSelection(state.selection);
    }

    this.editor.emitChange();
    this.editor.toolbar.updateState();
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  saveSelection() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return null;

    const range = sel.getRangeAt(0);
    if (!this.editor.el.contains(range.commonAncestorContainer)) return null;

    return {
      startPath: this.getNodePath(range.startContainer),
      startOffset: range.startOffset,
      endPath: this.getNodePath(range.endContainer),
      endOffset: range.endOffset
    };
  }

  restoreSelection(saved) {
    if (!saved) return;

    try {
      const startNode = this.resolveNodePath(saved.startPath);
      const endNode = this.resolveNodePath(saved.endPath);

      if (startNode && endNode) {
        const range = document.createRange();
        range.setStart(startNode, Math.min(saved.startOffset, startNode.length || startNode.childNodes.length));
        range.setEnd(endNode, Math.min(saved.endOffset, endNode.length || endNode.childNodes.length));

        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    } catch (e) {
      // Selection restoration failed, that's okay
    }
  }

  getNodePath(node) {
    const path = [];
    let current = node;
    while (current && current !== this.editor.el) {
      const parent = current.parentNode;
      if (!parent) break;
      const index = Array.from(parent.childNodes).indexOf(current);
      path.unshift
(index);
      current = parent;
    }
    return path;
  }

  resolveNodePath(path) {
    let node = this.editor.el;
    for (const index of path) {
      if (!node || !node.childNodes[index]) return null;
      node = node.childNodes[index];
    }
    return node;
  }
}


// ============================================================
// Slash Command Menu
// ============================================================
