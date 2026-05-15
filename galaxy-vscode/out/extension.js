"use strict";
/**
 * extension.ts — Galaxy AI VS Code Extension
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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const sidebarProvider_1 = require("./panels/sidebarProvider");
const inlineCompletion_1 = require("./providers/inlineCompletion");
const collector_1 = require("./context/collector");
function activate(ctx) {
    // ── 0. Register sidebar WebviewViewProvider (REQUIRED — without this the view just spins) ──
    const sidebar = new sidebarProvider_1.GalaxySidebarProvider(ctx.extensionUri);
    ctx.subscriptions.push(vscode.window.registerWebviewViewProvider(sidebarProvider_1.GalaxySidebarProvider.viewId, sidebar, { webviewOptions: { retainContextWhenHidden: true } }));
    // ── 1. Open chat (focus sidebar) ──
    ctx.subscriptions.push(vscode.commands.registerCommand('galaxy.openChat', () => {
        vscode.commands.executeCommand('galaxy.chatView.focus');
    }));
    // ── 2. Explain selection ──
    ctx.subscriptions.push(vscode.commands.registerCommand('galaxy.explainCode', async () => {
        const edCtx = (0, collector_1.getEditorContext)();
        if (!edCtx?.selection.trim()) {
            vscode.window.showWarningMessage('Galaxy AI: Select some code first.');
            return;
        }
        vscode.commands.executeCommand('galaxy.chatView.focus');
        sidebar.sendPrompt((0, collector_1.formatContextBlock)(edCtx), 'Explain this code clearly and concisely.');
    }));
    // ── 3. Fix / refactor ──
    ctx.subscriptions.push(vscode.commands.registerCommand('galaxy.fixCode', async () => {
        const edCtx = (0, collector_1.getEditorContext)();
        if (!edCtx?.selection.trim()) {
            vscode.window.showWarningMessage('Galaxy AI: Select some code first.');
            return;
        }
        const pick = await vscode.window.showQuickPick(['Fix bugs', 'Refactor / improve readability', 'Add comments', 'Write unit tests'], { placeHolder: 'What should Galaxy AI do with this code?' });
        if (!pick) {
            return;
        }
        vscode.commands.executeCommand('galaxy.chatView.focus');
        sidebar.sendPrompt((0, collector_1.formatContextBlock)(edCtx), pick);
    }));
    // ── 4. Reset memory ──
    ctx.subscriptions.push(vscode.commands.registerCommand('galaxy.resetMemory', () => {
        sidebarProvider_1.GalaxySidebarProvider.instance?.['_memory'] && (sidebarProvider_1.GalaxySidebarProvider.instance['_memory'] = []);
        sidebarProvider_1.GalaxySidebarProvider.instance?.['_post']?.({ type: 'memoryReset' });
        vscode.window.showInformationMessage('Galaxy AI: Memory reset.');
    }));
    // ── 5. Inline completions ──
    ctx.subscriptions.push(vscode.languages.registerInlineCompletionItemProvider({ pattern: '**' }, new inlineCompletion_1.GalaxyInlineCompletionProvider()));
    // ── 6. Config check ──
    _validateConfig();
}
function deactivate() { }
function _validateConfig() {
    const cfg = vscode.workspace.getConfiguration('galaxy');
    const key = cfg.get('apiKey') || process.env['GALAXY_AI_API_KEY'];
    if (!key) {
        vscode.window.showWarningMessage('Galaxy AI: No API key set.', 'Open Settings')
            .then(c => {
            if (c === 'Open Settings') {
                vscode.commands.executeCommand('workbench.action.openSettings', 'galaxy.apiKey');
            }
        });
    }
}
//# sourceMappingURL=extension.js.map