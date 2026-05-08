// src/components/LoreAgent/LorePanel.jsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createLoreAgent } from '../../engine/lore/index.js';
import EntityList from './EntityList.jsx';
import RelationshipGraph from './RelationshipGraph.jsx';
import ConsistencyPanel from './ConsistencyPanel.jsx';
import LoreQuery from './LoreQuery.jsx';
import TimelineView from './TimelineView.jsx';
import './LoreAgent.css';

const TABS = {
  ENTITIES: 'entities',
  GRAPH: 'graph',
  ISSUES: 'issues',
  QUERY: 'query',
  TIMELINE: 'timeline',
  STATS: 'stats',
};

export default function LorePanel({ agent: externalAgent, text, onProcessText }) {
  const [localAgent] = useState(() => externalAgent || createLoreAgent());
  const agent = externalAgent || localAgent;
  
  const [activeTab, setActiveTab] = useState(TABS.ENTITIES);
  const [entities, setEntities] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [issues, setIssues] = useState([]);
  const [stats, setStats] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState(null);
  const [selectedEntity, setSelectedEntity] = useState(null);

  // Subscribe to store changes
  useEffect(() => {
    if (!agent) return;

    const store = agent.store;
    const unsubscribe = store.subscribe((event) => {
      setEntities([...store.entities]);
      setRelationships([...store.relationships]);
      setIssues([...store.issues]);
      setStats(agent.getStats());
    });

    // Initial load
    setEntities([...store.entities]);
    setRelationships([...store.relationships]);
    setIssues([...store.issues]);
    setStats(agent.getStats());

    return unsubscribe;
  }, [agent]);

  const handleProcess = useCallback(async () => {
    if (!text || !agent || processing) return;
    setProcessing(true);
    try {
      await agent.processText(text);
      if (onProcessText) onProcessText();
    } catch (err) {
      console.error('Lore processing error:', err);
    } finally {
      setProcessing(false);
    }
  }, [text, agent, processing, onProcessText]);

  const handleVerify = useCallback((entityId) => {
    if (agent) agent.verifyEntity(entityId);
  }, [agent]);

  const handleRemove = useCallback((entityId) => {
    if (agent) agent.removeEntity(entityId);
    if (selectedEntity?.id === entityId) setSelectedEntity(null);
  }, [agent, selectedEntity]);

  const handleDismissIssue = useCallback((issueId) => {
    if (agent) agent.dismissIssue(issueId);
  }, [agent]);

  const handleAutoFix = useCallback(() => {
    if (agent) agent.autoFix();
  }, [agent]);

  const handleMerge = useCallback((idA, idB) => {
    if (agent) agent.mergeEntitiesManual(idA, idB);
  }, [agent]);

  const handleUpdateEntity = useCallback((entityId, updates) => {
    if (agent) agent.updateEntity(entityId, updates);
  }, [agent]);

  const filteredEntities = useMemo(() => {
    let result = entities;
    if (typeFilter) {
      result = result.filter(e => e.type === typeFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(e =>
        e.name.toLowerCase().includes(q) ||
        (e.aliases && e.aliases.some(a => a.toLowerCase().includes(q)))
      );
    }
    return [...result].sort((a, b) => {
      const aNeedsReview = (!a.verified ? 1 : 0) + (a.confidence < 0.6 ? 1 : 0);
      const bNeedsReview = (!b.verified ? 1 : 0) + (b.confidence < 0.6 ? 1 : 0);
      if (bNeedsReview !== aNeedsReview) return bNeedsReview - aNeedsReview;
      return (b.mentions || 0) - (a.mentions || 0);
    });
  }, [entities, typeFilter, searchQuery]);

  const entityTypes = useMemo(() => {
    const types = {};
    for (const e of entities) {
      types[e.type] = (types[e.type] || 0) + 1;
    }
    return types;
  }, [entities]);

  const reviewStats = useMemo(() => {
    const severityCounts = issues.reduce((acc, issue) => {
      const key = issue.severity || 'info';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return {
      lowConfidenceEntities: entities.filter(entity => entity.confidence < 0.6).length,
      unverifiedEntities: entities.filter(entity => !entity.verified).length,
      timelineEvents: entities.filter(entity => entity.type === 'event').length,
      criticalIssues: (severityCounts.error || 0) + (severityCounts.warning || 0),
      severityCounts
    };
  }, [entities, issues]);

  return (
    <div className="lore-panel">
      <div className="lore-panel-header">
        <div className="lore-title-block">
          <h2>Lore Tracker</h2>
          <p>Use lore review to validate continuity, entity confidence, and timeline coherence before trusting manuscript analysis.</p>
        </div>
        <button
          className="process-btn"
          onClick={handleProcess}
          disabled={processing || !text}
        >
          {processing ? 'Processing...' : 'Extract Lore'}
        </button>
      </div>

      <div className="lore-review-strip">
        <div className="lore-review-card">
          <span>Critical issues</span>
          <strong>{reviewStats.criticalIssues}</strong>
        </div>
        <div className="lore-review-card">
          <span>Low-confidence entities</span>
          <strong>{reviewStats.lowConfidenceEntities}</strong>
        </div>
        <div className="lore-review-card">
          <span>Unverified entities</span>
          <strong>{reviewStats.unverifiedEntities}</strong>
        </div>
        <div className="lore-review-card">
          <span>Timeline events</span>
          <strong>{reviewStats.timelineEvents}</strong>
        </div>
      </div>

      <div className="lore-tabs">
        {Object.entries(TABS).map(([key, value]) => (
          <button
            key={key}
            className={`tab-btn ${activeTab === value ? 'active' : ''}`}
            onClick={() => setActiveTab(value)}
          >
            {key.charAt(0) + key.slice(1).toLowerCase()}
            {value === TABS.ISSUES && issues.length > 0 && (
              <span className="badge">{issues.length}</span>
            )}
          </button>
        ))}
      </div>

      <div className="lore-tab-content">
        {activeTab === TABS.ENTITIES && (
          <div className="entities-tab">
            <div className="entity-controls">
              <input
                type="text"
                placeholder="Search entities..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="search-input"
              />
              <div className="type-filters">
                <button
                  className={`filter-btn ${!typeFilter ? 'active' : ''}`}
                  onClick={() => setTypeFilter(null)}
                >
                  All ({entities.length})
                </button>
                {Object.entries(entityTypes).map(([type, count]) => (
                  <button
                    key={type}
                    className={`filter-btn ${typeFilter === type ? 'active' : ''}`}
                    onClick={() => setTypeFilter(typeFilter === type ? null : type)}
                  >
                    {type} ({count})
                  </button>
                ))}
              </div>
            </div>
            <EntityList
              entities={filteredEntities}
              relationships={relationships}
              selectedEntity={selectedEntity}
              onSelect={setSelectedEntity}
              onVerify={handleVerify}
              onRemove={handleRemove}
              onUpdate={handleUpdateEntity}
              onMerge={handleMerge}
              allEntities={entities}
            />
          </div>
        )}

        {activeTab === TABS.GRAPH && (
          <RelationshipGraph
            entities={entities}
            relationships={relationships}
            selectedEntity={selectedEntity}
            onSelectEntity={setSelectedEntity}
            agent={agent}
          />
        )}

        {activeTab === TABS.ISSUES && (
          <ConsistencyPanel
            issues={issues}
            entities={entities}
            onDismiss={handleDismissIssue}
            onAutoFix={handleAutoFix}
            onMerge={handleMerge}
          />
        )}

        {activeTab === TABS.QUERY && (
          <LoreQuery agent={agent} />
        )}

        {activeTab === TABS.TIMELINE && (
          <TimelineView agent={agent} />
        )}

        {activeTab === TABS.STATS && stats && (
          <div className="stats-tab">
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{stats.totalEntities}</div>
                <div className="stat-label">Total Entities</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.verifiedEntities}</div>
                <div className="stat-label">Verified</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.totalRelationships}</div>
                <div className="stat-label">Relationships</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.totalIssues}</div>
                <div className="stat-label">Issues</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">
                  {(stats.averageConfidence * 100).toFixed(1)}%
                </div>
                <div className="stat-label">Avg Confidence</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">
                  {stats.metadata.textSegmentsProcessed}
                </div>
                <div className="stat-label">Segments Processed</div>
              </div>
            </div>

            <div className="type-breakdown">
              <h3>Entity Types</h3>
              {Object.entries(stats.entityTypes).map(([type, count]) => (
                <div key={type} className="type-bar">
                  <span className="type-name">{type}</span>
                  <div className="bar-container">
                    <div
                      className="bar-fill"
                      style={{
                        width: `${(count / stats.totalEntities) * 100}%`,
                        backgroundColor: getTypeColor(type),
                      }}
                    />
                  </div>
                  <span className="type-count">{count}</span>
                </div>
              ))}
            </div>

            <div className="export-section">
              <button onClick={() => {
                const data = agent.export();
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'lore-export.json';
                a.click();
                URL.revokeObjectURL(url);
              }}>
                Export Lore Data
              </button>
              <button onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json';
                input.onchange = (e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    try {
                      const data = JSON.parse(ev.target.result);
                      agent.import(data);
                    } catch (err) {
                      console.error('Import error:', err);
                    }
                  };
                  reader.readAsText(file);
                };
                input.click();
              }}>
                Import Lore Data
              </button>
              <button
                className="danger-btn"
                onClick={() => {
                  if (window.confirm('Clear all lore data? This cannot be undone.')) {
                    agent.clear();
                  }
                }}
              >
                Clear All Data
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
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
