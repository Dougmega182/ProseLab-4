// src/ui/components/Editor.js

import { Component } from '../component.js';

export class Editor extends Component {
  setup() {
    this.state = {
      content: '',
      editable: true,
      focusMode: false,
      typewriterMode: false,
      paragraphFocus: false,
      fontSize: 16,
      fontFamily: 'Georgia, serif',
      lineHeight: 1.8,
      maxWidth: 700,
      theme: 'light'
    };

    this.undoStack = [];
    this.redoStack = [];
    this.undoTimer = null;
    this.lastContent = '';
    this.isComposing = false;
    this.wordCountTimer = null;
  }

  template() {
    const s = this.state;
    const classes = [
      'editor-container',
      s.focusMode ? 'focus-mode' : '',
      s.typewriterMode ? 'typewriter-mode' : '',
      s.paragraphFocus ? 'paragraph-focus' : ''
    ].filter(Boolean).join(' ');

    return `
      <div class="${classes}">
        <div class="editor-scroll">
          <div class="editor-content"
               id="editor-content"
               contenteditable="${s.editable}"
               spellcheck="true"
               role="textbox"
               aria-multiline="true"
               aria-label="Document editor"
               style="font-family: ${s.fontFamily}; font-size: ${s.fontSize}px; line-height: ${s.lineHeight}; max-width: ${s.maxWidth}px;">
          </div>
        </div>
      </div>
    `;
  }

  afterMount() {
    this.editorEl = this.$('#editor-content');
    if (!this.editorEl) return;

    // Set initial content
    if (this.state.content) {
      this.editorEl.innerHTML = this.state.content;
    }

    this.lastContent = this.editorEl.innerHTML;
    this.saveUndoState();

    // Input handling
    this.on(this.editorEl, 'input', (e) => {
      if (this.isComposing) return;
      this.onContentChange(e);
    });

    this.on(this.editorEl, 'compositionstart', () => {
      this.isComposing = true;
    });

    this.on(this.editorEl, 'compositionend', (e) => {
      this.isComposing = false;
      this.onContentChange(e);
    });

    // Keyboard shortcuts
    this.on(this.editorEl, 'keydown', (e) => {
      this.handleKeydown(e);
    });

    // Selection change for toolbar updates
    this.on(document, 'selectionchange', () => {
      if (!this.editorEl.contains(document.activeElement) &&
          document.activeElement !== this.editorEl) return;
      this.onSelectionChange();
    });

    // Paste handling
    this.on(this.editorEl, 'paste', (e) => {
      this.handlePaste(e);
    });

    // Drop handling
    this.on(this.editorEl, 'drop', (e) => {
      this.handleDrop(e);
    });

    // Focus/blur
    this.on(this.editorEl, 'focus', () => {
      this.emit('editor-focus');
    });

    this.on(this.editorEl, 'blur', () => {
      this.emit('editor-blur');
    });

    // Scroll for typewriter mode
    if (this.state.typewriterMode) {
      this.on(this.editorEl.parentElement, 'scroll', () => {
        this.updateTypewriterScroll();
      });
    }
  }

  onContentChange(e) {
    // Debounced undo snapshot
    clearTimeout(this.undoTimer);
    this.undoTimer = setTimeout(() => {
      this.saveUndoState();
    }, 500);

    // Debounced word count
    clearTimeout(this.wordCountTimer);
    this.wordCountTimer = setTimeout(() => {
      this.updateWordCount();
    }, 300);

    this.emit('content-change', {
      content: this.editorEl.innerHTML,
      inputType: e?.inputType
    });

    // Paragraph focus mode
    if (this.state.paragraphFocus) {
      this.updateParagraphFocus();
    }
  }

  handleKeydown(e) {
    // Ctrl/Cmd key combos
    const mod = e.ctrlKey || e.metaKey;

    if (mod && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      this.undo();
      return;
    }

    if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault();
      this.redo();
      return;
    }

    if (mod && e.key === 'b') {
      e.preventDefault();
      this.execCommand('bold');
      return;
    }

    if (mod && e.key === 'i') {
      e.preventDefault();
      this.execCommand('italic');
      return;
    }

    if (mod && e.key === 'u') {
      e.preventDefault();
      this.execCommand('underline');
      return;
    }

    if (mod && e.key === 's') {
      e.preventDefault();
      this.emit('editor-save');
      return;
    }

    if (mod && e.key === 'f') {
      e.preventDefault();
      this.emit('editor-find');
      return;
    }

    if (mod && e.key === 'h') {
      e.preventDefault();
      this.emit('editor-find-replace');
      return;
    }

    // Tab key for indentation
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        this.execCommand('outdent');
      } else {
        this.execCommand('indent');
      }
      return;
    }

    // Enter key handling for clean paragraphs
    if (e.key === 'Enter' && !e.shiftKey) {
      const block = this.getCurrentBlock();
      if (block && block.tagName === 'DIV' && !block.classList.length) {
        e.preventDefault();
        this.execCommand('formatBlock', 'p');
        this.execCommand('insertParagraph');
      }
    }

    // Shift+Enter for line break
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      this.execCommand('insertHTML', '<br>');
    }

    // Emit keydown for other handlers
    this.emit('editor-keydown', { key: e.key, ctrlKey: mod, shiftKey: e.shiftKey, altKey: e.altKey });
  }

  handlePaste(e) {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');

    if (html) {
      const cleaned = this.cleanPastedHTML(html);
      this.execCommand('insertHTML', cleaned);
    } else if (text) {
      const paragraphs = text.split(/\n\n+/).map(p => {
        const lines = p.split(/\n/).map(l => this.escapeHTML(l)).join('<br>');
        return `<p>${lines}</p>`;
      }).join('');
      this.execCommand('insertHTML', paragraphs || this.escapeHTML(text));
    }
    this.onContentChange();
  }

  cleanPastedHTML(html) {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    temp.querySelectorAll('script, style, meta, link, title, head').forEach(el => el.remove());

    const allElements = temp.querySelectorAll('*');
    const allowedTags = new Set([
      'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'blockquote', 'pre', 'code',
      'a', 'img', 'hr',
      'table', 'thead', 'tbody', 'tr', 'td', 'th',
      'sup', 'sub', 'span', 'div'
    ]);
    const allowedAttrs = new Set(['href', 'src', 'alt', 'title', 'colspan', 'rowspan']);

    allElements.forEach(el => {
      if (!allowedTags.has(el.tagName.toLowerCase())) {
        el.replaceWith(...el.childNodes);
        return;
      }
      [...el.attributes].forEach(attr => {
        if (!allowedAttrs.has(attr.name.toLowerCase())) {
          el.removeAttribute(attr.name);
        }
      });
      if (el.hasAttribute('href')) {
        const href = el.getAttribute('href');
        if (href.startsWith('javascript:') || href.startsWith('data:')) {
          el.removeAttribute('href');
        }
      }
    });

    temp.querySelectorAll('div').forEach(div => {
      const p = document.createElement('p');
      p.innerHTML = div.innerHTML;
      div.replaceWith(p);
    });

    return temp.innerHTML;
  }

  handleDrop(e) {
    if (e.dataTransfer.files.length > 0) {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        this.handleImageDrop(file);
      } else if (file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
        this.handleTextFileDrop(file);
      }
    }
  }

  handleImageDrop(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = `<img src="${e.target.result}" alt="${this.escapeAttr(file.name)}" style="max-width:100%">`;
      this.execCommand('insertHTML', img);
    };
    reader.readAsDataURL(file);
  }

  handleTextFileDrop(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const paragraphs = text.split(/\n\n+/).map(p => {
        const lines = p.split(/\n/).map(l => this.escapeHTML(l)).join('<br>');
        return `<p>${lines}</p>`;
      }).join('');
      this.execCommand('insertHTML', paragraphs);
    };
    reader.readAsText(file);
  }

  escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  execCommand(command, value = null) {
    this.editorEl.focus();
    if (command === 'formatBlock') {
      document.execCommand('formatBlock', false, `<${value}>`);
    } else if (command === 'insertHTML') {
      document.execCommand('insertHTML', false, value);
    } else {
      document.execCommand(command, false, value);
    }
    this.onContentChange();
    this.onSelectionChange();
  }

  saveUndoState() {
    const content = this.editorEl.innerHTML;
    if (content === this.lastContent) return;
    const selection = this.saveSelection();
    this.undoStack.push({
      content: this.lastContent,
      selection: this.lastSelection
    });
    if (this.undoStack.length > 100) this.undoStack.shift();
    this.lastContent = content;
    this.lastSelection = selection;
    this.redoStack = [];
  }

  undo() {
    if (this.undoStack.length === 0) return;
    this.redoStack.push({
      content: this.editorEl.innerHTML,
      selection: this.saveSelection()
    });
    const state = this.undoStack.pop();
    this.editorEl.innerHTML = state.content;
    this.lastContent = state.content;
    if (state.selection) this.restoreSelection(state.selection);
    this.onContentChange();
  }

  redo() {
    if (this.redoStack.length === 0) return;
    this.undoStack.push({
      content: this.editorEl.innerHTML,
      selection: this.saveSelection()
    });
    const state = this.redoStack.pop();
    this.editorEl.innerHTML = state.content;
    this.lastContent = state.content;
    if (state.selection) this.restoreSelection(state.selection);
    this.onContentChange();
  }

  saveSelection() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return null;
    const range = sel.getRangeAt(0);
    if (!this.editorEl.contains(range.commonAncestorContainer)) return null;
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
      if (!startNode || !endNode) return;
      const range = document.createRange();
      range.setStart(startNode, Math.min(saved.startOffset, startNode.length || startNode.childNodes.length));
      range.setEnd(endNode, Math.min(saved.endOffset, endNode.length || endNode.childNodes.length));
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (e) {}
  }

  getNodePath(node) {
    const path = [];
    let current = node;
    while (current && current !== this.editorEl) {
      const parent = current.parentNode;
      if (!parent) break;
      const index = Array.from(parent.childNodes).indexOf(current);
      path.unshift(index);
      current = parent;
    }
    return path;
  }

  resolveNodePath(path) {
    let node = this.editorEl;
    for (const index of path) {
      if (!node || !node.childNodes[index]) return null;
      node = node.childNodes[index];
    }
    return node;
  }

  onSelectionChange() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (!this.editorEl.contains(range.commonAncestorContainer)) return;

    const formats = [];
    const commands = ['bold', 'italic', 'underline', 'strikethrough',
                      'insertUnorderedList', 'insertOrderedList',
                      'justifyLeft', 'justifyCenter', 'justifyRight'];
    commands.forEach(cmd => {
      try {
        if (document.queryCommandState(cmd)) formats.push(cmd);
      } catch (e) {}
    });

    const block = this.getCurrentBlock();
    let blockType = 'p';
    if (block) {
      const tag = block.tagName.toLowerCase();
      if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre'].includes(tag)) {
        blockType = tag;
      }
    }
    this.emit('selection-change', { formats, blockType });
    this.emit('cursor-position', this.getCursorPosition());
    if (this.state.paragraphFocus) this.updateParagraphFocus();
  }

  getCurrentBlock() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return null;
    let node = sel.getRangeAt(0).commonAncestorContainer;
    if (node.nodeType === 3) node = node.parentNode;
    while (node && node !== this.editorEl) {
      if (node.nodeType === 1) {
        const tag = node.tagName.toLowerCase();
        if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'li', 'div'].includes(tag)) return node;
      }
      node = node.parentNode;
    }
    return null;
  }

  getCursorPosition() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return { line: 0, col: 0 };
    const range = sel.getRangeAt(0);
    const preRange = document.createRange();
    preRange.selectNodeContents(this.editorEl);
    preRange.setEnd(range.startContainer, range.startOffset);
    const lines = preRange.toString().split('\n');
    return {
      line: lines.length,
      col: lines[lines.length - 1].length + 1
    };
  }

  updateParagraphFocus() {
    const block = this.getCurrentBlock();
    this.editorEl.querySelectorAll('.paragraph-focused').forEach(el => el.classList.remove('paragraph-focused'));
    this.editorEl.querySelectorAll('p, h1, h2, h3, h4, h5, h6, blockquote, li').forEach(el => {
      if (el !== block) {
        el.classList.add('paragraph-dimmed');
      } else {
        el.classList.remove('paragraph-dimmed');
        el.classList.add('paragraph-focused');
      }
    });
  }

  updateTypewriterScroll() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const scrollContainer = this.editorEl.parentElement;
    const containerRect = scrollContainer.getBoundingClientRect();
    const targetY = containerRect.top + containerRect.height / 3;
    if (Math.abs(rect.top - targetY) > 10) {
      scrollContainer.scrollBy({ top: rect.top - targetY, behavior: 'smooth' });
    }
  }

  updateWordCount() {
    const text = this.editorEl.innerText || '';
    const trimmed = text.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    const chars = text.length;
    const charsNoSpaces = text.replace(/\s/g, '').length;
    const paragraphs = this.editorEl.querySelectorAll('p, h1, h2, h3, h4, h5, h6, blockquote, li').length;
    const sentences = trimmed ? (trimmed.match(/[.!?]+\s/g) || []).length + 1 : 0;
    const readingTime = Math.max(1, Math.ceil(words / 250));
    this.emit('word-count', {
      wordCount: words,
      charCount: chars,
      charCountNoSpaces: charsNoSpaces,
      paragraphCount: paragraphs,
      sentenceCount: sentences,
      readingTime: readingTime + ' min'
    });
  }

  setContent(html) {
    if (!this.editorEl) return;
    this.editorEl.innerHTML = html;
    this.lastContent = html;
    this.undoStack = [];
    this.redoStack = [];
    this.saveUndoState();
    this.updateWordCount();
  }

  getContent() { return this.editorEl ? this.editorEl.innerHTML : ''; }
  getPlainText() { return this.editorEl ? this.editorEl.innerText : ''; }

  getHeadings() {
    if (!this.editorEl) return [];
    const headings = [];
    this.editorEl.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((el, i) => {
      if (!el.id) el.id = `heading-${i}-${Date.now()}`;
      headings.push({ id: el.id, level: parseInt(el.tagName[1]), text: el.textContent.trim() });
    });
    return headings;
  }

  scrollToHeading(headingId) {
    const el = this.editorEl.querySelector(`#${headingId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  findText(searchText, options = {}) {
    const { caseSensitive = false, wholeWord = false, regex = false } = options;
    this.clearHighlights();
    if (!searchText) return [];
    const matches = [];
    const walker = document.createTreeWalker(this.editorEl, NodeFilter.SHOW_TEXT, null, false);
    let flags = caseSensitive ? 'g' : 'gi';
    let pattern;
    if (regex) {
      try { pattern = new RegExp(searchText, flags); } catch (e) { return []; }
    } else {
      const escaped = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      pattern = new RegExp(wholeWord ? `\\b${escaped}\\b` : escaped, flags);
    }
    let node;
    while (node = walker.nextNode()) {
      const text = node.textContent;
      let match;
      while ((match = pattern.exec(text)) !== null) {
        matches.push({ node, index: match.index, length: match[0].length, text: match[0] });
      }
    }
    this.highlightMatches(matches);
    return matches;
  }

  highlightMatches(matches) {
    for (let i = matches.length - 1; i >= 0; i--) {
      const m = matches[i];
      const range = document.createRange();
      range.setStart(m.node, m.index);
      range.setEnd(m.node, m.index + m.length);
      const highlight = document.createElement('mark');
      highlight.className = 'search-highlight';
      highlight.dataset.matchIndex = i;
      try { range.surroundContents(highlight); } catch (e) {}
    }
  }

  clearHighlights() {
    this.editorEl.querySelectorAll('mark.search-highlight, mark.search-highlight-active').forEach(mark => {
      const parent = mark.parentNode;
      mark.replaceWith(...mark.childNodes);
      parent.normalize();
    });
  }

  replaceMatch(matchIndex, replacement) {
    const mark = this.editorEl.querySelector(`mark[data-match-index="${matchIndex}"]`);
    if (mark) {
      mark.replaceWith(document.createTextNode(replacement));
      this.editorEl.normalize();
      this.onContentChange();
    }
  }

  replaceAll(searchText, replacement, options = {}) {
    const matches = this.findText(searchText, options);
    for (let i = matches.length - 1; i >= 0; i--) this.replaceMatch(i, replacement);
    this.clearHighlights();
    return matches.length;
  }

  focus() { if (this.editorEl) this.editorEl.focus(); }
  blur() { if (this.editorEl) this.editorEl.blur(); }

  setFontSize(size) {
    this.state.fontSize = size;
    if (this.editorEl) this.editorEl.style.fontSize = size + 'px';
  }
  setFontFamily(family) {
    this.state.fontFamily = family;
    if (this.editorEl) this.editorEl.style.fontFamily = family;
  }
  setLineHeight(height) {
    this.state.lineHeight = height;
    if (this.editorEl) this.editorEl.style.lineHeight = height;
  }
  setMaxWidth(width) {
    this.state.maxWidth = width;
    if (this.editorEl) this.editorEl.style.maxWidth = width + 'px';
  }
  setFocusMode(enabled) {
    this.state.focusMode = enabled;
    this.el.querySelector('.editor-container')?.classList.toggle('focus-mode', enabled);
  }
  setTypewriterMode(enabled) {
    this.state.typewriterMode = enabled;
    this.el.querySelector('.editor-container')?.classList.toggle('typewriter-mode', enabled);
  }
  setParagraphFocus(enabled) {
    this.state.paragraphFocus = enabled;
    this.el.querySelector('.editor-container')?.classList.toggle('paragraph-focus', enabled);
    if (!enabled) {
      this.editorEl.querySelectorAll('.paragraph-dimmed').forEach(el => el.classList.remove('paragraph-dimmed'));
      this.editorEl.querySelectorAll('.paragraph-focused').forEach(el => el.classList.remove('paragraph-focused'));
    } else {
      this.updateParagraphFocus();
    }
  }

  escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
