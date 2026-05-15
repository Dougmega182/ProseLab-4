"use strict";
/**
 * inlineCompletion.ts
 * Ghost-text completions — debounced, cancellation-aware
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
exports.GalaxyInlineCompletionProvider = void 0;
const vscode = __importStar(require("vscode"));
const galaxyClient_1 = require("../api/galaxyClient");
const collector_1 = require("../context/collector");
const DEBOUNCE_MS = 600;
class GalaxyInlineCompletionProvider {
    async provideInlineCompletionItems(document, position, _context, token) {
        // Check setting before doing anything
        const cfg = vscode.workspace.getConfiguration('galaxy');
        if (!cfg.get('inlineCompletions')) {
            return;
        }
        // Debounce
        await new Promise((resolve) => {
            if (this.lastTimer) {
                clearTimeout(this.lastTimer);
            }
            this.lastTimer = setTimeout(resolve, DEBOUNCE_MS);
        });
        if (token.isCancellationRequested) {
            return;
        }
        const ctx = (0, collector_1.getEditorContext)(30);
        if (!ctx) {
            return;
        }
        // Only complete if the line has meaningful content
        const currentLine = document.lineAt(position.line).text.trim();
        if (currentLine.length < 2) {
            return;
        }
        try {
            const { maxTurns } = (0, galaxyClient_1.getConfig)();
            const prompt = (0, galaxyClient_1.buildPrompt)([], [
                `You are a code completion engine. Complete the code exactly where it left off.`,
                `Return ONLY the completion text — no explanation, no markdown, no backticks.`,
                `\nFile: ${ctx.fileName} (${ctx.language})`,
                `\nCode prefix:\n${ctx.prefix}`,
                `\nCode suffix (for context):\n${ctx.suffix}`,
                `\nReturn the completion that goes between prefix and suffix.`,
            ].join('\n'), maxTurns);
            const result = await (0, galaxyClient_1.runWorkflow)(prompt, undefined, token);
            if (!result || token.isCancellationRequested) {
                return;
            }
            return new vscode.InlineCompletionList([
                new vscode.InlineCompletionItem(result.trim(), new vscode.Range(position, position))
            ]);
        }
        catch {
            // Silent fail — inline completions should never throw to the user
            return;
        }
    }
}
exports.GalaxyInlineCompletionProvider = GalaxyInlineCompletionProvider;
//# sourceMappingURL=inlineCompletion.js.map