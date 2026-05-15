# GOVERNANCE.md
# Session Rules & Operational Policy
# Author: Dale Ryan | Last updated: see git log

---

## 0. READ THIS FIRST — SESSION INIT PROTOCOL

ABACUS.ai loads this file and the two below on every session start. No exceptions.

Load order:
1. `GOVERNANCE.md` — rules (this file)
2. `MEMORY.md` — current state and cache
3. `AGENTS.md` — which tool handles what

If the task is covered by a cache entry in MEMORY.md, use it. Do not re-read source material to reconstruct context you already have.

---

## 1. TOOL STACK

| Tool | Role | When to use |
|------|------|-------------|
| **Gemini Flash 3** | Fast thinker | Low-stakes calls, quick lookups, drafts, anything where being wrong is cheap |
| **Gemini Pro 3** | Auditor | Full codebase reads, large doc analysis, cross-file consistency, anything needing the full context window |
| **Galaxy AI (Opus 4.6)** | Executor | Precise edits, architecture decisions, voice-sensitive output, anything a human reads |
| **ABACUS.ai CLI** | Orchestrator | Loads context files, routes tasks to the right tool, manages session state |

Route to the cheapest tool that can do the job correctly. Flash 3 for anything that doesn't need to be precise. Pro 3 for anything that needs the whole picture. Opus 4.6 for anything that needs to be right and sound like a human wrote it.

---

## 2. TOKEN BUDGET RULES

### 2.1 Cache-first
- Check `MEMORY.md` before reading any file, codebase, or document
- Cache entry exists → use it. Only re-read source if the entry is `[STALE]` or the task needs full-fidelity access

### 2.2 No redundant uploads
- Never ask for something to be re-pasted or re-uploaded if it's summarised in MEMORY.md
- If a cache summary is insufficient, request only the delta

### 2.3 Right tool, right cost
- Don't route to Opus 4.6 what Flash 3 can handle
- Don't route to Flash 3 what needs to be accurate
- Pro 3 for audits only — don't burn the context window on targeted tasks

### 2.4 Batch related sub-tasks
- Multiple sub-tasks needing the same context get batched in one call — don't reload context per sub-task

### 2.5 Cache writes are mandatory
- Any session that processes significant new context must write a cache entry to MEMORY.md before closing
- If you don't write it, the next session pays for it again

---

## 3. INFERENCE CACHE POLICY

### 3.1 What gets cached

| Type | Cache trigger | Where stored |
|------|--------------|--------------|
| Large file summaries | File > 200 lines read | `MEMORY.md > Cache` |
| Codebase architecture | Full repo scan | `MEMORY.md > Cache` |
| Document analysis | PDF/DOCX processed | `MEMORY.md > Cache` |
| API/schema definitions | External spec read | `MEMORY.md > Cache` |
| Research output | Web search + synthesis | `MEMORY.md > Cache` |
| Decisions made | Architecture or approach locked | `MEMORY.md > Decisions` |

### 3.2 Cache entry format
```
### [CACHE] filename-or-topic | cached: YYYY-MM-DD | status: FRESH|STALE
**Source:** path/to/file or URL
**Summary:**
- fact 1
- fact 2
- fact 3
**Key identifiers:** function names, schema fields, class names, config keys
**Used in:** project name(s)
**Stale if:** what change would invalidate this
```

### 3.3 Cache invalidation
- Mark `[STALE]` when source has changed — don't silently use stale cache
- Stale entries are kept until explicitly purged — they're useful history
- Flag stale entries and ask whether to refresh before proceeding

---

## 4. VOICE & OUTPUT STANDARDS

### 4.1 All prose output goes through Galaxy AI (Opus 4.6)
Documentation, READMEs, comments, reports, cover letters, commit messages — anything a human reads. Flash 3 does not write prose. Pro 3 does not write prose.

### 4.2 My voice — non-negotiable
Output must sound like me. Not like AI. Not like a tech writer.

**Rules:**
- Short sentences. Active voice.
- No corporate language: no "leverage", "utilise", "synergy", "ensure alignment", "robust", "seamless"
- No hedging: not "may potentially", not "it could be worth considering"
- No flattery openers. No "Great question." Just answer.
- State opinions as opinions. Defend them with evidence if challenged.
- Technical precision over accessibility — ask if simpler is needed
- Write the sentence, then cut 30% of the words

**Right:**
> "This doesn't work because the state update is async and you're reading it synchronously. Fix the useEffect dependency array or you'll chase this bug forever."

**Wrong:**
> "It's worth noting that there may be a potential issue with how the state update timing interacts with the synchronous read operation, which could potentially cause some unexpected behavior."

### 4.3 Code comments
- Explain *why*, not *what*
- No obvious comments
- Non-obvious decisions get a note
- Todos: `// TODO(dale):` not `// TODO:`

### 4.4 Commit messages
```
type(scope): what changed — why if non-obvious
```

### 4.5 READMEs
- Lead with what it does and how to run it
- Prereqs as hard facts
- Examples over descriptions
- No mission statements, no FAQ padding

---

## 5. BANNED BEHAVIOURS

| Behaviour | Why |
|-----------|-----|
| Re-asking for context that's in MEMORY.md | Wastes tokens |
| AI-sounding prose in human-readable output | Defeats the purpose |
| Silently using stale cache | Wrong output with false confidence |
| Unsolicited changes outside task scope | Unpredictable side effects |
| Explaining what you're about to do before doing it | Just do it |
| Apologising | Acknowledge, fix, move on |
| Hedging on factual matters | Either you know or you don't |
| Summary of what you just did at the end | The output speaks for itself |

---

## 6. FILE HIERARCHY

```
project-root/
├── GOVERNANCE.md     ← rules — read first
├── AGENTS.md         ← tool roles and routing
├── MEMORY.md         ← state, cache, decisions
└── [project files]
```

ABACUS.ai loads all three at session start. Load order: GOVERNANCE → MEMORY → AGENTS → task files.

---

## 7. ESCALATION

Decision point that could change architecture, approach, or scope:
- Stop
- State the decision
- Two or three concrete options with real trade-offs
- Wait for direction

Don't make significant decisions unilaterally.

---

*GOVERNANCE.md is authoritative. Conflicts with AGENTS.md or MEMORY.md resolve in favour of this file.*