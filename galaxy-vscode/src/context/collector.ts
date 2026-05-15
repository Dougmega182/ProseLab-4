/**
 * collector.ts
 * Builds rich code context from VS Code editor state
 */

import * as vscode from 'vscode';

export interface CodeContext {
  fileName:     string;
  language:     string;
  selection:    string;
  prefix:       string;   // lines before cursor
  suffix:       string;   // lines after cursor
  diagnostics:  string;   // any errors/warnings in file
}

export function getEditorContext(lines = 40): CodeContext | null {
  const editor = vscode.window.activeTextEditor;
  if (!editor) { return null; }

  const doc      = editor.document;
  const pos      = editor.selection.active;
  const selected = editor.document.getText(editor.selection);

  const prefixStart = new vscode.Position(Math.max(0, pos.line - lines), 0);
  const suffixEnd   = new vscode.Position(
    Math.min(doc.lineCount - 1, pos.line + lines),
    doc.lineAt(Math.min(doc.lineCount - 1, pos.line + lines)).text.length
  );

  const prefix = doc.getText(new vscode.Range(prefixStart, pos));
  const suffix = doc.getText(new vscode.Range(pos, suffixEnd));

  // Grab any LSP diagnostics visible in the file
  const diags = vscode.languages
    .getDiagnostics(doc.uri)
    .map(d => `  Line ${d.range.start.line + 1}: [${severityLabel(d.severity)}] ${d.message}`)
    .join('\n');

  return {
    fileName:    doc.fileName,
    language:    doc.languageId,
    selection:   selected,
    prefix,
    suffix,
    diagnostics: diags,
  };
}

/** Format context into a prompt header block */
export function formatContextBlock(ctx: CodeContext): string {
  const parts: string[] = [
    `File: ${ctx.fileName}`,
    `Language: ${ctx.language}`,
  ];

  if (ctx.selection.trim()) {
    parts.push(`\nSelected code:\n\`\`\`${ctx.language}\n${ctx.selection}\n\`\`\``);
  } else {
    parts.push(
      `\nCode before cursor:\n\`\`\`${ctx.language}\n${ctx.prefix}\n\`\`\``,
      `\nCode after cursor:\n\`\`\`${ctx.language}\n${ctx.suffix}\n\`\`\``
    );
  }

  if (ctx.diagnostics) {
    parts.push(`\nActive diagnostics:\n${ctx.diagnostics}`);
  }

  return parts.join('\n');
}

function severityLabel(s: vscode.DiagnosticSeverity | undefined): string {
  switch (s) {
    case vscode.DiagnosticSeverity.Error:       return 'ERROR';
    case vscode.DiagnosticSeverity.Warning:     return 'WARN';
    case vscode.DiagnosticSeverity.Information: return 'INFO';
    default:                                    return 'HINT';
  }
}
