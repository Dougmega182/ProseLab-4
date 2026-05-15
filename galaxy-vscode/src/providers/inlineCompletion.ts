/**
 * inlineCompletion.ts
 * Ghost-text completions — debounced, cancellation-aware
 */

import * as vscode from 'vscode';
import { runWorkflow, buildPrompt, getConfig } from '../api/galaxyClient';
import { getEditorContext } from '../context/collector';

const DEBOUNCE_MS = 600;

export class GalaxyInlineCompletionProvider
  implements vscode.InlineCompletionItemProvider {

  private lastTimer: ReturnType<typeof setTimeout> | undefined;

  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionList | undefined> {

    // Check setting before doing anything
    const cfg = vscode.workspace.getConfiguration('galaxy');
    if (!cfg.get<boolean>('inlineCompletions')) { return; }

    // Debounce
    await new Promise<void>((resolve) => {
      if (this.lastTimer) { clearTimeout(this.lastTimer); }
      this.lastTimer = setTimeout(resolve, DEBOUNCE_MS);
    });
    if (token.isCancellationRequested) { return; }

    const ctx = getEditorContext(30);
    if (!ctx) { return; }

    // Only complete if the line has meaningful content
    const currentLine = document.lineAt(position.line).text.trim();
    if (currentLine.length < 2) { return; }

    try {
      const { maxTurns } = getConfig();
      const prompt = buildPrompt(
        [],
        [
          `You are a code completion engine. Complete the code exactly where it left off.`,
          `Return ONLY the completion text — no explanation, no markdown, no backticks.`,
          `\nFile: ${ctx.fileName} (${ctx.language})`,
          `\nCode prefix:\n${ctx.prefix}`,
          `\nCode suffix (for context):\n${ctx.suffix}`,
          `\nReturn the completion that goes between prefix and suffix.`,
        ].join('\n'),
        maxTurns
      );

      const result = await runWorkflow(prompt, undefined, token);
      if (!result || token.isCancellationRequested) { return; }

      return new vscode.InlineCompletionList([
        new vscode.InlineCompletionItem(
          result.trim(),
          new vscode.Range(position, position)
        )
      ]);

    } catch {
      // Silent fail — inline completions should never throw to the user
      return;
    }
  }
}
