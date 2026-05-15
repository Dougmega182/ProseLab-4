const END_MARKER = "[[END_OF_EXPANSION]]";

function splitParagraphsWithLines(text) {
  const lines = String(text || "").split(/\r?\n/);
  const paragraphs = [];
  let buffer = [];
  let startLine = 1;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const isBlank = line.trim().length === 0;
    if (isBlank) {
      if (buffer.length > 0) {
        paragraphs.push({
          index: paragraphs.length + 1,
          startLine,
          endLine: i,
          text: buffer.join("\n").trim()
        });
        buffer = [];
      }
      startLine = i + 2;
      continue;
    }
    if (buffer.length === 0) startLine = i + 1;
    buffer.push(line);
  }

  if (buffer.length > 0) {
    paragraphs.push({
      index: paragraphs.length + 1,
      startLine,
      endLine: lines.length,
      text: buffer.join("\n").trim()
    });
  }

  return paragraphs;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function countWords(text) {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length;
}

function mergeWithoutOverlap(previous, continuation, maxWindow = 140) {
  const prevTokens = String(previous || "").trim().split(/\s+/).filter(Boolean);
  const nextTokens = String(continuation || "").trim().split(/\s+/).filter(Boolean);
  const maxOverlap = Math.min(maxWindow, prevTokens.length, nextTokens.length);
  let overlap = 0;

  for (let n = maxOverlap; n >= 8; n -= 1) {
    const left = prevTokens.slice(prevTokens.length - n).join(" ").toLowerCase();
    const right = nextTokens.slice(0, n).join(" ").toLowerCase();
    if (left === right) {
      overlap = n;
      break;
    }
  }

  return nextTokens.slice(overlap).join(" ").trim();
}

function buildInitialPrompt({ chapterTitle, expansionBrief, styleAnchorBefore, styleAnchorAfter, insertionLabel }) {
  return `You are writing a manuscript insertion for a live draft.\n\nChapter: ${chapterTitle}\nInsertion target: ${insertionLabel}\n\nExpansion brief:\n${expansionBrief}\n\nStyle anchor before insertion:\n${styleAnchorBefore || "(none)"}\n\nStyle anchor after insertion:\n${styleAnchorAfter || "(none)"}\n\nRules:\n1. Match diction, rhythm, voice, and tense of the anchors.\n2. Keep continuity and causal logic consistent with the chapter context.\n3. Do not repeat or restate anchor paragraphs.\n4. Output prose only. No headings, notes, or analysis.\n5. End output with ${END_MARKER} only when complete.\n`;
}

function buildContinuationPrompt({ chapterTitle, expansionBrief, alreadyWritten, tailExcerpt, insertionLabel }) {
  return `Continue the same insertion in the same voice.\n\nChapter: ${chapterTitle}\nInsertion target: ${insertionLabel}\nExpansion brief:\n${expansionBrief}\n\nAlready written insertion (do not repeat):\n${alreadyWritten}\n\nLast excerpt to continue from exactly:\n${tailExcerpt}\n\nRules:\n1. Continue from the exact last sentence boundary.\n2. Do not repeat any previously written text.\n3. Output only new prose continuation.\n4. End output with ${END_MARKER} only when complete.\n`;
}

export function describeInsertionAnchors(sourceText, startParagraph, endParagraph) {
  const paragraphs = splitParagraphsWithLines(sourceText);
  if (!paragraphs.length) {
    return {
      start: { paragraph: 1, line: 1, text: "" },
      end: { paragraph: 1, line: 1, text: "" },
      styleAnchorBefore: "",
      styleAnchorAfter: "",
      insertionLabel: "before paragraph 1 (line 1) and before paragraph 1 (line 1)",
      paragraphCount: 0
    };
  }

  const startIdx = clamp(Number(startParagraph) || 1, 1, paragraphs.length);
  const endIdx = clamp(Number(endParagraph) || startIdx, startIdx, paragraphs.length);
  const startRef = paragraphs[startIdx - 1];
  const endRef = paragraphs[endIdx - 1];
  const beforeRef = paragraphs[Math.max(0, startIdx - 2)] || startRef;
  const afterRef = paragraphs[Math.min(paragraphs.length - 1, endIdx)] || endRef;

  return {
    start: { paragraph: startRef.index, line: startRef.startLine, text: startRef.text },
    end: { paragraph: endRef.index, line: endRef.startLine, text: endRef.text },
    styleAnchorBefore: beforeRef.text,
    styleAnchorAfter: afterRef.text,
    insertionLabel: `before paragraph ${startRef.index} (line ${startRef.startLine}) and before paragraph ${endRef.index} (line ${endRef.startLine})`,
    paragraphCount: paragraphs.length
  };
}

export async function generateExpansionInsertionDraft({
  key,
  llmCaller,
  chapterTitle,
  sourceText,
  expansionBrief,
  startParagraph,
  endParagraph,
  maxPasses = 8,
  onStage = () => {},
  onChunk = async () => {}
}) {
  const anchor = describeInsertionAnchors(sourceText, startParagraph, endParagraph);
  let pass = 1;
  let combined = "";
  let completed = false;

  while (pass <= maxPasses) {
    onStage(`expansion-pass-${pass}`);

    const prompt = pass === 1
      ? buildInitialPrompt({
          chapterTitle,
          expansionBrief,
          styleAnchorBefore: anchor.styleAnchorBefore,
          styleAnchorAfter: anchor.styleAnchorAfter,
          insertionLabel: anchor.insertionLabel
        })
      : buildContinuationPrompt({
          chapterTitle,
          expansionBrief,
          alreadyWritten: combined,
          tailExcerpt: combined.split(/\s+/).slice(-120).join(" "),
          insertionLabel: anchor.insertionLabel
        });

    const res = await llmCaller(key, prompt, { temperature: 0.35, timeout: 180000, pollInterval: 1200 });
    if (!res?.ok) {
      return { ok: false, error: res?.error || "Expansion call failed", anchor, combined, pass };
    }

    const raw = String(res.content || "").trim();
    const hasEndMarker = raw.includes(END_MARKER);
    const cleaned = raw.replaceAll(END_MARKER, "").trim();
    const addition = pass === 1 ? cleaned : mergeWithoutOverlap(combined, cleaned);
    combined = [combined, addition].filter(Boolean).join(combined && addition ? "\n\n" : "").trim();

    await onChunk({ pass, chunk: addition, combined, hasEndMarker, wordCount: countWords(combined) });

    if (hasEndMarker) {
      completed = true;
      break;
    }

    pass += 1;
  }

  if (!completed) {
    return { ok: false, error: "Expansion did not complete before pass limit", anchor, combined, pass: maxPasses };
  }

  return {
    ok: true,
    text: combined,
    anchor,
    passes: pass,
    wordCount: countWords(combined)
  };
}
