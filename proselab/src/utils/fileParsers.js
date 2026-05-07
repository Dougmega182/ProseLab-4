/**
 * fileParsers.js - Utilities for parsing different file formats into text
 */

export async function parseFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  
  switch (ext) {
    case 'txt':
    case 'md':
    case 'markdown':
      return await readAsText(file);
    
    case 'rtf':
      return await parseRTF(file);
    
    case 'json':
      return await parseJSON(file);
    
    case 'docx':
      return await parseDocx(file);
    
    default:
      // Try reading as text
      try {
        return await readAsText(file);
      } catch {
        throw new Error(`Unsupported file format: .${ext}`);
      }
  }
}

function readAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsText(file);
  });
}

function readAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsArrayBuffer(file);
  });
}

async function parseRTF(file) {
  const text = await readAsText(file);
  // Basic RTF stripping - remove RTF control words and groups
  return text
    .replace(/\{\\[^{}]*\}/g, '') // Remove groups like {\fonttbl...}
    .replace(/\\[a-z]+\d*\s?/gi, '') // Remove control words like \par \b0
    .replace(/[{}]/g, '') // Remove remaining braces
    .replace(/\\\\/g, '\\') // Unescape backslashes
    .replace(/\\'([0-9a-f]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16))) // Hex chars
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function parseJSON(file) {
  const text = await readAsText(file);
  try {
    const data = JSON.parse(text);
    // If it's a structured document, try to extract meaningful text
    if (typeof data === 'string') return data;
    if (data.content) return typeof data.content === 'string' ? data.content : JSON.stringify(data.content, null, 2);
    if (data.text) return data.text;
    if (data.chapters && Array.isArray(data.chapters)) {
      return data.chapters.map((ch, i) => {
        const title = ch.title || `Chapter ${i + 1}`;
        const content = ch.content || ch.text || '';
        return `## ${title}\n\n${content}`;
      }).join('\n\n---\n\n');
    }
    // Fallback: pretty-print the JSON
    return JSON.stringify(data, null, 2);
  } catch {
    return text; // Return raw text if JSON parsing fails
  }
}

async function parseDocx(file) {
  const buffer = await readAsArrayBuffer(file);
  
  try {
    // Note: JSZip is used if available globally. 
    // In this environment, we fallback to a rough manual extraction.
    if (typeof JSZip !== 'undefined') {
      const zip = await JSZip.loadAsync(buffer);
      const documentXml = await zip.file('word/document.xml').async('string');
      return extractTextFromDocumentXml(documentXml);
    }
    
    // Fallback: try to find text content in the raw bytes
    const uint8 = new Uint8Array(buffer);
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const raw = decoder.decode(uint8);
    
    const xmlStart = raw.indexOf('<w:document');
    const xmlEnd = raw.indexOf('</w:document>');
    
    if (xmlStart !== -1 && xmlEnd !== -1) {
      const xml = raw.substring(xmlStart, xmlEnd + '</w:document>'.length);
      return extractTextFromDocumentXml(xml);
    }
    
    throw new Error('Could not parse DOCX file. Consider converting to .txt or .md first.');
  } catch (err) {
    if (err.message.includes('Could not parse')) throw err;
    throw new Error('Failed to parse DOCX file. Please convert to .txt or .md format.');
  }
}

function extractTextFromDocumentXml(xml) {
  const paragraphs = [];
  const paraPattern = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  let paraMatch;
  
  while ((paraMatch = paraPattern.exec(xml)) !== null) {
    const paraXml = paraMatch[0];
    const texts = [];
    const textPattern = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
    let textMatch;
    
    while ((textMatch = textPattern.exec(paraXml)) !== null) {
      texts.push(textMatch[1]);
    }
    
    if (texts.length > 0) {
      const styleMatch = paraXml.match(/<w:pStyle\s+w:val="([^"]+)"/);
      const style = styleMatch ? styleMatch[1] : '';
      let line = texts.join('');
      if (style.startsWith('Heading') || style.startsWith('heading')) {
        const level = parseInt(style.replace(/\D/g, '')) || 1;
        line = '#'.repeat(Math.min(level, 6)) + ' ' + line;
      }
      paragraphs.push(line);
    } else {
      paragraphs.push('');
    }
  }
  
  return paragraphs.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function estimateFileStats(text) {
  const words = text.split(/\s+/).filter(w => w.length > 0).length;
  const lines = text.split('\n').length;
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;
  const headings = (text.match(/^#{1,6}\s+.+$/gm) || []).length;
  const dialogueLines = (text.match(/[""].+?[""]|['''].+?[''']/g) || []).length;
  
  return {
    words,
    lines,
    paragraphs,
    headings,
    dialogueLines,
    estimatedPages: Math.ceil(words / 250),
    estimatedReadingMinutes: Math.ceil(words / 200)
  };
}

export function validateFileSize(file, maxSizeMB = 10) {
  const sizeMB = file.size / (1024 * 1024);
  if (sizeMB > maxSizeMB) {
    throw new Error(`File ${file.name} is ${sizeMB.toFixed(1)}MB, exceeding the ${maxSizeMB}MB limit.`);
  }
  return true;
}

export function validateFileType(file) {
  const allowedExtensions = ['txt', 'md', 'markdown', 'rtf', 'docx', 'json'];
  const ext = file.name.split('.').pop().toLowerCase();
  if (!allowedExtensions.includes(ext)) {
    throw new Error(`File type .${ext} is not supported. Supported types: ${allowedExtensions.join(', ')}`);
  }
  return true;
}
