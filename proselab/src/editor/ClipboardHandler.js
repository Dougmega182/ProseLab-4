export class ClipboardHandler {
  constructor(editor) {
    this.editor = editor;
    this.init();
  }

  init() {
    this.editor.el.addEventListener('paste', (e) => this.onPaste(e));
    this.editor.el.addEventListener('copy', (e) => this.onCopy(e));
    this.editor.el.addEventListener('cut', (e) => this.onCut(e));
  }

  onPaste(e) {
    e.preventDefault();

    const clipboardData = e.clipboardData || window.clipboardData;
    if (!clipboardData) return;

    // Check for files (images)
    if (clipboardData.files && clipboardData.files.length > 0) {
      Array.from(clipboardData.files).forEach(file => {
        if (file.type.startsWith('image/')) {
          this.editor.dragDrop.handleImageFile(file);
        }
      });
      return;
    }

    // Check for HTML content
    const html = clipboardData.getData('text/html');
    const text = clipboardData.getData('text/plain');

    if (html && this.editor.options.pasteAsRichText !== false) {
      const cleaned = this.cleanPastedHTML(html);
      this.insertHTML(cleaned);
    } else if (text) {
      this.insertPlainText(text);
    }

    this.editor.saveState();
  }

  onCopy(e) {

    // Default copy behavior is fine, but we can enhance it
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;

    // Let the browser handle the default copy
  }

  onCut(e) {
    // Let the browser handle the default cut, then save state
    setTimeout(() => {
      this.editor.saveState();
    }, 0);
  }

  cleanPastedHTML(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Remove script and style tags
    doc.querySelectorAll('script, style, meta, link, title, head').forEach(el => el.remove());

    // Remove dangerous attributes
    const dangerousAttrs = ['onclick', 'onload', 'onerror', 'onmouseover', 'onfocus', 'onblur', 'onsubmit', 'onreset', 'onchange', 'oninput'];
    doc.querySelectorAll('*').forEach(el => {
      dangerousAttrs.forEach(attr => el.removeAttribute(attr));

      // Remove inline styles except some safe ones
      if (el.style) {
        const safeStyles = {};
        const allowedStyles = ['font-weight', 'font-style', 'text-decoration', 'text-align', 'color', 'background-color'];
        allowedStyles.forEach(prop => {
          const val = el.style.getPropertyValue(prop);
          if (val) safeStyles[prop] = val;
        });
        el.removeAttribute('style');
        Object.entries(safeStyles).forEach(([prop, val]) => {
          el.style.setProperty(prop, val);
        });
      }

      // Remove class attributes (they won't match our styles)
      if (!el.className.startsWith || !el.className.startsWith('rte-')) {
        el.removeAttribute('class');
      }
    });

    // Convert common elements
    doc.querySelectorAll('b').forEach(el => {
      const strong = document.createElement('strong');
      strong.innerHTML = el.innerHTML;
      el.replaceWith(strong);
    });

    doc.querySelectorAll('i').forEach(el => {
      const em = document.createElement('em');
      em.innerHTML = el.innerHTML;
      el.replaceWith(em);
    });

    // Remove empty elements (except br)
    doc.querySelectorAll('*').forEach(el => {
      if (el.tagName !== 'BR' && el.tagName !== 'IMG' && el.tagName !== 'HR' &&
          !el.textContent.trim() && !el.querySelector('img, br, hr')) {
        el.remove();
      }
    });

    return doc.body.innerHTML;
  }

  insertHTML(html) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    range.deleteContents();

    const temp = document.createElement('div');
    temp.innerHTML = html;

    const frag = document.createDocumentFragment();
    let lastNode = null;
    while (temp.firstChild) {
      lastNode = frag.appendChild(temp.firstChild);
    }

    range.insertNode(frag);

    if (lastNode) {
      const newRange = document.createRange();
      newRange.setStartAfter(lastNode);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
    }
  }

  insertPlainText(text) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    range.deleteContents();

    // Split by newlines and create paragraphs
    const lines = text.split(/\r?\n/);
    if (lines.length === 1) {
      const textNode = document.createTextNode(lines[0]);
      range.insertNode(textNode);
      const newRange = document.createRange();
      newRange.setStartAfter(textNode);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
    } else {
      const frag = document.createDocumentFragment();
      let lastNode = null;
      lines.forEach((line, i) => {
        if (i > 0) {
          const br = document.createElement('br');
          frag.appendChild(br);
        }
        if (line) {
          lastNode = document.createTextNode(line);
          frag.appendChild(lastNode);
        }
      });

      range.insertNode(frag);

      if (lastNode) {
        const newRange = document.createRange();
        newRange.setStartAfter(lastNode);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
      }
    }
  }
}


// ============================================================
// Floating Toolbar (appears on text selection)
// ============================================================

