import fs from 'fs';
import path from 'path';

const logFile = 'e:/Ai/ProseLabV2/proselab_outputs.md';
const baseDir = 'e:/Ai/ProseLabV2/proselab';

// Markers built via concatenation to avoid parser issues
const TH_O = '\x3Cthinking\x3E';
const TH_C = '\x3C/thinking\x3E';
const UM = '\x2A\x2AUSER:\x2A\x2A';
const AM = '\x2A\x2AAI:\x2A\x2A';

const mappings = [
    { className: 'RichTextEditor', fileName: 'src/ui/components/TextEditor.js', rename: 'TextEditor' },
    { className: 'HistoryManager', fileName: 'src/editor/HistoryManager.js' },
    { className: 'Toolbar', fileName: 'src/ui/components/Toolbar.js' },
    { className: 'InlineFormatPopover', fileName: 'src/editor/InlineFormatPopover.js' },
    { className: 'FloatingToolbar', fileName: 'src/editor/FloatingToolbar.js' },
    { className: 'SlashCommandMenu', fileName: 'src/editor/SlashCommandMenu.js' },
    { className: 'LinkPopover', fileName: 'src/editor/LinkPopover.js' },
    { className: 'TableManager', fileName: 'src/editor/TableManager.js' },
    { className: 'MarkdownShortcuts', fileName: 'src/editor/MarkdownShortcuts.js' },
    { className: 'DragDropHandler', fileName: 'src/editor/DragDropHandler.js' },
    { className: 'ClipboardHandler', fileName: 'src/editor/ClipboardHandler.js' },
    { className: 'InlineMarkdown', fileName: 'src/editor/InlineMarkdown.js' },
    { className: 'ImageHandler', fileName: 'src/editor/ImageHandler.js' },
    { className: 'UndoManager', fileName: 'src/editor/UndoManager.js' },
    { className: 'Component', fileName: 'src/ui/Component.js' },
    { className: 'App', fileName: 'src/ui/App.js' },
    { className: 'EditorView', fileName: 'src/ui/views/EditorView.js' },
    { className: 'Sidebar', fileName: 'src/ui/components/Sidebar.js' },
    { className: 'StatusBar', fileName: 'src/ui/components/StatusBar.js' },
    { className: 'AIPanel', fileName: 'src/ui/components/AIPanel.js' },
    { className: 'Dashboard', fileName: 'src/ui/components/Dashboard.js' },
    { className: 'FindReplace', fileName: 'src/ui/components/FindReplace.js' },
    { className: 'CommandPalette', fileName: 'src/ui/components/CommandPalette.js' },
    { className: 'ThemeManager', fileName: 'src/ui/ThemeManager.js' }
];

const names = mappings.map(m => m.className);
const allStrictPatterns = names.map(n => new RegExp(`(?:export\\s+)?class\\s+${n}(?:\\s+extends\\s+\\w+)?\\s*\\{`));

function isMetadata(line) {
    const t = line.trim();
    if (!t) return false;
    if (/^-{3,}$/.test(t)) return true;
    if (t.startsWith('## [')) return true;
    if (t.startsWith(UM) || t.startsWith(AM)) return true;
    if (t === TH_O || t === TH_C) return true;
    if (t.toLowerCase().includes('continuing from')) return true;
    if (t.toLowerCase().includes('resuming from')) return true;
    if (t.startsWith('```js')) return true;
    if (t.startsWith('```jsx')) return true;
    if (t === '```') return true;
    return false;
}

function extract() {
    console.log('Reading log file...');
    const content = fs.readFileSync(logFile, 'utf-8');
    const lines = content.split(/\r?\n/);

    const blocks = [];
    let currentBlock = null;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('```js') || line.startsWith('```jsx')) {
            let context = '';
            for (let j = Math.max(0, i - 15); j < i; j++) {
                context += lines[j] + '\n';
            }
            currentBlock = {
                startLine: i,
                content: [],
                context: context
            };
        } else if (line.trim() === '```' && currentBlock) {
            blocks.push(currentBlock);
            currentBlock = null;
        } else if ((line.startsWith('---') || line.startsWith('## ')) && currentBlock) {
            blocks.push(currentBlock);
            currentBlock = null;
        } else if (currentBlock) {
            currentBlock.content.push(line);
        }
    }
    if (currentBlock) blocks.push(currentBlock);

    console.log(`Found ${blocks.length} code blocks.`);

    for (const m of mappings) {
        console.log(`Processing ${m.className}...`);
        
        const candidateIndices = [];
        const strictPattern = new RegExp(`(?:export\\s+)?class\\s+${m.className}(?:\\s+extends\\s+\\w+)?\\s*\\{`);
        
        for (let i = 0; i < blocks.length; i++) {
            if (blocks[i].content.some(l => strictPattern.test(l))) {
                candidateIndices.push(i);
            }
        }

        if (candidateIndices.length === 0) {
            console.warn(`Could not find any blocks for ${m.className}`);
            continue;
        }

        let bestResult = { startIdx: -1, codeLines: [], length: -1 };
        
        for (const startIdx of candidateIndices) {
            const foundLineIdx = blocks[startIdx].content.findIndex(l => strictPattern.test(l));
            let currentCodeLines = blocks[startIdx].content.slice(foundLineIdx).filter(l => !isMetadata(l));
            
            // Check if block contains another class definition (stop there)
            let stopInStartBlock = -1;
            for (let j = 1; j < currentCodeLines.length; j++) {
                if (allStrictPatterns.some(p => p.test(currentCodeLines[j]))) {
                    stopInStartBlock = j;
                    break;
                }
            }
            if (stopInStartBlock !== -1) {
                currentCodeLines = currentCodeLines.slice(0, stopInStartBlock);
            } else {
                // Try to find continuation blocks
                let currentIdx = startIdx + 1;
                while (currentIdx < blocks.length) {
                    const ctx = blocks[currentIdx].context.toLowerCase();
                    const isCont = (ctx.includes('continue') || ctx.includes('continuing') || ctx.includes('next part') || ctx.includes('resuming') || ctx.includes('resumes'));

                    if (isCont) {
                        const newLines = blocks[currentIdx].content.filter(l => !isMetadata(l));
                        if (newLines.length === 0) { currentIdx++; continue; }

                        let stopInContBlock = -1;
                        for (let j = 0; j < newLines.length; j++) {
                            if (allStrictPatterns.some(p => p.test(newLines[j]))) {
                                stopInContBlock = j;
                                break;
                            }
                        }

                        let linesToAdd = stopInContBlock !== -1 ? newLines.slice(0, stopInContBlock) : newLines;

                        // Overlap detection
                        let overlapLen = 0;
                        for (let len = 1; len <= Math.min(currentCodeLines.length, linesToAdd.length, 50); len++) {
                            let match = true;
                            for (let j = 0; j < len; j++) {
                                if (currentCodeLines[currentCodeLines.length - len + j].trim() !== linesToAdd[j].trim()) {
                                    match = false;
                                    break;
                                }
                            }
                            if (match) overlapLen = len;
                        }
                        
                        if (overlapLen > 0) {
                            currentCodeLines.push(...linesToAdd.slice(overlapLen));
                        } else {
                            if (currentCodeLines.length > 0 && linesToAdd.length > 0) {
                                let lastLineIdx = currentCodeLines.length - 1;
                                while (lastLineIdx >= 0 && currentCodeLines[lastLineIdx].trim() === '') lastLineIdx--;
                                
                                if (lastLineIdx >= 0) {
                                    const lastTrim = currentCodeLines[lastLineIdx].trim();
                                    const firstTrim = linesToAdd[0].trim();

                                    if (firstTrim.startsWith(lastTrim) && lastTrim.length > 3) {
                                         currentCodeLines[lastLineIdx] = linesToAdd[0];
                                         currentCodeLines.push(...linesToAdd.slice(1));
                                    } else if (lastTrim !== '' && !/[;{}()[\]]/.test(lastTrim.slice(-1))) {
                                         currentCodeLines[lastLineIdx] = currentCodeLines[lastLineIdx] + linesToAdd[0];
                                         currentCodeLines.push(...linesToAdd.slice(1));
                                    } else {
                                        currentCodeLines.push(...linesToAdd);
                                    }
                                } else {
                                    currentCodeLines.push(...linesToAdd);
                                }
                            } else {
                                currentCodeLines.push(...linesToAdd);
                            }
                        }
                        if (stopInContBlock !== -1) break;
                        currentIdx++;
                    } else {
                        break;
                    }
                }
            }
            
            const totalLen = currentCodeLines.join('\n').length;
            if (totalLen > bestResult.length) {
                bestResult = { startIdx, codeLines: currentCodeLines, length: totalLen };
            }
        }

        let fullCode = bestResult.codeLines.join('\n');
        if (m.rename) {
            fullCode = fullCode.replace('class ' + m.className, 'class ' + m.rename);
        }
        const exportName = m.rename || m.className;
        if (!fullCode.trim().startsWith('export') && !fullCode.trim().startsWith('import')) {
            fullCode = fullCode.replace('class ' + exportName, 'export class ' + exportName);
        }

        const filePath = path.join(baseDir, m.fileName);
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        fs.writeFileSync(filePath, fullCode + '\n');
        console.log(`  Wrote ${filePath} (${fullCode.length} bytes)`);
    }
}

extract();
console.log('Done!');