/**
 * extension.ts — Galaxy AI VS Code Extension
 */

import * as vscode from 'vscode';
import { GalaxySidebarProvider } from './panels/sidebarProvider';
import { GalaxyInlineCompletionProvider } from './providers/inlineCompletion';
import { getEditorContext, formatContextBlock } from './context/collector';

export function activate(ctx: vscode.ExtensionContext): void {

  // ── 0. Register sidebar WebviewViewProvider (REQUIRED — without this the view just spins) ──
  const sidebar = new GalaxySidebarProvider(ctx.extensionUri);
  ctx.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      GalaxySidebarProvider.viewId,
      sidebar,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  // ── 1. Open chat (focus sidebar) ──
  ctx.subscriptions.push(
    vscode.commands.registerCommand('galaxy.openChat', () => {
      vscode.commands.executeCommand('galaxy.chatView.focus');
    })
  );

  // ── 2. Explain selection ──
  ctx.subscriptions.push(
    vscode.commands.registerCommand('galaxy.explainCode', async () => {
      const edCtx = getEditorContext();
      if (!edCtx?.selection.trim()) {
        vscode.window.showWarningMessage('Galaxy AI: Select some code first.');
        return;
      }
      vscode.commands.executeCommand('galaxy.chatView.focus');
      sidebar.sendPrompt(formatContextBlock(edCtx), 'Explain this code clearly and concisely.');
    })
  );

  // ── 3. Fix / refactor ──
  ctx.subscriptions.push(
    vscode.commands.registerCommand('galaxy.fixCode', async () => {
      const edCtx = getEditorContext();
      if (!edCtx?.selection.trim()) {
        vscode.window.showWarningMessage('Galaxy AI: Select some code first.');
        return;
      }
      const pick = await vscode.window.showQuickPick(
        ['Fix bugs', 'Refactor / improve readability', 'Add comments', 'Write unit tests'],
        { placeHolder: 'What should Galaxy AI do with this code?' }
      );
      if (!pick) { return; }
      vscode.commands.executeCommand('galaxy.chatView.focus');
      sidebar.sendPrompt(formatContextBlock(edCtx), pick);
    })
  );

  // ── 4. Reset memory ──
  ctx.subscriptions.push(
    vscode.commands.registerCommand('galaxy.resetMemory', () => {
      GalaxySidebarProvider.instance?.['_memory'] && (GalaxySidebarProvider.instance['_memory'] = []);
      GalaxySidebarProvider.instance?.['_post']?.({ type: 'memoryReset' });
      vscode.window.showInformationMessage('Galaxy AI: Memory reset.');
    })
  );

  // ── 5. Inline completions ──
  ctx.subscriptions.push(
    vscode.languages.registerInlineCompletionItemProvider(
      { pattern: '**' },
      new GalaxyInlineCompletionProvider()
    )
  );

  // ── 6. Config check ──
  _validateConfig();
}

export function deactivate(): void {}

function _validateConfig(): void {
  const cfg = vscode.workspace.getConfiguration('galaxy');
  const key = cfg.get<string>('apiKey') || process.env['GALAXY_AI_API_KEY'];
  if (!key) {
    vscode.window.showWarningMessage('Galaxy AI: No API key set.', 'Open Settings')
      .then(c => {
        if (c === 'Open Settings') {
          vscode.commands.executeCommand('workbench.action.openSettings', 'galaxy.apiKey');
        }
      });
  }
}
