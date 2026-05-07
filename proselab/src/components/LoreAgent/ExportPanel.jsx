// src/components/LoreAgent/ExportPanel.jsx

import React, { useState } from 'react';

export default function ExportPanel({ agent }) {
  const [format, setFormat] = useState('json');
  const [includeOptions, setIncludeOptions] = useState({
    entities: true,
    relationships: true,
    contexts: true,
    metadata: true,
  });
  const [importText, setImportText] = useState('');
  const [status, setStatus] = useState(null);

  const handleExport = () => {
    try {
      let data;
      const state = agent.exportState();

      if (!includeOptions.contexts) {
        state.entities = state.entities.map(e => ({ ...e, contexts: undefined }));
      }
      if (!includeOptions.relationships) {
        state.relationships = [];
      }
      if (!includeOptions.metadata) {
        state.entities = state.entities.map(e => ({
          ...e,
          firstSeen: undefined,
          lastSeen: undefined,
        }));
      }

      switch (format) {
        case 'json':
          data = JSON.stringify(state, null, 2);
          downloadFile(data, 'lore-export.json', 'application/json');
          break;
        case 'markdown':
          data = exportAsMarkdown(state);
          downloadFile(data, 'lore-export.md', 'text/markdown');
          break;
        case 'csv':
          data = exportAsCSV(state);
          downloadFile(data, 'lore-entities.csv', 'text/csv');
          break;
        case 'graphml':
          data = exportAsGraphML(state);
          downloadFile(data, 'lore-graph.graphml', 'application/xml');
          break;
        default:
          break;
      }
      setStatus({ type: 'success', message: `Exported as ${format.toUpperCase()}` });
    } catch (err) {
      setStatus({ type: 'error', message: `Export failed: ${err.message}` });
    }
  };

  const handleImport = () => {
    try {
      const data = JSON.parse(importText);
      agent.importState(data);
      setImportText('');
      setStatus({ type: 'success', message: 'Import successful!' });
    } catch (err) {
      setStatus({ type: 'error', message: `Import failed: ${err.message}` });
    }
  };

  const handleFileImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        agent.importState(data);
        setStatus({ type: 'success', message: `Imported from ${file.name}` });
      } catch (err) {
        setStatus({ type: 'error', message: `Import failed: ${err.message}` });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="export-panel">
      <div className="export-section-container">
        <h3>Export</h3>
        <div className="format-selector">
          {['json', 'markdown', 'csv', 'graphml'].map(f => (
            <button
              key={f}
              className={`format-btn ${format === f ? 'active' : ''}`}
              onClick={() => setFormat(f)}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="export-options">
          {Object.entries(includeOptions).map(([key, value]) => (
            <label key={key} className="checkbox-label">
              <input
                type="checkbox"
                checked={value}
                onChange={e => setIncludeOptions(prev => ({ ...prev, [key]: e.target.checked }))}
              />
              Include {key}
            </label>
          ))}
        </div>

        <button className="export-btn" onClick={handleExport}>
          📥 Export
        </button>
      </div>

      <div className="import-section-container">
        <h3>Import</h3>
        <div className="import-file">
          <label className="file-label">
            📁 Import from file
            <input type="file" accept=".json" onChange={handleFileImport} hidden />
          </label>
        </div>
        <div className="import-paste">
          <textarea
            value={importText}
            onChange={e => setImportText(e.target.value)}
            placeholder="Or paste JSON data here..."
            rows={6}
          />
          <button onClick={handleImport} disabled={!importText.trim()}>
            Import
          </button>
        </div>
      </div>

      {status && (
        <div className={`status-message ${status.type}`}>
          {status.message}
        </div>
      )}
    </div>
  );
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportAsMarkdown(state) {
  let md = '# Lore Export\n\n';

  const grouped = {};
  for (const entity of state.entities) {
    const type = entity.type || 'unknown';
    if (!grouped[type]) grouped[type] = [];
    grouped[type].push(entity);
  }

  for (const [type, entities] of Object.entries(grouped)) {
    md += `## ${type.charAt(0).toUpperCase() + type.slice(1)}s\n\n`;
    for (const entity of entities) {
      md += `### ${entity.name}\n`;
      md += `- **Confidence:** ${(entity.confidence * 100).toFixed(0)}%\n`;
      md += `- **Verified:** ${entity.verified ? 'Yes' : 'No'}\n`;
      if (entity.aliases?.length) {
        md += `- **Aliases:** ${entity.aliases.join(', ')}\n`;
      }
      if (entity.attributes) {
        for (const [key, value] of Object.entries(entity.attributes)) {
          md += `- **${key}:** ${value}\n`;
        }
      }
      if (entity.contexts?.length) {
        md += `\n**Contexts:**\n`;
        for (const ctx of entity.contexts.slice(-3)) {
          md += `> ${ctx}\n\n`;
        }
      }
      md += '\n';
    }
  }

  if (state.relationships?.length) {
    md += '## Relationships\n\n';
    md += '| Source | Relationship | Target | Confidence |\n';
    md += '|--------|-------------|--------|------------|\n';
    for (const rel of state.relationships) {
      const source = state.entities.find(e => e.id === rel.sourceId);
      const target = state.entities.find(e => e.id === rel.targetId);
      md += `| ${source?.name || rel.sourceId} | ${rel.type} | ${target?.name || rel.targetId} | ${(rel.confidence * 100).toFixed(0)}% |\n`;
    }
  }

  return md;
}

function exportAsCSV(state) {
  const headers = ['id', 'name', 'type', 'confidence', 'verified', 'aliases', 'mentions'];
  let csv = headers.join(',') + '\n';

  for (const entity of state.entities) {
    const row = [
      entity.id,
      `"${(entity.name || '').replace(/"/g, '""')}"`,
      entity.type,
      entity.confidence,
      entity.verified,
      `"${(entity.aliases || []).join('; ')}"`,
      entity.mentions || 0,
    ];
    csv += row.join(',') + '\n';
  }

  return csv;
}

function exportAsGraphML(state) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<graphml xmlns="http://graphml.graphstruct.org/graphml">\n';
  xml += '  <key id="name" for="node" attr.name="name" attr.type="string"/>\n';
  xml += '  <key id="type" for="node" attr.name="type" attr.type="string"/>\n';
  xml += '  <key id="confidence" for="node" attr.name="confidence" attr.type="double"/>\n';
  xml += '  <key id="reltype" for="edge" attr.name="type" attr.type="string"/>\n';
  xml += '  <graph id="lore" edgedefault="directed">\n';

  for (const entity of state.entities) {
    xml += `    <node id="${entity.id}">\n`;
    xml += `      <data key="name">${escapeXml(entity.name)}</data>\n`;
    xml += `      <data key="type">${entity.type}</data>\n`;
    xml += `      <data key="confidence">${entity.confidence}</data>\n`;
    xml += `    </node>\n`;
  }

  for (const rel of (state.relationships || [])) {
    xml += `    <edge source="${rel.sourceId}" target="${rel.targetId}">\n`;
    xml += `      <data key="reltype">${escapeXml(rel.type)}</data>\n`;
    xml += `    </edge>\n`;
  }

  xml += '  </graph>\n</graphml>';
  return xml;
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
