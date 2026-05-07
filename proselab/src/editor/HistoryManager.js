export class HistoryManager {
  constructor(editor, options = {}) {
    this.editor = editor;
    this.maxStates = options.maxStates || 100;
    this.undoStack = [];
    this.redoStack = [];
    this.debounceTimer = null;
    this.debounceDelay = options.debounceDelay || 300;
    this.lastSavedContent = '';

  }

  saveState() {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this._pushState();
    }, this.debounceDelay);
  }

  saveStateImmediate() {
    clearTimeout(this.debounceTimer);
    this._pushState();
  }

  _pushState() {
    const content = this.editor.el.innerHTML;
    if (content === this.lastSavedContent) return;

    this.undoStack.push({
      content: content,
      cursor: this.saveCursorPosition()
    });

    if (this.undoStack.length > this.maxStates) {
      this.undoStack.shift();
    }

    this.redoStack = [];
    this.lastSavedContent = content;
  }

  undo() {
    if (this.undoStack.length === 0) return;

    const currentState = {
      content: this.editor.el.innerHTML,
      cursor: this.saveCursorPosition()
    };
    this.redoStack.push(currentState);

    const prevState = this.undoStack.pop();
    this.editor.el.innerHTML = prevState.content;
    this.lastSavedContent = prevState.content;

    if (prevState.cursor) {
      this.restoreCursorPosition(prevState.cursor);
    }

    this.editor.emit('change');
  }

  redo() {
    if (this.redoStack.length === 0) return;

    const currentState = {
      content: this.editor.el.innerHTML,
      cursor: this.saveCursorPosition()
    };
    this.undoStack.push(currentState);

    const nextState = this.redoStack.pop();
    this.editor.el.innerHTML = nextState.content;
    this.lastSavedContent = nextState.content;

    if (nextState.cursor) {
      this.restoreCursorPosition(nextState.cursor);
    }

    this.editor.emit('change');
  }

  saveCursorPosition() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;

    const range = sel.getRangeAt(0);
    const preRange = document.createRange();
    preRange.selectNodeContents(this.editor.el);
    preRange.setEnd(range.startContainer, range.startOffset);
    const start = preRange.toString().length;

    preRange.setEnd(range.endContainer, range.endOffset);
    const end = preRange.toString().length;

    return { start, end };
  }

  restoreCursorPosition(pos) {
    if (!pos) return;

    const sel = window.getSelection();
    const range = document.createRange();

    let charIndex = 0;
    const walker = document.createTreeWalker(
      this.editor.el,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    let startNode = null, startOffset = 0;
    let endNode = null, endOffset = 0;

    while (walker.nextNode()) {
      const node = walker.currentNode;
      const nodeLen = node.textContent.length;

      if (!startNode && charIndex + nodeLen >= pos.start) {
        startNode = node;
        startOffset = pos.start - charIndex;
      }
      if (!endNode && charIndex + nodeLen >= pos.end) {
        endNode = node;
        endOffset = pos.end - charIndex;
        break;
      }
      charIndex += nodeLen;
    }

    if (startNode && endNode) {
      try {
        range.setStart(startNode, startOffset);
        range.setEnd(endNode, endOffset);
        sel.removeAllRanges();
        sel.addRange(range);
      } catch (e) {
        // Cursor restoration failed silently
      }
    }
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.lastSavedContent = '';
  }
}