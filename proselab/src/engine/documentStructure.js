/**
 * DOCUMENT STRUCTURE
 * Utilities for stable character indexing across paragraphs and sentences.
 */

export function buildDocumentStructure(text) {
  const paragraphs = text.split(/\n\s*\n/).map((pText, pIdx) => {
    const pStart = text.indexOf(pText);
    const sentences = pText.split(/(?<=[.!?])\s+/).map((sText, sIdx) => {
      const sStart = pText.indexOf(sText);
      return {
        id: `P${pIdx}S${sIdx}`,
        text: sText,
        start: pStart + sStart,
        end: pStart + sStart + sText.length
      };
    });

    return {
      id: `P${pIdx}`,
      text: pText,
      start: pStart,
      end: pStart + pText.length,
      sentences
    };
  });

  return {
    raw: text,
    paragraphs
  };
}

/**
 * Deterministically resolves a span within a document structure.
 * Uses permissive fuzzy matching to prevent event loss.
 */
export function resolveAnchor(doc, hint, trigger, args = {}) {
  if (!hint) return null;

  const lowHint = hint.toLowerCase().trim();
  let bestSentence = null;

  // 1. Find the best sentence candidate
  for (const p of doc.paragraphs) {
    for (const s of p.sentences) {
      const lowSText = s.text.toLowerCase();
      if (lowSText.includes(lowHint) || lowHint.includes(lowSText)) {
        bestSentence = s;
        break;
      }
    }
    if (bestSentence) break;
  }

  // Fallback: If hint is too messy, try keyword overlap
  if (!bestSentence) {
    const hintWords = lowHint.split(/\s+/).filter(w => w.length > 3);
    let bestOverlap = 0;
    for (const p of doc.paragraphs) {
      for (const s of p.sentences) {
        const lowSText = s.text.toLowerCase();
        const overlap = hintWords.filter(w => lowSText.includes(w)).length;
        if (overlap > bestOverlap) {
          bestOverlap = overlap;
          bestSentence = s;
        }
      }
    }
  }

  if (!bestSentence) return null;

  // 2. Resolve components within the sentence (Permissive)
  const resolveLocalPermissive = (fragment, fallbackSpan) => {
    if (!fragment || fragment === "N/A" || fragment === "unknown") return fallbackSpan;
    const lowFrag = fragment.toLowerCase();
    const lowSText = bestSentence.text.toLowerCase();
    const idx = lowSText.indexOf(lowFrag);
    
    if (idx !== -1) {
      return {
        start: bestSentence.start + idx,
        end: bestSentence.start + idx + fragment.length,
        text: bestSentence.text.substring(idx, idx + fragment.length)
      };
    }
    // Fallback to the whole sentence if fragment not found
    return fallbackSpan;
  };

  const sentenceSpan = { start: bestSentence.start, end: bestSentence.end, text: bestSentence.text };
  const triggerSpan = resolveLocalPermissive(trigger, sentenceSpan);

  const resolvedArgs = {};
  for (const [key, val] of Object.entries(args)) {
    if (val) {
      const span = resolveLocalPermissive(val, null);
      if (span) resolvedArgs[key] = { head: val, span };
    }
  }

  return { trigger: triggerSpan, arguments: resolvedArgs };
}
