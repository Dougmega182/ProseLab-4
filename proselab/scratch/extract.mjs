import fs from 'fs';
import path from 'path';

const logFile = 'e:/Ai/ProseLabV2/proselab_outputs.md';
const baseDir = 'e:/Ai/ProseLabV2/proselab';

// Markers built via hex escapes to avoid parser issues
const TH_O = '\x3Cthinking\x3E';
const TH_C = '\x3C/thinking\x3E';
const UM = '\x2A\x2AUSER:\x2A\x2A';
const AM = '\x2A\x2AAI:\x2A\x2A';

const mappings = [
    ['RichTextEditor', 'src/ui/components/TextEditor.js', 'TextEditor'],
    ['HistoryManager', 'src/editor/HistoryManager.js'],
    ['Toolbar', 'src/ui/components/Toolbar.js'],
    ['InlineFormatPopover', 'src/editor/InlineFormatPopover.js'],
    ['FloatingToolbar', 'src/editor/FloatingToolbar.js'],
    ['SlashCommandMenu', 'src/editor/SlashCommandMenu.js'],
    ['LinkPopover', 'src/editor/LinkPopover.js'],
    ['TableManager', 'src/editor/TableManager.js'],
    ['MarkdownShortcuts', 'src/editor/MarkdownShortcuts.js'],
    ['DragDropHandler', 'src/editor/DragDropHandler.js'],
    ['ClipboardHandler', 'src/editor/ClipboardHandler.js'],
    ['InlineMarkdown', 'src/editor/InlineMarkdown.js'],
    ['ImageHandler', 'src/editor/ImageHandler.js'],
    ['UndoManager', 'src/editor/UndoManager.js'],
    ['Component', 'src/ui/Component.js'],
    ['App', 'src/ui/App.js'],
    ['EditorView', 'src/ui/views/EditorView.js'],
    ['Sidebar', 'src/ui/components/Sidebar.js'],
    ['StatusBar', 'src/ui/components/StatusBar.js'],
    ['AIPanel', 'src/ui/components/AIPanel.js'],
    ['Dashboard', 'src/ui/components/Dashboard.js'],
    ['FindReplace', 'src/ui/components/FindReplace.js'],
    ['CommandPalette', 'src/ui/components/CommandPalette.js'],
    ['ThemeManager', 'src/ui/ThemeManager.js']
];

const names = mappings.map(m => m[0]);

function isMeta(line) {
    const t = line.trim();
    if (!t) return false; // FIXED: preserve empty lines
    if (/^-{3,}$/.test(t)) return true;
    if (t.startsWith('## [')) return true;
    if (t.startsWith(UM) || t.startsWith(AM)) return true;
    if (t === TH_O || t === TH_C) return true;
    if (/^```/.test(t)) return true;
    return false;
}

function findClass(line) {
    for (const n of names) {
        // IMPROVED: support export and extends
        const regex = new RegExp('(?:export\\s+)?class\\s+' + n + '(?:\\s+extends\\s+\\w+)?\\s*\\{');
        if (regex.test(line)) return n;
    }
    return null;
}

function extractBody(lines, start) {
    let depth = 0, began = false, body = [];
    for (let i = start; i < lines.length; i++) {
        const line = lines[i];
        if (isMeta(line)) {
            if (began && /^```/.test(line.trim())) break;
            continue;
        }
        for (const ch of line) {
            if (ch === '{') { depth++; began = true; }
            if (ch === '}') depth--;
        }
        body.push(line);
        if (began && depth <= 0) break;
    }
    return body;
}

const content = fs.readFileSync(logFile, 'utf-8');
const lines = content.split(/\r?\n/);
const classVersions = {};

for (let i = 0; i < lines.length; i++) {
    const cls = findClass(lines[i]);
    if (cls) {
        const body = extractBody(lines, i);
        if (body.length > 5) {
            classVersions[cls] = body.join('\n');
        }
    }
}

for (const [className, filePath, rename] of mappings) {
    if (!classVersions[className]) {
        console.log('SKIP: ' + className + ' not found');
        continue;
    }
    let code = classVersions[className];
    if (rename) {
        code = code.replace('class ' + className, 'class ' + rename);
    }
    const exportName = rename || className;
    if (!code.includes('export')) {
        code = code.replace('class ' + exportName, 'export class ' + exportName);
    }
    const fullPath = path.join(baseDir, filePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, code + '\n');
    console.log('WROTE: ' + fullPath + ' (' + code.split('\n').length + ' lines)');
}

console.log('Done!');
