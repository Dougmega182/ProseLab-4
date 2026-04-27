# ProseLab Backlog

## Now
- Fix remaining misleading `CREATE` mode copy that still implies a live Gemini stage even though the current pipeline ends after OpenAI refinement.
- Add an actual Ollama reachability check instead of treating a non-empty model name as sufficient.
- Replace mojibake text in `proselab/src/App.jsx` and `proselab/src/index.css` labels.
- Update `proselab/README.md` from the default Vite template to project-specific setup and usage documentation.

## Next
- Decide whether Gemini is a real stage or a retired concept.
- If Gemini stays:
  - Re-enable it in `runPipeline`.
  - Respect `preproduction.settings.useGemini`.
  - Show stage-level failures cleanly without breaking the rest of the pipeline.
- If Gemini is removed:
  - Delete dead config and UI affordances.
  - Simplify the settings and status bar.

## Editorial UX
- Show lock reasons inline on the locked mode buttons, not only in the active panel.
- Consider allowing click-through on locked modes with read-only previews of requirements.
- Surface the exact prerequisite chain:
  - `ANALYSE`
  - user edit
  - `ENGINEER`
  - `VERDICT`

## Reliability
- Add explicit handling for failed OpenAI/Ollama responses in editorial modes.
- Prevent empty or malformed model responses from being cached as success states.
- Add tests for:
  - mode lock logic
  - missing config warnings
  - `run()` blocking when config is incomplete
  - targeted rewrite availability

## Product/Architecture
- Separate provider logic from UI state in `App.jsx`; the file is currently carrying too much responsibility.
- Extract mode definitions, lock rules, and persona metadata into dedicated modules.
- Introduce a small diagnostics panel model instead of ad hoc status checks in render.

## Documentation
- Add a real operator setup section covering:
  - `proselab/.env`
  - local Ollama requirement
  - what each mode does
  - why `ENGINEER` and `VERDICT` lock
  - no login/auth expectation
