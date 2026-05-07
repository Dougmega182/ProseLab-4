// src/components/LoreAgent/EntityDetail.jsx

import React, { useState } from 'react';

export default function EntityDetail({
  entity,
  relationships,
  entities,
  onUpdate,
  onDelete,
  onVerify,
  onClose,
  onSelectEntity,
}) {
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [newAlias, setNewAlias] = useState('');
  const [newAttrKey, setNewAttrKey] = useState('');
  const [newAttrValue, setNewAttrValue] = useState('');
  const [editName, setEditName] = useState(entity.name);
  const [editType, setEditType] = useState(entity.type);

  const startEditing = () => {
    setEditName(entity.name);
    setEditType(entity.type);
    setEditData({
      name: entity.name,
      type: entity.type,
      aliases: [...(entity.aliases || [])],
      attributes: { ...(entity.attributes || {}) },
    });
    setEditing(true);
  };

  const saveEdits = () => {
    onUpdate(entity.id, { ...editData, name: editName, type: editType });
    setEditing(false);
  };

  const addAlias = () => {
    if (newAlias.trim() && !editData.aliases.includes(newAlias.trim())) {
      setEditData(prev => ({
        ...prev,
        aliases: [...prev.aliases, newAlias.trim()],
      }));
      setNewAlias('');
    }
  };

  const removeAlias = (alias) => {
    setEditData(prev => ({
      ...prev,
      aliases: prev.aliases.filter(a => a !== alias),
    }));
  };

  const addAttribute = () => {
    if (newAttrKey.trim()) {
      setEditData(prev => ({
        ...prev,
        attributes: { ...prev.attributes, [newAttrKey.trim()]: newAttrValue },
      }));
      setNewAttrKey('');
      setNewAttrValue('');
    }
  };

  const removeAttribute = (key) => {
    setEditData(prev => {
      const attrs = { ...prev.attributes };
      delete attrs[key];
      return { ...prev, attributes: attrs };
    });
  };

  const entityRelationships = relationships.filter(
    r => r.sourceId === entity.id || r.targetId === entity.id
  );

  const relatedEntities = entityRelationships.map(r => {
    const otherId = r.sourceId === entity.id ? r.targetId : r.sourceId;
    const other = entities.find(e => e.id === otherId);
    const direction = r.sourceId === entity.id ? 'outgoing' : 'incoming';
    return { relationship: r, entity: other, direction };
  }).filter(r => r.entity);

  const typeColors = {
    character: '#4A90D9',
    location: '#2ECC71',
    item: '#E67E22',
    event: '#9B59B6',
    faction: '#E74C3C',
    concept: '#1ABC9C',
    creature: '#F39C12',
    unknown: '#95A5A6',
  };

  const confidenceClass = entity.confidence >= 0.7 ? 'confidence-high'
    : entity.confidence >= 0.4 ? 'confidence-medium' : 'confidence-low';

  return (
    <div className={`entity-detail-panel ${editing ? 'editing' : ''}`}>
      <div className="detail-header">
        <button className="close-btn" onClick={onClose}>✕</button>
        <div className="title-area">
          {editing ? (
            <div className="edit-fields">
              <input 
                value={editName} 
                onChange={e => setEditName(e.target.value)} 
                className="edit-name"
              />
              <select value={editType} onChange={e => setEditType(e.target.value)}>
                {Object.keys(typeColors).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          ) : (
            <>
              <h2 style={{ color: typeColors[entity.type] }}>{entity.name}</h2>
              <span className="type-badge" style={{ backgroundColor: `${typeColors[entity.type]}33`, color: typeColors[entity.type] }}>
                {entity.type}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="detail-content">
        <div className={`confidence-section ${confidenceClass}`}>
          <label>Confidence Score</label>
          <div className="confidence-bar-container">
            <div className="confidence-bar-fill" style={{ width: `${entity.confidence * 100}%` }} />
          </div>
          <span>{(entity.confidence * 100).toFixed(0)}% Match</span>
        </div>

        <div className="aliases-section">
          <h3>Aliases</h3>
          <div className="alias-list">
            {(editing ? editData.aliases : (entity.aliases || [])).map((alias, i) => (
              <span key={i} className="alias-tag">
                {alias}
                {editing && <button className="remove-chip" onClick={() => removeAlias(alias)}>×</button>}
              </span>
            ))}
          </div>
          {editing && (
            <div className="add-alias">
              <input 
                placeholder="Add alias..." 
                value={newAlias} 
                onChange={e => setNewAlias(e.target.value)} 
                onKeyDown={e => { if (e.key === 'Enter') addAlias(); }}
              />
              <button onClick={addAlias}>+</button>
            </div>
          )}
        </div>

        <div className="attributes-section">
          <h3>Attributes</h3>
          <div className="attributes-grid">
            {Object.entries(editing ? editData.attributes : (entity.attributes || {})).map(([key, value]) => (
              <div key={key} className="attr-item">
                <span className="attr-key">{key}</span>
                {editing ? (
                  <input
                    value={value}
                    onChange={e => setEditData(prev => ({
                      ...prev,
                      attributes: { ...prev.attributes, [key]: e.target.value },
                    }))}
                  />
                ) : (
                  <span className="attr-value">{String(value)}</span>
                )}
                {editing && <button className="remove-chip" onClick={() => removeAttribute(key)}>×</button>}
              </div>
            ))}
          </div>
          {editing && (
            <div className="add-attribute">
              <input placeholder="Key" value={newAttrKey} onChange={e => setNewAttrKey(e.target.value)} />
              <input placeholder="Value" value={newAttrValue} onChange={e => setNewAttrValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addAttribute(); }} />
              <button onClick={addAttribute}>+</button>
            </div>
          )}
        </div>

        <div className="relationships-section">
          <h3>Related Entities</h3>
          <div className="rel-list">
            {relatedEntities.map(({ relationship, entity: other, direction }) => (
              <div key={relationship.id} className="rel-card" onClick={() => onSelectEntity(other)}>
                <div className="rel-type">{relationship.type} ({direction === 'outgoing' ? '→' : '←'})</div>
                <div className="rel-target" style={{ color: typeColors[other.type] }}>{other.name}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="detail-footer">
        {editing ? (
          <>
            <button className="save-btn" onClick={saveEdits}>Save Changes</button>
            <button className="cancel-btn" onClick={() => setEditing(false)}>Cancel</button>
          </>
        ) : (
          <>
            <button className="edit-btn" onClick={startEditing}>Edit Entity</button>
            <button className={`verify-btn ${entity.verified ? 'verified' : ''}`} onClick={() => onVerify(entity.id)}>
              {entity.verified ? 'Verified ✓' : 'Verify'}
            </button>
            <button className="delete-btn" onClick={() => {
              if (window.confirm(`Delete ${entity.name}?`)) {
                onDelete(entity.id);
                onClose();
              }
            }}>Delete</button>
          </>
        )}
      </div>

      <div className="graph-legend">
        {Object.keys(typeColors).map(type => (
          <div key={type} className="legend-item">
            <div className="legend-dot" style={{ backgroundColor: typeColors[type] }} />
            <span>{type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
