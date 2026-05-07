
import fs from 'fs';
import path from 'path';

const logFile = 'e:/Ai/ProseLabV2/proselab_outputs.md';
const outputDir = 'e:/Ai/ProseLabV2/proselab/src/editor';

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

const content = fs.readFileSync(logFile, 'utf-8');
const lines = content.split('\n');

const classMap = {
    'RichTextEditor': 'Editor.js',
    'HistoryManager': 'HistoryManager.js',
    'Toolbar': 'Toolbar.js',
    'SlashCommandMenu': 'SlashCommandMenu.js',
    'FloatingToolbar': 'FloatingToolbar.js',
    'LinkPopover': 'LinkPopover.js',
    'TableManager': 'TableManager.js',
    'MarkdownShortcuts': 'MarkdownShortcuts.js',
    'DragDropHandler': 'DragDropHandler.js',
    'ClipboardHandler': 'ClipboardHandler.js',
    'InlineMarkdown': 'InlineMarkdown.js'
};

const extractedClasses = {};

for (const className in classMap) {
    let lastIndex = -1;
    const pattern = new RegExp(`class ${className}\\s*{`);
    
    // Scan backwards to find the LATEST start of this class
    for (let i = lines.length - 1; i >= 0; i--) {
        if (pattern.test(lines[i])) {
            lastIndex = i;
            break;
        }
    }
    
    if (lastIndex !== -1) {
        console.log(`Found latest ${className} at line ${lastIndex + 1}`);
        
        let classCode = '';
        
        // Find the start of the code block containing this class
        let blockStart = -1;
        for (let i = lastIndex; i >= 0; i--) {
            if (lines[i].trim() === '```js') {
                blockStart = i + 1;
                break;
            }
        }
        
        if (blockStart !== -1) {
            // Read initial block
            let currentLine = blockStart;
            while (currentLine < lines.length) {
                if (lines[currentLine].trim() === '```') break;
                classCode += lines[currentLine] + '\n';
                currentLine++;
            }
            
            // Search for "Continuing from..." blocks FOR THIS CLASS ONLY
            let searchStart = currentLine + 1;
            while (searchStart < lines.length) {
                let nextHeader = -1;
                for (let i = searchStart; i < Math.min(searchStart + 200, lines.length); i++) {
                    if (lines[i].includes('Continuing from') && lines[i].includes(className)) {
                        nextHeader = i;
                        break;
                    }
                }
                
                if (nextHeader !== -1) {
                    let nextBlockStart = -1;
                    for (let i = nextHeader; i < Math.min(nextHeader + 20, lines.length); i++) {
                        if (lines[i].trim() === '```js') {
                            nextBlockStart = i + 1;
                            break;
                        }
                    }
                    
                    if (nextBlockStart !== -1) {
                        currentLine = nextBlockStart;
                        while (currentLine < lines.length) {
                            if (lines[currentLine].trim() === '```') break;
                            classCode += lines[currentLine] + '\n';
                            currentLine++;
                        }
                        searchStart = currentLine + 1;
                    } else {
                        searchStart = nextHeader + 1;
                    }
                } else {
                    // Check if we just missed it or if there are no more
                    searchStart += 200;
                }
            }
            
            extractedClasses[className] = classCode;
        }
    }
}

for (const className in extractedClasses) {
    const fileName = classMap[className];
    const filePath = path.join(outputDir, fileName);
    let finalCode = extractedClasses[className];
    
    if (!finalCode.trim().startsWith('export')) {
        finalCode = 'export ' + finalCode;
    }
    
    // Handle imports
    const imports = [];
    if (className === 'RichTextEditor') {
        for (const otherClass in classMap) {
            if (otherClass !== 'RichTextEditor') {
                imports.push(`import { ${otherClass} } from './${classMap[otherClass]}';`);
            }
        }
    }
    
    finalCode = imports.join('\n') + '\n\n' + finalCode;
    
    fs.writeFileSync(filePath, finalCode);
    console.log(`Wrote ${filePath}`);
}
