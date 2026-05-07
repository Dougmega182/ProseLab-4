// src/components/LoreAgent/LoreAgent.jsx
import React, { useState } from 'react';
import { useLoreAgent } from '../../hooks/useLoreAgent';
import { ENTITY_SCHEMAS, ENTITY_TYPES } from '../../engine/lore/entityTypes';
import './LoreAgent.css';

export default function LoreAgent({ projectData, onProjectUpdate }) {
  const {
    lore,
    foundEntities,
    isAnalyzing,
    analysisProgress,
    error,
    scanText,
    commitEntities,
    removeFoundEntity,
    updateFoundEntity
  } = useLoreAgent(projectData, onProjectUpdate);

  const [selectedTab, setSelectedTab] = useState('discovered'); // 'discovered' or 'database'
  const [filterType, setFilterType] = useState('all');

  const handleScan = async () => {
    // For demo, we scan the last modified chapter or the whole manuscript
    const chapters = projectData?.chapters || [];
    if (chapters.length === 0) {
      alert("No chapters found to scan.");
      return;
    }
    
    // Scan the most recent chapter text
    const textToScan = chapters.map(c => c.content).join('\n\n');
    await scanText(textToScan);
  };

  const filteredFound = foundEntities.filter(e => filterType === 'all' || e.type === filterType);
  const filteredDb = lore.filter(e => filterType === 'all' || e.type === filterType);

  return (
    <div className="lore-agent">
      <div className="lore-header">
        <div className="header-title">
          <h2>Lore Agent</h2>
          <span className="lore-count">{lore.length} entities in database</span>
        </div>
        <div className="header-actions">
          <button 
            className={`btn-scan ${isAnalyzing ? 'analyzing' : ''}`} 
            onClick={handleScan}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? `Scanning... ${analysisProgress}%` : '✨ Scan Manuscript'}
          </button>
        </div>
      </div>

      <div className="lore-tabs">
        <button 
          className={selectedTab === 'discovered' ? 'active' : ''} 
          onClick={() => setSelectedTab('discovered')}
        >
          Discovered ({foundEntities.length})
        </button>
        <button 
          className={selectedTab === 'database' ? 'active' : ''} 
          onClick={() => setSelectedTab('database')}
        >
          Lore Database ({lore.length})
        </button>
      </div>

      <div className="lore-toolbar">
        <div className="filter-group">
          <label>Filter:</label>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="all">All Types</option>
            {Object.values(ENTITY_TYPES).map(type => (
              <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
            ))}
          </select>
        </div>
        {selectedTab === 'discovered' && foundEntities.length > 0 && (
          <button className="btn-commit-all" onClick={() => commitEntities(foundEntities)}>
            Commit All
          </button>
        )}
      </div>

      <div className="lore-content">
        {selectedTab === 'discovered' ? (
          <div className="entity-grid">
            {filteredFound.length === 0 ? (
              <div className="empty-state">
                <p>{isAnalyzing ? 'Agent is currently scanning text...' : 'No new entities discovered. Try scanning your manuscript.'}</p>
              </div>
            ) : (
              filteredFound.map(entity => (
                <EntityCard 
                  key={entity.name} 
                  entity={entity} 
                  isNew={true}
                  onCommit={() => commitEntities([entity])}
                  onRemove={() => removeFoundEntity(entity.name)}
                  onUpdate={(updates) => updateFoundEntity(entity.name, updates)}
                />
              ))
            )}
          </div>
        ) : (
          <div className="entity-grid">
            {filteredDb.length === 0 ? (
              <div className="empty-state">
                <p>Lore database is empty. Add entities manually or scan your manuscript.</p>
              </div>
            ) : (
              filteredDb.map(entity => (
                <EntityCard 
                  key={entity.id || entity.name} 
                  entity={entity} 
                  isNew={false}
                />
              ))
            )}
          </div>
        )}
      </div>

      {error && <div className="lore-error">{error}</div>}
    </div>
  );
}

function EntityCard({ entity, isNew, onCommit, onRemove, onUpdate }) {
  const schema = ENTITY_SCHEMAS[entity.type] || ENTITY_SCHEMAS[ENTITY_TYPES.CHARACTER];
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className={`entity-card ${isNew ? 'new' : ''}`} style={{ borderColor: schema.color }}>
      <div className="card-header">
        <span className="entity-icon" style={{ backgroundColor: schema.color }}>{schema.icon}</span>
        <div className="entity-meta">
          <span className="entity-name">{entity.name}</span>
          <span className="entity-type-label">{entity.type}</span>
        </div>
        {isNew && (
          <div className="card-actions">
            <button className="btn-approve" onClick={onCommit} title="Commit to Lore Database">✓</button>
            <button className="btn-reject" onClick={onRemove} title="Reject">×</button>
          </div>
        )}
      </div>
      
      <div className="card-body">
        <p className="entity-description">
          {entity.description || 'No description extracted yet.'}
        </p>
        
        {entity.relationships && entity.relationships.length > 0 && (
          <div className="entity-relationships">
            <strong>Relationships:</strong>
            <ul>
              {entity.relationships.slice(0, 3).map((rel, i) => (
                <li key={i}>{rel.type}: {rel.target}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {isNew && (
        <div className="card-footer">
          <div className="confidence-meter">
            <div className="confidence-fill" style={{ width: `${entity.confidence * 100}%` }}></div>
          </div>
          <span className="confidence-text">{Math.round(entity.confidence * 100)}% Match</span>
        </div>
      )}
    </div>
  );
}
