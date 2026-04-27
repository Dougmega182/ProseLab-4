# ProseLab 4 — Roadmap

## Current State (Reality Check)

You have:

✅ Strong analysis engine  
✅ Functional rewrite pipeline  
✅ Multi-model orchestration  
❌ No rejection system  
❌ No structured writing workflow  
❌ No persistence beyond browser  

This is a **prototype engine**, not a product.

---

## Phase 1 — Core Engine Completion (NOW)

### Goal:
Make the system capable of **saying “this is not good enough.”**

### Tasks:

1. Build Critic Agent
   - Score output
   - Detect failure modes
   - Return APPROVE / REWRITE

2. Add Loop Control
   - Max 2–3 retries
   - Prevent infinite loops

3. Surface Feedback in UI
   - Show why text was rejected
   - Show what changed

### Outcome:
System becomes **quality-enforcing**, not just generative.

---

## Phase 2 — Writing Workflow (Next)

### Goal:
Turn engine into usable writing tool.

### Tasks:

1. Add Document Tree
   - Project → Chapter → Scene

2. Markdown Editor
   - Replace single textarea
   - Persist per document

3. File Storage (Local-first)
   - Move beyond localStorage
   - Use file structure or IndexedDB

### Outcome:
You can actually write a book inside it.

---

## Phase 3 — Entity System (Lightweight)

### Goal:
Enable contextual writing.

### Tasks:

1. Wikilinks
   - [[Character Name]]

2. Auto-create Entities
   - Simple markdown pages

3. Backlinks
   - Where entity is referenced

### DO NOT BUILD:
- Graph visualisation
- Complex schemas

### Outcome:
Connected writing without complexity.

---

## Phase 4 — True Differentiator

### Goal:
Become a **writing intelligence system**

### Tasks:

1. Generator + Critic dual-model setup
2. RAG over user's own writing
3. Style enforcement (optional)

### Outcome:
System improves with usage.

---

## Phase 5 — Export + Polish

### Goal:
Make output usable professionally

### Tasks:
- Export to DOCX / PDF
- Clean formatting pipeline
- Basic compile options

---

## What NOT To Build (Yet)

- Graph visualisations
- Timeline systems
- Maps
- Complex dashboards
- Multi-user sync
- Full Scrivener clone features

These will kill momentum.

---

## Strategic Positioning

You are NOT building:

❌ Writing software  
❌ Worldbuilding tool  

You ARE building:

✅ AI writing engine with enforced quality control  

---

## Success Criteria

You win if:

- Output is consistently better than input
- System rejects weak writing
- Users trust the suggestions

You fail if:

- It becomes another text editor
- AI output feels generic
- You build features instead of improving quality

---

## Immediate Next Step

Implement:

→ Critic Agent + rejection loop

Nothing else matters until this exists.
