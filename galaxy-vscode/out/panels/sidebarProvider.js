"use strict";
/**
 * sidebarProvider.ts
 *
 * Implements WebviewViewProvider — required for the activity bar sidebar view.
 * VS Code calls resolveWebviewView() once when the panel first becomes visible.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GalaxySidebarProvider = void 0;
const vscode = __importStar(require("vscode"));
const galaxyClient_1 = require("../api/galaxyClient");
const collector_1 = require("../context/collector");
class GalaxySidebarProvider {
    constructor(_extensionUri) {
        this._extensionUri = _extensionUri;
        this._memory = [];
        GalaxySidebarProvider.instance = this;
    }
    // ── Called by VS Code when the sidebar view becomes visible ──
    resolveWebviewView(webviewView, _context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };
        webviewView.webview.html = this._getHtml();
        webviewView.webview.onDidReceiveMessage(async (msg) => {
            switch (msg.type) {
                case 'userMessage':
                    if (msg.text) {
                        await this._handleMessage(msg.text, msg.includeContext ?? true);
                    }
                    break;
                case 'resetMemory':
                    this._memory = [];
                    this._post({ type: 'memoryReset' });
                    break;
                case 'cancel':
                    this._cancel();
                    break;
            }
        });
    }
    // ── Public: push a prefilled prompt from a command ──
    sendPrompt(contextText, userPrompt) {
        if (!this._view) {
            return;
        }
        this._view.show(true);
        // Small delay to ensure view is visible before posting
        setTimeout(() => {
            this._post({ type: 'prefill', text: contextText, prefill: userPrompt });
            void this._handleMessage(userPrompt + '\n\n' + contextText, false);
        }, 200);
    }
    // ── Core message handler ──
    async _handleMessage(text, includeContext) {
        this._cancel();
        this._cancelSource = new vscode.CancellationTokenSource();
        const cfg = (0, galaxyClient_1.getConfig)();
        let contextBlock = '';
        if (includeContext) {
            const ctx = (0, collector_1.getEditorContext)(40);
            if (ctx) {
                contextBlock = (0, collector_1.formatContextBlock)(ctx) + '\n\n';
            }
        }
        const fullInput = contextBlock + text;
        const prompt = (0, galaxyClient_1.buildPrompt)(this._memory, fullInput, cfg.maxTurns);
        this._post({ type: 'runStart' });
        try {
            let assembled = '';
            const result = await (0, galaxyClient_1.runWorkflow)(prompt, (delta) => {
                assembled += delta;
                this._post({ type: 'delta', text: delta });
            }, this._cancelSource.token);
            const finalText = assembled || result;
            this._memory.push({ role: 'user', content: text });
            this._memory.push({ role: 'assistant', content: finalText });
            this._memory = (0, galaxyClient_1.trimMemory)(this._memory, cfg.maxTurns);
            this._post({ type: 'runDone', text: finalText });
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (!msg.includes('Cancelled')) {
                this._post({ type: 'error', text: msg });
            }
            else {
                this._post({ type: 'cancelled' });
            }
        }
    }
    _cancel() {
        this._cancelSource?.cancel();
        this._cancelSource?.dispose();
        this._cancelSource = undefined;
    }
    _post(msg) {
        this._view?.webview.postMessage(msg);
    }
    // ── HTML ──
    _getHtml() {
        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<title>Galaxy AI</title>
<style>
  :root {
    --bg:       var(--vscode-sideBar-background, #0d0d0f);
    --surface:  var(--vscode-editorWidget-background, #141416);
    --border:   var(--vscode-widget-border, #252528);
    --accent:   #7c6af7;
    --accent2:  #a78bfa;
    --text:     var(--vscode-foreground, #e2e2e8);
    --muted:    var(--vscode-descriptionForeground, #6b6b78);
    --input-bg: var(--vscode-input-background, #0d0d0f);
    --input-fg: var(--vscode-input-foreground, #e2e2e8);
    --danger:   #f87171;
    --mono:     var(--vscode-editor-font-family, 'Cascadia Code', monospace);
    --ui:       var(--vscode-font-family, -apple-system, sans-serif);
    --r:        5px;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: var(--ui);
    font-size: 12px;
    background: var(--bg);
    color: var(--text);
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* header */
  #hdr {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 7px 10px;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
    flex-shrink: 0;
  }
  #hdr .brand {
    font-family: var(--mono);
    font-size: 10px;
    color: var(--accent2);
    letter-spacing: .08em;
    text-transform: uppercase;
  }
  .hbtn {
    background: none;
    border: 1px solid var(--border);
    color: var(--muted);
    border-radius: var(--r);
    padding: 2px 7px;
    font-size: 10px;
    cursor: pointer;
  }
  .hbtn:hover { color: var(--danger); border-color: var(--danger); }

  /* messages */
  #msgs {
    flex: 1;
    overflow-y: auto;
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  #msgs::-webkit-scrollbar { width: 3px; }
  #msgs::-webkit-scrollbar-thumb { background: var(--border); }

  .msg { border-radius: var(--r); padding: 8px 10px; animation: fi .15s ease; }
  @keyframes fi { from { opacity:0; transform:translateY(3px); } to { opacity:1; } }

  .msg.user {
    background: color-mix(in srgb, var(--accent) 12%, var(--bg));
    border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
    align-self: flex-end;
    max-width: 90%;
  }
  .msg.ai {
    background: var(--surface);
    border: 1px solid var(--border);
  }
  .msg.err {
    background: color-mix(in srgb, var(--danger) 10%, var(--bg));
    border: 1px solid color-mix(in srgb, var(--danger) 30%, transparent);
    color: var(--danger);
    font-family: var(--mono);
    font-size: 10px;
  }
  .lbl {
    font-family: var(--mono);
    font-size: 9px;
    color: var(--muted);
    margin-bottom: 4px;
    text-transform: uppercase;
    letter-spacing: .05em;
  }
  .msg.user .lbl { color: var(--accent); }

  pre {
    background: color-mix(in srgb, #000 40%, var(--surface));
    border: 1px solid var(--border);
    border-radius: var(--r);
    padding: 8px;
    overflow-x: auto;
    margin: 6px 0;
    font-size: 11px;
  }
  code { font-family: var(--mono); font-size: 11px; }
  p:not(:last-child) { margin-bottom: 5px; }

  /* empty state */
  #empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    color: var(--muted);
    text-align: center;
    padding: 20px;
  }
  #empty .logo { font-size: 28px; margin-bottom: 4px; }
  #empty .hint { font-family: var(--mono); font-size: 9px; color: var(--border); line-height: 1.6; }
  #empty.gone { display: none; }

  /* typing */
  #typing {
    display: none;
    padding: 4px 10px 6px;
    gap: 6px;
    align-items: center;
    font-family: var(--mono);
    font-size: 10px;
    color: var(--muted);
    flex-shrink: 0;
  }
  #typing.on { display: flex; }
  .dots { display: flex; gap: 3px; }
  .dots span {
    width: 3px; height: 3px;
    background: var(--accent);
    border-radius: 50%;
    animation: dp 1.2s infinite ease;
  }
  .dots span:nth-child(2) { animation-delay: .2s; }
  .dots span:nth-child(3) { animation-delay: .4s; }
  @keyframes dp { 0%,80%,100%{opacity:.3;transform:scale(.8)} 40%{opacity:1;transform:scale(1)} }

  /* input */
  #foot {
    padding: 8px 10px;
    border-top: 1px solid var(--border);
    background: var(--surface);
    flex-shrink: 0;
  }
  #row { display: flex; gap: 6px; align-items: flex-end; }
  #inp {
    flex: 1;
    background: var(--input-bg);
    border: 1px solid var(--border);
    border-radius: var(--r);
    color: var(--input-fg);
    font-family: var(--ui);
    font-size: 12px;
    padding: 6px 8px;
    resize: none;
    min-height: 32px;
    max-height: 120px;
    outline: none;
    line-height: 1.45;
    transition: border-color .15s;
  }
  #inp:focus { border-color: var(--accent); }
  #inp::placeholder { color: var(--muted); }
  #sbtn {
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: var(--r);
    padding: 6px 11px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    height: 32px;
    transition: background .15s;
    flex-shrink: 0;
  }
  #sbtn:hover { background: var(--accent2); }
  #sbtn:disabled { opacity: .35; cursor: not-allowed; }
  #opts {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 5px;
  }
  .tog {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    color: var(--muted);
    cursor: pointer;
    user-select: none;
  }
  .tog input { accent-color: var(--accent); cursor: pointer; }
  .tog:hover { color: var(--text); }
  #cbtn {
    display: none;
    margin-left: auto;
    background: none;
    border: 1px solid var(--border);
    color: var(--danger);
    border-radius: var(--r);
    padding: 2px 8px;
    font-size: 10px;
    cursor: pointer;
  }
  #cbtn.on { display: block; }
</style>
</head>
<body>

<div id="hdr">
  <span class="brand">⬡ Galaxy AI</span>
  <button class="hbtn" title="Reset memory" onclick="resetMem()">reset</button>
</div>

<div id="msgs">
  <div id="empty">
    <div class="logo">⬡</div>
    <div>Ask anything about your code</div>
    <div class="hint">Ctrl+Shift+G to open<br>Select code → right-click for quick actions</div>
  </div>
</div>

<div id="typing">
  <div class="dots"><span></span><span></span><span></span></div>
  <span>polling workflow…</span>
</div>

<div id="foot">
  <div id="row">
      <textarea id="inp" rows="1" placeholder="Message Galaxy AI…" onkeydown="onKey(event)" oninput="resize(this)"></textarea>
      <button id="sbtn" onclick="send()">Send</button>
    </div>
    <div id="opts">
      <label class="tog"><input type="checkbox" id="ctx" checked> include context</label>
      <button id="cbtn" onclick="cancel()">cancel</button>

<script>
  const vsc    = acquireVsCodeApi();
  const msgs   = document.getElementById('msgs');
  const inp    = document.getElementById('inp');
  const sbtn   = document.getElementById('sbtn');
  const typing = document.getElementById('typing');
  const cbtn   = document.getElementById('cbtn');
  const empty  = document.getElementById('empty');
  const resetBtn = document.querySelector('.hbtn');

  let aiDiv  = null;
  let buf    = '';
  let busy   = false;

  // Add event listeners
  // sbtn?.addEventListener('click', send);
  // inp?.addEventListener('keydown', onKey);
  // inp?.addEventListener('input', () => resize(inp));
  // resetBtn?.addEventListener('click', resetMem);
  // cbtn?.addEventListener('click', cancel);

  window.addEventListener('message', e => {
    const m = e.data;
    if      (m.type === 'runStart')   { startAI(); }
    else if (m.type === 'delta')      { appendDelta(m.text); }
    else if (m.type === 'runDone')    { finishAI(m.text); }
    else if (m.type === 'error')      { showErr(m.text); setBusy(false); }
    else if (m.type === 'cancelled')  { if(aiDiv){aiDiv.querySelector('.lbl').textContent='galaxy ai - cancelled';} setBusy(false); aiDiv=null; buf=''; }
    else if (m.type === 'memoryReset'){ msgs.innerHTML=''; msgs.appendChild(empty); empty.classList.remove('gone'); }
    else if (m.type === 'prefill')    { if(m.prefill){ inp.value=m.prefill; resize(inp); } }
  });

  function send() {
    const txt = inp.value.trim();
    if (!txt || busy) { return; }
    empty.classList.add('gone');
    addUser(txt);
    inp.value = '';
    resize(inp);
    setBusy(true);
    vsc.postMessage({ type:'userMessage', text:txt, includeContext: document.getElementById('ctx').checked });
  }

  function onKey(e) { if (e.key==='Enter' && !e.shiftKey){ e.preventDefault(); send(); } }

  function cancel() {
    vsc.postMessage({ type:'cancel' });
  }

  function resetMem() { vsc.postMessage({ type:'resetMemory' }); }

  function addUser(txt) {
    const d = mk('div','msg user');
    d.innerHTML = '<div class="lbl">you</div><div class="body">' + esc(txt) + '</div>';
    msgs.appendChild(d);
    scroll();
  }

  function startAI() {
    buf = '';
    aiDiv = mk('div','msg ai');
    aiDiv.innerHTML = '<div class="lbl">galaxy ai - <span class="st">running...</span></div><div class="body"></div>';
    msgs.appendChild(aiDiv);
    typing.classList.add('on');
    scroll();
  }

  function appendDelta(d) {
    if (!aiDiv) { startAI(); }
    buf += d;
    aiDiv.querySelector('.body').innerHTML = render(buf);
    scroll();
  }

  function finishAI(full) {
    typing.classList.remove('on');
    if (aiDiv) {
      aiDiv.querySelector('.body').innerHTML = render(full || buf);
      const st = aiDiv.querySelector('.st');
      if (st) { st.textContent = 'done'; }
    }
    aiDiv = null; buf = '';
    setBusy(false);
    scroll();
  }

  function showErr(txt) {
    const d = mk('div','msg err');
    d.textContent = '[!] ' + txt;
    msgs.appendChild(d);
    typing.classList.remove('on');
    scroll();
  }

  function setBusy(v) {
    busy = v;
    sbtn.disabled = v;
    cbtn.classList.toggle('on', v);
    if (!v) { typing.classList.remove('on'); }
  }

  function scroll() { msgs.scrollTop = msgs.scrollHeight; }

  function mk(tag, cls) {
    const el = document.createElement(tag);
    el.className = cls;
    return el;
  }

  function render(raw) {
    if (!raw) return '';
    // Very simple paragraph split
    return esc(raw).split('\n\n').map(p => '<p>' + p.split('\n').join('<br>') + '</p>').join('');
  }

  function esc(s) {
    if (!s) return '';
    return s.split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;');
  }

  function resize(el) {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }
</script>
</body>
</html>`;
    }
}
exports.GalaxySidebarProvider = GalaxySidebarProvider;
GalaxySidebarProvider.viewId = 'galaxy.chatView';
//# sourceMappingURL=sidebarProvider.js.map