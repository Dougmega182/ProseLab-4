# ProseLab V4 — User Guide & Walkthrough

Welcome to **ProseLab V4**, a high-fidelity editorial workstation designed to force quality through adversarial critique and structured orchestration.

---

## 🚀 The "Zero-to-Scene" Walkthrough

Follow this workflow to move from an idea to a polished, verified manuscript.

### 1. Project Initialization & Import
ProseLab V4 uses a hierarchical IndexedDB storage system. To bring existing work in:
- **The Import Wizard**: Click the **[Import]** button in the Document Sidebar.
- **Format Support**: Upload `.md` or `.txt` files. 
- **Structure Parsing**: 
  - Use `#` for Chapters.
  - Use `---` or `***` for Scene breaks.
  - The Wizard will automatically chunk your text into the Project/Chapter/Scene tree.
- **Manual Setup**: Create a Project/Chapter manually and paste text directly into the **ProseEditor**.

### 2. Define Narrative Intent (The Metadata Panel)
ProseLab requires **Intent** before it allows **Execution**.
- Select your scene in the **Document Sidebar**.
- Open the **Metadata** panel in the Write tab.
- Define the **Causality**, **Stakes**, and **Required Output**.
- *Tip: The Critic Agent will reject prose that fails to physically manifest the "Required Output" defined here.*

### 3. Drafting (The High-Performance Editor)
Switch to the **Write** workspace mode in the top toolbar.
- Use **Focus Mode** (in the top status bar) to dim non-active UI and maintain concentration.
- Every character you type is automatically tracked, and word counts are aggregated in the Dashboard Stats.
- *Note: Auto-save is active and persists directly to your browser's IndexedDB.*

### 4. The Editorial Engine (Modes)
ProseLab forces a progression to ensure quality:
- **CREATE**: The primary generation/refinement loop. Uses **Ollama -> OpenAI -> Critic**.
- **ANALYSE**: Run this first for diagnostics. Margaret (Voice) and Rafael (Rhythm) will diagnose your prose.
- **ENGINEER**: Becomes available after editing post-analysis. It performs a structural "Surgical Rewrite."
- **MARKET & VERDICT**: The final gates. The Critic Agent and the Gemini Challenger evaluate the scene for publication readiness.

### 5. Running the Orchestration Loop
The full power of ProseLab is in the automated loop:
- Click the **[RUN] RUN ORCHESTRATION LOOP** button in the header.
- This triggers the full pipeline: **Drafting -> Refinement -> Critique**.
- If the Critic gives a `REWRITE` verdict, the system will automatically retry (up to 3 times) with specific instructions injected into the next generation.
- Rejection traces are kept in the **Logs** tab for inspection.

---

## 📂 Importing Your Manuscript
(Detailed Workflow)
1. Prepare your markdown file with standard headers.
2. Launch the **Import Wizard** from the sidebar.
3. Review the parsed tree in the preview.
4. Click **Apply Import** to commit to the local database.

---

## ⚖️ How to Get Your Manuscript Critiqued
1. Ensure your **API Keys** are valid in `proselab/.env`.
2. Select a scene and ensure its **Required Output** metadata is set.
3. Click the **VERDICT** tab.
4. Click **Start VERDICT Mode**.
5. Inspect the **Pipeline Trace** in the Logs tab to see the Critic's specific reasoning for Approval or Rejection.

---

## 🛠 Component Reference

### The Toolbar
- **Format Select**: Manage H1-H6, Blockquotes, and Paragraphs.
- **Style Controls**: Bold, Italic, Lists, and Indentation.
- **Mode Toggle**: Switch between **CREATE**, **ANALYSE**, **ENGINEER**, etc.

### The Document Sidebar
- **Hierarchy**: Manage Projects > Chapters > Scenes.
- **Organization**: Drag-and-drop reordering of scenes within or between chapters.
- **Import/Export**: Central hub for manuscript movement.

### The Status Bar (Env Status)
- **API Status**: Real-time checks for OpenAI and Ollama connectivity.
- **Cache Control**: Toggle and clear inference caching to reset AI memory.
- **Costs**: Live tracking of token usage and estimated USD costs.

---

## 🛡 Principles of ProseLab

1.  **Defaults to Rejection**: The engine is designed to find flaws, not to validate your ego.
2.  **Show, Don't Tell**: Abstract emotional labels are banned. The engine will flag words like "felt," "anxious," or "happy."
3.  **Adversarial Truth**: We use multiple AI architectures (OpenAI, Gemini, Ollama) to ensure that if one model misses a flaw, the other catches it.

> "If the system cannot reject bad output, it will produce average output."
