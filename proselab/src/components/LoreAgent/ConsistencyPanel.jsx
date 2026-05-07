// src/components/LoreAgent/ConsistencyPanel.jsx

import React from 'react';

const SEVERITY_COLORS = {
  error: '#E74C3C',
  warning: '#F39C12',
  info: '#3498DB',
};

const SEVERITY_ICONS = {
  error: '⚠',
  warning: '⚡',
  info: 'ℹ',
};

export default function ConsistencyPanel({
  issues,
  entities,
  onDismiss,
  onAutoFix,
  onMerge,
}) {
  if (issues.length === 0) {
    return (
      <div className="consistency-panel empty-state">
        <p>✓ No consistency issues detected.</p>
      </div>
    );
  }

  const groupedIssues = {};
  for (const issue of issues) {
    const type = issue.type || 'other';
    if (!groupedIssues[type]) groupedIssues[type] = [];
    groupedIssues[type].push(issue);
  }

  return (
    <div className="consistency-panel">
      <div className="issues-header">
        <h3>{issues.length} Issue{issues.length !== 1 ? 's' : ''} Found</h3>
        <button className="auto-fix-btn" onClick={onAutoFix}>
          🔧 Auto-Fix All
        </button>
      </div>

      {Object.entries(groupedIssues).map(([type, typeIssues]) => (
        <div key={type} className="issue-group">
          <h4 className="issue-group-title">{formatIssueType(type)} ({typeIssues.length})</h4>
          {typeIssues.map(issue => {
            const involvedEntities = (issue.entityIds || [])
              .map(id => entities.find(e => e.id === id))
              .filter(Boolean);

            return (
              <div
                key={issue.id}
                className="issue-card"
                style={{ borderLeftColor: SEVERITY_COLORS[issue.severity] || SEVERITY_COLORS.info }}
              >
                <div className="issue-header">
                  <span className="issue-icon">
                    {SEVERITY_ICONS[issue.severity] || SEVERITY_ICONS.info}
                  </span>
                  <span className="issue-severity" style={{ color: SEVERITY_COLORS[issue.severity] }}>
                    {issue.severity?.toUpperCase()}
                  </span>
                  <span className="issue-message">{issue.message}</span>
                </div>

                {issue.details && (
                  <div className="issue-details">{issue.details}</div>
                )}

                {involvedEntities.length > 0 && (
                  <div className="issue-entities">
                    {involvedEntities.map(e => (
                      <span key={e.id} className="entity-chip" style={{ borderColor: getTypeColor(e.type) }}>
                        {e.name}
                      </span>
                    ))}
                  </div>
                )}

                <div className="issue-actions">
                  {issue.type === 'duplicate' && issue.entityIds?.length === 2 && (
                    <button
                      className="action-btn merge"
                      onClick={() => onMerge(issue.entityIds[0], issue.entityIds[1])}
                    >
                      Merge Entities
                    </button>
                  )}
                  {issue.suggestion && (
                    <button
                      className="action-btn fix"
                      onClick={() => onAutoFix(issue)}
                    >
                      Apply Fix
                    </button>
                  )}
                  <button
                    className="action-btn dismiss"
                    onClick={() => onDismiss(issue.id)}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function formatIssueType(type) {
  const labels = {
    duplicate: 'Potential Duplicates',
    contradiction: 'Contradictions',
    orphan: 'Orphaned Entities',
    low_confidence: 'Low Confidence',
    missing_info: 'Missing Information',
    other: 'Other Issues',
  };
  return labels[type] || type;
}

function getTypeColor(type) {
  const colors = {
    character: '#4A90D9',
    location: '#2ECC71',
    item: '#E67E22',
    event: '#9B59B6',
    faction: '#E74C3C',
    concept: '#1ABC9C',
    creature: '#F39C12',
    unknown: '#95A5A6',
  };
  return colors[type] || colors.unknown;
}
