# Galaxy AI — VS Code Extension

Continue-style AI code assistant using your Galaxy AI workflow API.

## Setup

### 1. Install deps
```bash
npm install
```

### 2. Set your API key
Either in VS Code settings (`galaxy.apiKey`) or as an env var the extension will pick up at launch. If using env, add to your shell profile:
```bash
export GALAXY_AI_API_KEY=your_key_here
```

Or set it directly in settings:
```
Ctrl+, → search "galaxy.apiKey"
```

### 3. Configure workflow IDs
In `settings.json` or VS Code settings UI:
```json
{
  "galaxy.workflowId": "cmonfiheh0000kz04dpoe8cjz",
  "galaxy.nodeId":     "node_1777671164161_request",
  "galaxy.baseUrl":    "https://api.galaxy.ai/api/v1"
}
```
These match your CLI config exactly.

---

## Dev / Debug

Press **F5** in VS Code — launches Extension Development Host.

```bash
# Compile (watch mode)
npm run watch
```

---

## Build .vsix for install

```bash
npm install -g @vscode/vsce
vsce package
# → galaxy-ai-0.1.0.vsix

# Install locally
code --install-extension galaxy-ai-0.1.0.vsix
```

---

## Features

| Feature | How |
|---|---|
| Chat panel | `Ctrl+Shift+G` or activity bar ⬡ |
| Explain code | Select code → `Ctrl+Shift+E` or right-click |
| Fix / refactor | Select code → right-click → Galaxy AI: Fix |
| Inline completions | Enabled by default, toggle via `galaxy.inlineCompletions` |
| Reset memory | Command palette → "Galaxy AI: Reset Conversation Memory" |

---

## API Flow

Mirrors your `galaxy_cli.py` exactly:

1. `POST /api/v1/runs` → get `runId`
2. `GET /api/v1/runs/{runId}?inDetails=true` → poll until `COMPLETED`
3. Extract from `nodeRuns[].output` using same key priority: `output → text → content → response`
4. Delta detection: `current.slice(lastOutput.length)` fires live updates to the chat UI

---

## Config Reference

| Setting | Default | Description |
|---|---|---|
| `galaxy.apiKey` | — | API key |
| `galaxy.baseUrl` | `https://api.galaxy.ai/api/v1` | Base URL |
| `galaxy.workflowId` | — | Workflow ID |
| `galaxy.nodeId` | — | Node ID |
| `galaxy.maxTurns` | `6` | Memory turns |
| `galaxy.pollInterval` | `1200` | Poll ms |
| `galaxy.inlineCompletions` | `true` | Enable ghost text |
