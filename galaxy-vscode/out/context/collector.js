"use strict";
/**
 * collector.ts
 * Builds rich code context from VS Code editor state
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
exports.getEditorContext = getEditorContext;
exports.formatContextBlock = formatContextBlock;
const vscode = __importStar(require("vscode"));
function getEditorContext(lines = 40) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return null;
    }
    const doc = editor.document;
    const pos = editor.selection.active;
    const selected = editor.document.getText(editor.selection);
    const prefixStart = new vscode.Position(Math.max(0, pos.line - lines), 0);
    const suffixEnd = new vscode.Position(Math.min(doc.lineCount - 1, pos.line + lines), doc.lineAt(Math.min(doc.lineCount - 1, pos.line + lines)).text.length);
    const prefix = doc.getText(new vscode.Range(prefixStart, pos));
    const suffix = doc.getText(new vscode.Range(pos, suffixEnd));
    // Grab any LSP diagnostics visible in the file
    const diags = vscode.languages
        .getDiagnostics(doc.uri)
        .map(d => `  Line ${d.range.start.line + 1}: [${severityLabel(d.severity)}] ${d.message}`)
        .join('\n');
    return {
        fileName: doc.fileName,
        language: doc.languageId,
        selection: selected,
        prefix,
        suffix,
        diagnostics: diags,
    };
}
/** Format context into a prompt header block */
function formatContextBlock(ctx) {
    const parts = [
        `File: ${ctx.fileName}`,
        `Language: ${ctx.language}`,
    ];
    if (ctx.selection.trim()) {
        parts.push(`\nSelected code:\n\`\`\`${ctx.language}\n${ctx.selection}\n\`\`\``);
    }
    else {
        parts.push(`\nCode before cursor:\n\`\`\`${ctx.language}\n${ctx.prefix}\n\`\`\``, `\nCode after cursor:\n\`\`\`${ctx.language}\n${ctx.suffix}\n\`\`\``);
    }
    if (ctx.diagnostics) {
        parts.push(`\nActive diagnostics:\n${ctx.diagnostics}`);
    }
    return parts.join('\n');
}
function severityLabel(s) {
    switch (s) {
        case vscode.DiagnosticSeverity.Error: return 'ERROR';
        case vscode.DiagnosticSeverity.Warning: return 'WARN';
        case vscode.DiagnosticSeverity.Information: return 'INFO';
        default: return 'HINT';
    }
}
//# sourceMappingURL=collector.js.map