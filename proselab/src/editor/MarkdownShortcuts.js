export class MarkdownShortcuts {
  constructor(editor) {
    this.editor = editor;
    this.patterns = [
      { regex: /^#{1}\s$/, action: () => this.editor.setBlockType('h1') },
      { regex: /^#{2}\s$/, action: () => this.editor.setBlockType('h2') },
      { regex: /^#{3}\s$/, action: () => this.editor.setBlockType('h3') },
      { regex: /^#{4}\s$/, action: () => this.editor.setBlockType('h4') },
      { regex: /^#{5}\s$/, action: () => this.editor.setBlockType('h5') },
      { regex: /^#{6}\s$/, action: () => this.editor.setBlockType('h6') },
      { regex: /^>\s$/, action: () => this.editor.setBlockType('blockquote') },
      { regex: /^[-*]\s$/, action: () => this.editor.toggleList('ul') },
      { regex: /^1[.)]\s$/, action: () => this.editor.toggleList('ol') },
      { regex: /^```$/, action: () => this.editor.setBlockType('pre') },
      { regex: /^---$/, action: () => this.editor.insertHorizontalRule() },

      { regex: /^\[\]\s$/, action: () => this.editor.insertCheckbox() },
    ];

    this.inlinePatterns = [
      { regex: /\*\*(.+?)\*\*$/, tag: 'bold' },
      { regex: /\*(.+?)\*$/, tag: 'italic' },
      { regex: /__(.+?)__$/, tag: 'bold' },
      { regex: /_(.+?)_$/, tag: 'italic' },
      { regex: /~~(.+?)~~$/, tag: 'strikethrough' },
      { regex: /`(.+?)`$/, tag: 'code' },
    ];

    this.init();
  }

  init() {
    this.editor.on('input', (e) => this.handleInput(e));
  }

  handleInput(e) {
    if (e && e.inputType === 'insertText' && e.data === ' ') {
      this.checkBlockShortcuts();
    }
    if (e && e.inputType === 'insertText') {
      this.checkInlineShortcuts();
    }
  }

  checkBlockShortcuts() {
    const block = this.editor.getCurrentBlock();
    if (!block) return;
    if (block.tagName !== 'P' && block.tagName !== 'DIV') return;

    const text = block.textContent;

    for (const pattern of this.patterns) {
      if (pattern.regex.test(text)) {
        // Clear the block text first
        block.textContent = '';
        block.innerHTML = '<br>';

        // Place cursor
        const sel = window.getSelection();
        const range = document.createRange();
        range.setStart(block, 0);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);

        pattern.action();
        this.editor.saveState();
        return;
      }
    }
  }

  checkInlineShortcuts() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return;

    const block = this.editor.getCurrentBlock();
    if (!block) return;

    const text = block.textContent;
    const cursorOffset = this.getCursorOffset(block);
    const beforeCursor = text.substring(0, cursorOffset);

    for (const pattern of this.inlinePatterns) {
      const match = beforeCursor.match(pattern.regex);
      if (match) {
        const fullMatch = match[0];
        const content = match[1];
        const startIndex = beforeCursor.length - fullMatch.length;

        // Remove the markdown syntax and wrap content
        this.applyInlineFormat(block, startIndex, cursorOffset, content, pattern.tag);
        this.editor.saveState();
        return;
      }
    }
  }

  getCursorOffset(block) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return 0;
    const range = sel.getRangeAt(0);
    const preRange = document.createRange();
    preRange.selectNodeContents(block);
    preRange.setEnd(range.startContainer, range.startOffset);
    return preRange.toString().length;
  }

  applyInlineFormat(block, start, end, content, format) {
    // Use a TreeWalker to find the text nodes
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    let currentOffset = 0;
    let startNode = null, startOff = 0;
    let endNode = null, endOff = 0;

    while (walker.nextNode()) {
      const node = walker.currentNode;
      const nodeLen = node.textContent.length;

      if (!startNode && currentOffset + nodeLen > start) {
        startNode = node;
        startOff = start - currentOffset;
      }
      if (currentOffset + nodeLen >= end) {
        endNode = node;
        endOff = end - currentOffset;
        break;
      }
      currentOffset += nodeLen;
    }

    if (!startNode || !endNode) return;

    const range = document.createRange();
    range.setStart(startNode, startOff);
    range.setEnd(endNode, endOff);
    range.deleteContents();

    let wrapper;
    switch (format) {
      case 'bold':
        wrapper = document.createElement('strong');
        break;
      case 'italic':
        wrapper = document.createElement('em');
        break;
      case 'strikethrough':
        wrapper = document.createElement('s');
        break;
      case 'code':
        wrapper = document.createElement('code');
        break;
      default:
        wrapper = document.createElement('span');
    }

    wrapper.textContent = content;
    range.insertNode(wrapper);

    // Place cursor after the wrapper
    const sel = window.getSelection();
    const newRange = document.createRange();
    newRange.setStartAfter(wrapper);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);
  }
}


// ============================================================
// Drag & Drop Handler
// ============================================================

