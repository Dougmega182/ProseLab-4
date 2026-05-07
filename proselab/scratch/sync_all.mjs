
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const logFile = 'e:/Ai/ProseLabV2/proselab_outputs.md';
const baseDir = 'e:/Ai/ProseLabV2/proselab';

async function syncAll() {
    const mappings = [
        { className: 'RichTextEditor', fileName: 'src/editor/Editor.js', pattern: /class RichTextEditor\s*{/ },
        { className: 'HistoryManager', fileName: 'src/editor/HistoryManager.js', pattern: /class HistoryManager\s*{/ },
        { className: 'Toolbar', fileName: 'src/editor/Toolbar.js', pattern: /class Toolbar\s*{/ },
        { className: 'FloatingToolbar', fileName: 'src/editor/FloatingToolbar.js', pattern: /class FloatingToolbar\s*{/ },
        { className: 'SlashCommandMenu', fileName: 'src/editor/SlashCommandMenu.js', pattern: /class SlashCommandMenu\s*{/ },
        { className: 'LinkPopover', fileName: 'src/editor/LinkPopover.js', pattern: /class LinkPopover\s*{/ },
        { className: 'TableManager', fileName: 'src/editor/TableManager.js', pattern: /class TableManager\s*{/ },
        { className: 'MarkdownShortcuts', fileName: 'src/editor/MarkdownShortcuts.js', pattern: /class MarkdownShortcuts\s*{/ },
        { className: 'DragDropHandler', fileName: 'src/editor/DragDropHandler.js', pattern: /class DragDropHandler\s*{/ },
        { className: 'ClipboardHandler', fileName: 'src/editor/ClipboardHandler.js', pattern: /class ClipboardHandler\s*{/ },
        { className: 'InlineMarkdown', fileName: 'src/editor/InlineMarkdown.js', pattern: /class InlineMarkdown\s*{/ },
        { className: 'Component', fileName: 'src/ui/component.js', pattern: /export class Component\s*{/ },
        { className: 'App', fileName: 'src/ui/App.js', pattern: /export class App extends Component\s*{/ },
        { className: 'EditorView', fileName: 'src/ui/views/EditorView.js', pattern: /export class EditorView extends Component\s*{/ },
        { className: 'Sidebar', fileName: 'src/ui/components/Sidebar.js', pattern: /export class Sidebar extends Component\s*{/ },
        { className: 'StatusBar', fileName: 'src/ui/components/StatusBar.js', pattern: /export class StatusBar extends Component\s*{/ },
        { className: 'AIPanel', fileName: 'src/ui/components/AIPanel.js', pattern: /export class AIPanel extends Component\s*{/ },
        { className: 'Dashboard', fileName: 'src/ui/components/Dashboard.js', pattern: /export class Dashboard extends Component\s*{/ },
        { className: 'FindReplace', fileName: 'src/ui/components/FindReplace.js', pattern: /export class FindReplace extends Component\s*{/ },
        { className: 'CommandPalette', fileName: 'src/ui/components/CommandPalette.js', pattern: /export class CommandPalette extends Component\s*{/ },
        { className: 'ThemeManager', fileName: 'src/ui/themeManager.js', pattern: /class ThemeManager\s*{/ }
    ];

    const results = {};

    // First pass: find the LAST line number for each class
    const rl = readline.createInterface({
        input: fs.createReadStream(logFile),
        terminal: false
    });

    let lineCount = 0;
    for await (const line of rl) {
        lineCount++;
        for (const m of mappings) {
            if (m.pattern.test(line)) {
                results[m.className] = { startLine: lineCount, mapping: m };
            }
        }
    }

    // Second pass: extract the content
    const allLines = fs.readFileSync(logFile, 'utf-8').split(/\r?\n/);
    
    for (const className in results) {
        const { startLine, mapping } = results[className];
        console.log(`Extracting ${className} starting at line ${startLine}`);
        
        let code = '';
        let currentIdx = startLine - 1;
        
        // Find block start
        let blockStart = -1;
        for (let i = currentIdx; i >= 0; i--) {
            if (allLines[i].trim() === '```js' || allLines[i].trim() === '```jsx') {
                blockStart = i + 1;
                break;
            }
        }
        
        if (blockStart !== -1) {
            let i = blockStart;
            while (i < allLines.length) {
                if (allLines[i].trim() === '```') break;
                code += allLines[i] + '\n';
                i++;
            }
            
            // Incremental extraction
            let searchIdx = i + 1;
            while (searchIdx < allLines.length) {
                let nextHeader = -1;
                for (let j = searchIdx; j < Math.min(searchIdx + 300, allLines.length); j++) {
                    if (allLines[j].includes('Continuing from') && allLines[j].includes(className)) {
                        nextHeader = j;
                        break;
                    }
                }
                
                if (nextHeader !== -1) {
                    let nextBlockStart = -1;
                    for (let j = nextHeader; j < Math.min(nextHeader + 30, allLines.length); j++) {
                        if (allLines[j].trim() === '```js' || allLines[j].trim() === '```jsx') {
                            nextBlockStart = j + 1;
                            break;
                        }
                    }
                    
                    if (nextBlockStart !== -1) {
                        let j = nextBlockStart;
                        while (j < allLines.length) {
                            if (allLines[j].trim() === '```') break;
                            code += allLines[j] + '\n';
                            j++;
                        }
                        searchIdx = j + 1;
                    } else {
                        searchIdx = nextHeader + 1;
                    }
                } else {
                    searchIdx += 300;
                }
            }
            
            const filePath = path.join(baseDir, mapping.fileName);
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            
            if (mapping.fileName.startsWith('src/editor/') && !code.trim().startsWith('export')) {
                code = 'export ' + code;
            }
            
            if (mapping.className === 'RichTextEditor' && mapping.fileName === 'src/editor/Editor.js') {
                const imports = mappings
                    .filter(x => x.fileName.startsWith('src/editor/') && x.className !== 'RichTextEditor')
                    .map(x => `import { ${x.className} } from './${path.basename(x.fileName)}';`);
                code = imports.join('\n') + '\n\n' + code;
            }
            
            fs.writeFileSync(filePath, code);
            console.log(`Wrote ${filePath}`);
        }
    }
}

syncAll().catch(console.error);
