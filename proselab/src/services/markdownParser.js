/**
 * markdownParser.js - Utilities for parsing structured data from Markdown
 */

export function splitByH1(text) {
  const lines = text.split('\n');
  const sections = [];
  let current = null;

  for (const line of lines) {
    const h1Match = line.match(/^#\s+(.+)$/);
    if (h1Match) {
      if (current) sections.push(current);
      current = { heading: h1Match[1].trim(), content: '' };
    } else if (current) {
      current.content += line + '\n';
    } else if (line.trim()) {
        // Content before any H1
        current = { heading: 'Introduction', content: line + '\n' };
    }
  }
  if (current) sections.push(current);
  return sections;
}

export function splitByH2(text) {
  const lines = text.split('\n');
  const sections = [];
  let current = null;

  for (const line of lines) {
    const h2Match = line.match(/^##\s+(.+)$/);
    if (h2Match) {
      if (current) sections.push(current);
      current = { heading: h2Match[1].trim(), content: '' };
    } else if (current) {
      current.content += line + '\n';
    }
  }
  if (current) sections.push(current);
  return sections;
}

/**
 * Extracts YAML-like metadata from a block of text
 * e.g. - **POV:** Margaret or **Key:** Value
 */
export function extractMetadata(text) {
  const metadata = {};
  const lines = text.split('\n');
  
  for (const line of lines) {
    const match = line.match(/[-*]*\s*\*\*(.+?)\*\*[:\s]+(.+)/);
    if (match) {
      const key = match[1].trim().toLowerCase();
      const value = match[2].trim();
      metadata[key] = value;
    }
  }
  
  return metadata;
}

export function extractMetadataLines(text) {
  // Parse lines like "- **Key:** Value" or "**Key:** Value"
  const metadata = {};
  const lines = text.split('\n');
  for (const line of lines) {
    const match = line.match(/[-*]*\s*\*\*(.+?)\*\*[:\s]+(.+)/);
    if (match) {
      const key = match[1].trim().toLowerCase();
      const value = match[2].trim();
      metadata[key] = value;
    }
  }
  return metadata;
}

export function detectSceneBreaks(text) {
  // Common scene break patterns
  return text.split(/\n(?:---|\*\*\*|\* \* \*|~~~)\n/);
}

export function estimateWordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Extracts a specific section by its H2 heading
 */
export function extractSection(text, headingName) {
    const sections = splitByH2(text);
    const found = sections.find(s => s.heading.toLowerCase().includes(headingName.toLowerCase()));
    return found ? found.content.trim() : null;
}
