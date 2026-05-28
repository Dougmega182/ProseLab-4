import React from 'react';

export default function AnnotationRail({ findings, onHighlight, onClear }) {
  if (!findings || findings.length === 0) return null;

  return (
    <div className="annotation-rail" style={{ width: '280px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', paddingLeft: '16px', borderLeft: '1px dashed var(--border-subtle)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h4 style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>Findings ({findings.length})</h4>
        {onClear && (
          <button className="btn btn-ghost" style={{ fontSize: '11px', padding: '2px 8px' }} onClick={onClear}>
            Clear
          </button>
        )}
      </div>
      
      {findings.map((f, i) => (
        <div 
          key={i} 
          className={`annotation-card annotation-${f.type}`} 
          style={{ 
            padding: '12px', 
            background: 'var(--bg-tertiary)', 
            borderRadius: '6px', 
            borderLeft: `3px solid var(--accent-primary)`,
            fontSize: '13px',
            cursor: 'pointer',
            transition: 'transform 0.2s ease, opacity 0.2s ease'
          }}
          onMouseEnter={() => onHighlight && onHighlight(f)}
          onMouseLeave={() => onHighlight && onHighlight(null)}
        >
          <div style={{ fontWeight: 600, marginBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ textTransform: 'capitalize' }}>{f.type.replace('-', ' ')}</span>
          </div>
          <div style={{ color: 'var(--text-secondary)' }}>
            "{f.match}"
          </div>
          {f.message && (
            <div style={{ marginTop: '8px', fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '12px' }}>
              {f.message}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
