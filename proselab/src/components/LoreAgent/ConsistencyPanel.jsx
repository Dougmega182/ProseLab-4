// src/components/LoreAgent/ConsistencyPanel.jsx

import React, { useMemo } from 'react';

const SEVERITY_COLORS = {
  error: '#E74C3C',
  warning: '#F39C12',
  info: '#3498DB',
};

const SEVERITY_LABELS = {
  error: 'Error',
  warning: 'Warning',
  info: 'Info',
};

export default function ConsistencyPanel({
  issues,
  entities,
  onDismiss,
  onAutoFix,
  onMerge,
}) {
  const severityCounts = useMemo(() => {
    return issues.reduce((acc, issue) => {
      const key = issue.severity || 'info';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [issues]);

  if (issues.length === 0) {
    return (
      <div className="consistency-panel empty-state">
        <p>No consistency issues detected.</p>
      </div>
    );
  }

  const groupedIssues = {};
  for (const issue of issues) {
    const type = issue.type || 'other';
    if (!groupedIssues[type]) groupedIssues[type] = [];
    groupedIssues[type].push(issue);
  }

  const sortedGroups = Object.entries(groupedIssues).sort(([, issuesA], [, issuesB]) => issuesB.length - issuesA.length);

  return (
    <div className="consistency-panel">
      <div className="issues-header">
        <div>
          <h3>{issues.length} issue{issues.length !== 1 ? 's' : ''} found</h3>
          <p className="issues-subtitle">Use this tab to review contradictions, low-confidence lore, and duplicate entities before trusting manuscript continuity.</p>
        </div>
        <button className="auto-fix-btn" onClick={onAutoFix}>
          Auto-Fix All
        </button>
      </div>

      <div className="lore-review-strip lore-review-strip--tight">
        <div className="lore-review-card issue-tone-error">
          <span>Errors</span>
          <strong>{severityCounts.error || 0}</strong>
        </div>
        <div className="lore-review-card issue-tone-warning">
          <span>Warnings</span>
          <strong>{severityCounts.warning || 0}</strong>
        </div>
        <div className="lore-review-card">
          <span>Info</span>
          <strong>{severityCounts.info || 0}</strong>
        </div>
      </div>

      {sortedGroups.map(([type, typeIssues]) => (
        <div key={type} className="issue-group">
          <h4 className="issue-group-title">{formatIssueType(type)} ({typeIssues.length})</h4>
          {typeIssues
            .slice()
            .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
            .map((issue) => {
              const involvedEntities = (issue.entityIds || [])
                .map((id) => entities.find((entity) => entity.id === id))
                .filter(Boolean);

              return (
                <div
                  key={issue.id}
                  className="issue-card"
                  style={{ borderLeftColor: SEVERITY_COLORS[issue.severity] || SEVERITY_COLORS.info }}
                >
                  <div className="issue-header">
                    <span
                      className="issue-severity"
                      style={{ color: SEVERITY_COLORS[issue.severity] || SEVERITY_COLORS.info }}
                    >
                      {SEVERITY_LABELS[issue.severity] || SEVERITY_LABELS.info}
                    </span>
                    <span className="issue-message">{issue.message}</span>
                  </div>

                  {issue.details && (
                    <div className="issue-details">{issue.details}</div>
                  )}

                  {involvedEntities.length > 0 && (
                    <div className="issue-entities">
                      {involvedEntities.map((entity) => (
                        <span key={entity.id} className="entity-chip" style={{ borderColor: getTypeColor(entity.type) }}>
                          {entity.name}
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

function severityRank(severity) {
  if (severity === 'error') return 3;
  if (severity === 'warning') return 2;
  return 1;
}
