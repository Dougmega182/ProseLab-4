export class InlineMarkdown {
  constructor(editor) {
    this.editor = editor;
    this.patterns = [
      { trigger: '**', tag: 'strong' },
      { trigger: '__', tag: 'strong' },
      { trigger: '*', tag: 'em' },
      { trigger: '_', tag: 'em' },
      { trigger: '~~', tag: 's' },
      { trigger: '`', tag: 'code' },
      { trigger: '==', tag: 'mark' },
    ];
  }

  check(inputChar) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return false;

    const range = sel.getRangeAt(0);
    if (!range.collapsed) return false;

    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return false;

    const text = node.textContent;
    const offset = range.startOffset;

    for (const pattern of this.patterns) {
      const trigger = pattern.trigger;
      const triggerLen = trigger.length;

      // Check if the character just typed completes a closing trigger
      const textBefore = text.substring(0, offset);

      // Look for opening trigger
      // The text should be: trigger + content + trigger (just completed)
      if (textBefore.endsWith(trigger.substring(0, triggerLen - 1)) && inputChar === trigger[triggerLen - 1]) {
        // Find the opening trigger
        const searchText = textBefore.substring(0, textBefore.length - (triggerLen - 1));
        const openIndex = searchText.lastIndexOf(trigger);

        if (openIndex !== -1) {
          const content = searchText.substring(openIndex + triggerLen);

          // Must have some content
          if (content.length > 0 && content.trim().length > 0) {
            // Prevent matching if it's a longer trigger (e.g., ** vs *)
            if (trigger === '*' || trigger === '_') {
              // Check it's not actually ** or __
              if (openIndex > 0 && text[openIndex - 1] === trigger[0]) continue;
              if (text[offset] === trigger[0]) continue;
            }

            // Apply the formatting
            this.applyInlineFormat(node, openIndex, offset, triggerLen, content, pattern.tag);
            return true;
          }
        }
      }
    }

    return false;
  }

  applyInlineFormat(textNode, openIndex, closeEnd, triggerLen, content, tag) {
    const parent = textNode.parentNode;
    const text = textNode.textContent;

    const before = text.substring(0, openIndex);
    const after = text.substring(closeEnd + 1); // +1 for the character being typed

    const formatted = document.createElement(tag);
    formatted.textContent = content;

    const fragment = document.createDocumentFragment();
    if (before) fragment.appendChild(document.createTextNode(before));
    fragment.appendChild(formatted);

    // Add a zero-width space after to allow cursor placement
    const afterText = document.createTextNode(after || '\u200B');
    fragment.appendChild(afterText);

    parent.replaceChild(fragment, textNode);

    // Place cursor after the formatted element
    const sel = window.getSelection();
    const range = document.createRange();
    range.setStart(afterText, after ? 0 : 1);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);

    this.editor.saveState();
  }
}


// ============================================================
// Main Editor Class
// ============================================================

