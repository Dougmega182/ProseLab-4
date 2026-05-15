/**
 * chatPanel.ts
 * Sidebar/panel chat UI backed by Galaxy AI run/poll API.
 * Sends delta chunks to webview as they arrive from polling.
 */

import * as vscode from 'vscode';
import {
  runWorkflow, buildPrompt, trimMemory,
  ConversationTurn, getConfig
} from '../api/galaxyClient';
import { getEditorContext, formatContextBlock } from '../context/collector';

export class ChatPanel {

  static currentPanel: ChatPanel | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private _memory: ConversationTurn[] = [];
  private _disposables: vscode.Disposable[] = [];
  private _cancelSource: vscode.CancellationTokenSource | undefined;

  // --------------------------------------------------------
  // Singleton create / show
  // --------------------------------------------------------

  static createOrShow(extensionUri: vscode.Uri): ChatPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.ViewColumn.Beside
      : vscode.ViewColumn.One;

    if (ChatPanel.currentPanel) {
      ChatPanel.currentPanel._panel.reveal(column);
      return ChatPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      'galaxyChat',
      'Galaxy AI',
      column,
      {
        enableScripts:         true,
        retainContextWhenHidden: true,
        localResourceRoots:    [vscode.Uri.joinPath(extensionUri, 'media')],
      }
    );

    ChatPanel.currentPanel = new ChatPanel(panel, extensionUri);
    return ChatPanel.currentPanel;
  }

  static sendToPanel(text: string, prefill?: string): void {
    if (!ChatPanel.currentPanel) { return; }
    ChatPanel.currentPanel._panel.webview.postMessage({
      type: 'prefill',
      text,
      prefill: prefill || '',
    });
  }

  // --------------------------------------------------------
  // Constructor
  // --------------------------------------------------------

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._panel.webview.html = this._getHtml();

    // Clean up on close
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      async (msg: WebviewMessage) => {
        switch (msg.type) {
          case 'userMessage': if (msg.text) { await this._handleUserMessage(msg.text, msg.includeContext ?? true); } break;
          case 'resetMemory': this._resetMemory(); break;
          case 'cancel':      this._cancel(); break;
        }
      },
      null,
      this._disposables
    );
  }

  // --------------------------------------------------------
  // Message handling
  // --------------------------------------------------------

  private async _handleUserMessage(text: string, includeContext: boolean): Promise<void> {
    // Cancel any in-flight request
    this._cancel();
    this._cancelSource = new vscode.CancellationTokenSource();

    const cfg = getConfig();

    // Build context prefix if requested and editor is active
    let contextBlock = '';
    if (includeContext) {
      const ctx = getEditorContext(40);
      if (ctx) { contextBlock = formatContextBlock(ctx) + '\n\n'; }
    }

    const fullInput = contextBlock + text;
    const prompt    = buildPrompt(this._memory, fullInput, cfg.maxTurns);

    // Tell UI we're running
    this._post({ type: 'runStart' });

    try {
      let assembled = '';

      const result = await runWorkflow(
        prompt,
        (delta) => {
          assembled += delta;
          this._post({ type: 'delta', text: delta });
        },
        this._cancelSource.token
      );

      // Use assembled if delta fired, fallback to returned result
      const finalText = assembled || result;

      // Persist to memory
      this._memory.push({ role: 'user',      content: text });
      this._memory.push({ role: 'assistant', content: finalText });
      this._memory = trimMemory(this._memory, cfg.maxTurns);

      this._post({ type: 'runDone', text: finalText });

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('Cancelled')) {
        this._post({ type: 'error', text: msg });
      }
    }
  }

  private _resetMemory(): void {
    this._memory = [];
    this._post({ type: 'memoryReset' });
  }

  private _cancel(): void {
    this._cancelSource?.cancel();
    this._cancelSource?.dispose();
    this._cancelSource = undefined;
  }

  private _post(msg: Record<string, unknown>): void {
    this._panel.webview.postMessage(msg);
  }

  // --------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------

  public dispose(): void {
    this._cancel();
    ChatPanel.currentPanel = undefined;
    this._panel.dispose();
    this._disposables.forEach(d => d.dispose());
    this._disposables = [];
  }

  // --------------------------------------------------------
  // Webview HTML — dark terminal aesthetic
  // --------------------------------------------------------

  private _getHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Galaxy AI</title>
<style>
  :root {
    --bg:        #0d0d0f;
    --surface:   #141416;
    --border:    #252528;
    --accent:    #7c6af7;
    --accent2:   #a78bfa;
    --text:      #e2e2e8;
    --muted:     #6b6b78;
    --user-bg:   #1a1a2e;
    --ai-bg:     #0f1117;
    --code-bg:   #0a0a0c;
    --danger:    #f87171;
    --success:   #34d399;
    --font-mono: 'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace;
    --font-ui:   -apple-system, 'Segoe UI', system-ui, sans-serif;
    --radius:    6px;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: var(--font-ui);
    background: var(--bg);
    color: var(--text);
    height: 100vh;
    display: flex;
    flex-direction: column;
    font-size: 13px;
    line-height: 1.55;
    overflow: hidden;
  }

  /* ── Header ── */
  #header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
    flex-shrink: 0;
  }
  #header .title {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--accent2);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  #header .controls {
    display: flex;
    gap: 6px;
  }
  .icon-btn {
    background: none;
    border: 1px solid var(--border);
    color: var(--muted);
    border-radius: var(--radius);
    padding: 3px 8px;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s;
    font-family: var(--font-ui);
  }
  .icon-btn:hover { color: var(--text); border-color: var(--accent); }
  .icon-btn.danger:hover { color: var(--danger); border-color: var(--danger); }

  /* ── Messages ── */
  #messages {
    flex: 1;
    overflow-y: auto;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    scroll-behavior: smooth;
  }
  #messages::-webkit-scrollbar { width: 4px; }
  #messages::-webkit-scrollbar-track { background: transparent; }
  #messages::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

  .msg {
    border-radius: var(--radius);
    padding: 10px 12px;
    max-width: 100%;
    animation: fadeIn 0.18s ease;
  }
  @keyframes fadeIn { from { opacity:0; transform: translateY(4px); } to { opacity:1; transform:none; } }

  .msg.user {
    background: var(--user-bg);
    border: 1px solid #2a2a45;
    align-self: flex-end;
    max-width: 85%;
  }
  .msg.assistant {
    background: var(--ai-bg);
    border: 1px solid var(--border);
    align-self: flex-start;
    width: 100%;
  }
  .msg.error {
    background: #1a0f0f;
    border: 1px solid #4a1e1e;
    color: var(--danger);
    font-family: var(--font-mono);
    font-size: 11px;
  }
  .msg-label {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--muted);
    margin-bottom: 5px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .msg.user .msg-label { color: var(--accent); }

  /* ── Code blocks in AI responses ── */
  pre {
    background: var(--code-bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 10px 12px;
    overflow-x: auto;
    margin: 8px 0;
    font-size: 12px;
  }
  code { font-family: var(--font-mono); font-size: 12px; }
  p:not(:last-child) { margin-bottom: 6px; }

  /* ── Typing indicator ── */
  #typing {
    display: none;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--muted);
    flex-shrink: 0;
  }
  #typing.visible { display: flex; }
  .dot-pulse {
    display: flex;
    gap: 3px;
  }
  .dot-pulse span {
    width: 4px; height: 4px;
    background: var(--accent);
    border-radius: 50%;
    animation: pulse 1.2s infinite ease-in-out;
  }
  .dot-pulse span:nth-child(2) { animation-delay: 0.2s; }
  .dot-pulse span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes pulse {
    0%,80%,100% { opacity: 0.3; transform: scale(0.8); }
    40%          { opacity: 1;   transform: scale(1); }
  }

  /* ── Input area ── */
  #input-area {
    padding: 10px 14px;
    border-top: 1px solid var(--border);
    background: var(--surface);
    flex-shrink: 0;
  }
  #input-row {
    display: flex;
    gap: 8px;
    align-items: flex-end;
  }
  #user-input {
    flex: 1;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    font-family: var(--font-ui);
    font-size: 13px;
    padding: 8px 10px;
    resize: none;
    min-height: 38px;
    max-height: 160px;
    line-height: 1.5;
    outline: none;
    transition: border-color 0.15s;
  }
  #user-input:focus { border-color: var(--accent); }
  #user-input::placeholder { color: var(--muted); }

  #send-btn {
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: var(--radius);
    padding: 8px 14px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
    flex-shrink: 0;
    height: 38px;
  }
  #send-btn:hover { background: var(--accent2); }
  #send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  #options-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 6px;
  }
  .toggle-label {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    color: var(--muted);
    cursor: pointer;
    user-select: none;
  }
  .toggle-label input[type=checkbox] { accent-color: var(--accent); cursor: pointer; }
  .toggle-label:hover { color: var(--text); }

  .cancel-btn {
    background: none;
    border: 1px solid var(--border);
    color: var(--danger);
    border-radius: var(--radius);
    padding: 3px 10px;
    font-size: 11px;
    cursor: pointer;
    display: none;
    margin-left: auto;
  }
  .cancel-btn.visible { display: block; }

  /* ── Empty state ── */
  #empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: var(--muted);
    font-size: 12px;
    padding: 20px;
    text-align: center;
  }
  #empty .logo {
    font-family: var(--font-mono);
    font-size: 22px;
    color: var(--accent);
    letter-spacing: -0.02em;
    margin-bottom: 4px;
  }
  #empty .hint {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--border);
  }
  #empty.hidden { display: none; }
</style>
</head>
<body>

<div id="header">
  <span class="title">⬡ Galaxy AI</span>
  <div class="controls">
    <button class="icon-btn danger" title="Reset conversation memory" onclick="resetMemory()">reset</button>
  </div>
</div>

<div id="messages">
  <div id="empty">
    <div class="logo">⬡</div>
    <div>Ask anything about your code</div>
    <div class="hint">Select code in editor, then toggle "include context" below</div>
  </div>
</div>

<div id="typing">
  <div class="dot-pulse"><span></span><span></span><span></span></div>
  <span id="typing-label">running workflow…</span>
</div>

<div id="input-area">
  <div id="input-row">
    <textarea
      id="user-input"
      rows="1"
      placeholder="Message Galaxy AI…"
      onkeydown="handleKey(event)"
      oninput="autoResize(this)"
    ></textarea>
    <button id="send-btn" onclick="sendMessage()">Send</button>
  </div>
  <div id="options-row">
    <label class="toggle-label">
      <input type="checkbox" id="include-ctx" checked>
      include editor context
    </label>
    <button class="cancel-btn" id="cancel-btn" onclick="cancelRun()">cancel</button>
  </div>
</div>

<script>
  const vscode     = acquireVsCodeApi();
  const messages   = document.getElementById('messages');
  const input      = document.getElementById('user-input');
  const sendBtn    = document.getElementById('send-btn');
  const typing     = document.getElementById('typing');
  const cancelBtn  = document.getElementById('cancel-btn');
  const empty      = document.getElementById('empty');
  const typingLbl  = document.getElementById('typing-label');
  const resetBtn   = document.querySelector('.icon-btn.danger');

  let currentAIDiv  = null;
  let currentBuffer = '';
  let running       = false;

  // Add event listeners
  // sendBtn?.addEventListener('click', sendMessage);
  // input?.addEventListener('keydown', handleKey);
  // input?.addEventListener('input', () => autoResize(input));
  // resetBtn?.addEventListener('click', resetMemory);
  // cancelBtn?.addEventListener('click', cancelRun);

  // ── Receive messages from extension ──
  window.addEventListener('message', (e) => {
    const msg = e.data;
    switch (msg.type) {
      case 'prefill':
        if (msg.prefill) { input.value = msg.prefill; autoResize(input); }
        if (msg.text)    { addUserMessage(msg.text); startAIMessage(); }
        break;
      case 'runStart':
        startAIMessage();
        break;
      case 'delta':
        appendDelta(msg.text);
        break;
      case 'runDone':
        finishAIMessage(msg.text);
        break;
      case 'error':
        addError(msg.text);
        setRunning(false);
        break;
      case 'memoryReset':
        messages.innerHTML = '';
        messages.appendChild(empty);
        empty.classList.remove('hidden');
        break;
    }
  });

  // ── Send message ──
  function sendMessage() {
    const text = input.value.trim();
    if (!text || running) { return; }

    empty.classList.add('hidden');
    addUserMessage(text);
    input.value = '';
    autoResize(input);
    setRunning(true);

    vscode.postMessage({
      type:           'userMessage',
      text,
      includeContext: document.getElementById('include-ctx').checked,
    });
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function cancelRun() {
    vscode.postMessage({ type: 'cancel' });
    setRunning(false);
    if (currentAIDiv) {
      const label = currentAIDiv.querySelector('.msg-label');
      if (label) { label.textContent = 'galaxy ai  ·  cancelled'; }
    }
    currentAIDiv  = null;
    currentBuffer = '';
  }

  function resetMemory() {
    vscode.postMessage({ type: 'resetMemory' });
  }

  // ── Message rendering ──
  function addUserMessage(text) {
    const d = document.createElement('div');
    d.className = 'msg user';
    d.innerHTML = '<div class="msg-label">you</div>' +
                  '<div class="msg-body">' + escHtml(text) + '</div>';
    messages.appendChild(d);
    scrollBottom();
  }

  function startAIMessage() {
    currentBuffer = '';
    currentAIDiv  = document.createElement('div');
    currentAIDiv.className = 'msg assistant';
    currentAIDiv.innerHTML = '<div class="msg-label">galaxy ai  ·  <span class="run-status">polling…</span></div>' +
                             '<div class="msg-body"></div>';
    messages.appendChild(currentAIDiv);
    scrollBottom();
    typing.classList.add('visible');
  }

  function appendDelta(delta) {
    if (!currentAIDiv) { startAIMessage(); }
    currentBuffer += delta;
    const body = currentAIDiv.querySelector('.msg-body');
    body.innerHTML = renderMarkdown(currentBuffer);
    scrollBottom();
  }

  function finishAIMessage(fullText) {
    typing.classList.remove('visible');
    if (currentAIDiv) {
      const body   = currentAIDiv.querySelector('.msg-body');
      const status = currentAIDiv.querySelector('.run-status');
      body.innerHTML = renderMarkdown(fullText || currentBuffer);
      if (status) { status.textContent = 'done'; }
    }
    currentAIDiv  = null;
    currentBuffer = '';
    setRunning(false);
    scrollBottom();
  }

  function addError(text) {
    const d = document.createElement('div');
    d.className = 'msg error';
    d.textContent = '⚠ ' + text;
    messages.appendChild(d);
    scrollBottom();
    typing.classList.remove('visible');
  }

  // ── State helpers ──
  function setRunning(state) {
    running        = state;
    sendBtn.disabled = state;
    cancelBtn.classList.toggle('visible', state);
    if (!state) { typing.classList.remove('visible'); }
  }

  function scrollBottom() {
    messages.scrollTop = messages.scrollHeight;
  }

  // ── Basic markdown renderer (code blocks + paragraphs) ──
  function renderMarkdown(raw) {
    let out = escHtml(raw);

    // code blocks (triple backtick fences)
    out = out.replace(/\x60\x60\x60([a-zA-Z]*)\n?([\s\S]*?)\x60\x60\x60/g, (_, lang, code) => {
      return '<pre><code class="lang-' + lang + '">' + code.trim() + '</code></pre>';
    });

    // inline code
    out = out.replace(/\x60([^\x60]+)\x60/g, '<code>$1</code>');

    // bold
    out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // newlines → paragraphs
    out = out.split(/\n{2,}/).map(p => '<p>' + p.replace(/\n/g, '<br>') + '</p>').join('');

    return out;
  }

  function escHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }
</script>
</body>
</html>`;
  }
}

// --------------------------------------------------------
// Types
// --------------------------------------------------------

interface WebviewMessage {
  type:           string;
  text?:          string;
  includeContext?: boolean;
}
