// src/components/LoreAgent/EntityList.jsx

import React, { useState } from 'react';

export default function EntityList({
  entities,
  relationships,
  selectedEntity,
  onSelect,
  onVerify,
  onRemove,
  onUpdate,
  onMerge,
  allEntities,
}) {
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [mergeTarget, setMergeTarget] = useState(null);

  const handleEdit = (entity) => {
    setEditingId(entity.id);
    setEditForm({
      name: entity.name,
      type: entity.type,
      description: entity.attributes?.description || '',
      aliases: (entity.aliases || []).join(', '),
    });
  };

  const handleSaveEdit = (entityId) => {
    onUpdate(entityId, {
      name: editForm.name,
      type: editForm.type,
      aliases: editForm.aliases.split(',').map(a => a.trim()).filter(Boolean),
      attributes: {
        description: editForm.description,
      },
    });
    setEditingId(null);
  };

  const handleStartMerge = (entityId) => {
    setMergeTarget(entityId);
  };

  const handleCompleteMerge = (otherEntityId) => {
    if (mergeTarget && otherEntityId) {
      onMerge(mergeTarget, otherEntityId);
    }
    setMergeTarget(null);
  };

  if (entities.length === 0) {
    return (
      <div className="empty-state">
        <p>No entities found. Process some text to extract lore entities.</p>
      </div>
    );
  }

  return (
    <div className="entity-list">
      {entities.map(entity => {
        const isSelected = selectedEntity?.id === entity.id;
        const isEditing = editingId === entity.id;
        const entityRels = relationships.filter(
          r => r.sourceId === entity.id || r.targetId === entity.id
        );

        return (
          <div
            key={entity.id}
            className={`entity-card ${isSelected ? 'selected' : ''} ${entity.verified ? 'verified' : ''}`}
            onClick={() => onSelect(isSelected ? null : entity)}
          >
            <div className="entity-header">
              <span
                className="entity-type-badge"
                style={{ backgroundColor: getTypeColor(entity.type) }}
              >
                {entity.type}
              </span>

              {isEditing ? (
                <input
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  className="edit-input"
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <span className="entity-name">{entity.name}</span>
              )}

              <div className="entity-meta">
                <span className="confidence-badge" title="Confidence">
                  {(entity.confidence * 100).toFixed(0)}%
                </span>
                <span className="mentions-badge" title="Mentions">
                  ×{entity.mentions}
                </span>
                {entity.verified && (
                  <span className="verified-badge" title="Verified">✓</span>
                )}
              </div>
            </div>

            {entity.aliases && entity.aliases.length > 0 && !isEditing && (
              <div className="entity-aliases">
                aka: {entity.aliases.join(', ')}
              </div>
            )}

            {entity.attributes?.description && !isEditing && (
              <div className="entity-description">
                {entity.attributes.description}
              </div>
            )}

            {isSelected && !isEditing && (
              <div className="entity-details" onClick={e => e.stopPropagation()}>
                {entity.attributes && Object.keys(entity.attributes).length > 0 && (
                  <div className="attributes-section">
                    <h4>Attributes</h4>
                    {Object.entries(entity.attributes).map(([key, value]) => (
                      <div key={key} className="attribute-row">
                        <span className="attr-key">{key}:</span>
                        <span className="attr-value">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {entityRels.length > 0 && (
                  <div className="relationships-section">
                    <h4>Relationships ({entityRels.length})</h4>
                    {entityRels.map(rel => {
                      const otherId = rel.sourceId === entity.id ? rel.targetId : rel.sourceId;
                      const other = allEntities.find(e => e.id === otherId);
                      const direction = rel.sourceId === entity.id ? '→' : '←';
                      return (
                        <div key={rel.id} className="rel-row">
                          <span className="rel-direction">{direction}</span>
                          <span className="rel-type">{rel.subtype || rel.type}</span>
                          <span className="rel-target">{other?.name || 'Unknown'}</span>
                          <span className="rel-confidence">
                            {(rel.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {entity.contexts && entity.contexts.length > 0 && (
                  <div className="contexts-section">
                    <h4>Contexts</h4>
                    {entity.contexts.slice(-3).map((ctx, i) => (
                      <div key={i} className="context-snippet">
                        "...{ctx}..."
                      </div>
                    ))}
                  </div>
                )}

                <div className="entity-actions">
                  {!entity.verified && (
                    <button className="action-btn verify" onClick={() => onVerify(entity.id)}>
                      ✓ Verify
                    </button>
                  )}
                  <button className="action-btn edit" onClick={() => handleEdit(entity)}>
                    ✎ Edit
                  </button>
                  <button className="action-btn merge" onClick={() => handleStartMerge(entity.id)}>
                    ⊕ Merge
                  </button>
                  <button className="action-btn remove" onClick={() => onRemove(entity.id)}>
                    ✕ Remove
                  </button>
                </div>
              </div>
            )}

            {isEditing && (
              <div className="edit-form" onClick={e => e.stopPropagation()}>
                <div className="form-row">
                  <label>Type:</label>
                  <select
                    value={editForm.type}
                    onChange={e => setEditForm({ ...editForm, type: e.target.value })}
                  >
                    {['character', 'location', 'item', 'event', 'faction', 'concept', 'creature', 'unknown'].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <label>Aliases:</label>
                  <input
                    value={editForm.aliases}
                    onChange={e => setEditForm({ ...editForm, aliases: e.target.value })}
                    placeholder="Comma-separated aliases"
                  />
                </div>
                <div className="form-row">
                  <label>Description:</label>
                  <textarea
                    value={editForm.description}
                    onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                  />
                </div>
                <div className="form-actions">
                  <button onClick={() => handleSaveEdit(entity.id)}>Save</button>
                  <button onClick={() => setEditingId(null)}>Cancel</button>
                </div>
              </div>
            )}

            {mergeTarget === entity.id && (
              <div className="merge-panel" onClick={e => e.stopPropagation()}>
                <p>Select entity to merge with:</p>
                <select onChange={e => handleCompleteMerge(e.target.value)}>
                  <option value="">-- Select --</option>
                  {allEntities
                    .filter(e => e.id !== entity.id)
                    .map(e => (
                      <option key={e.id} value={e.id}>{e.name} ({e.type})</option>
                    ))}
                </select>
                <button onClick={() => setMergeTarget(null)}>Cancel</button>
              </div>
            )}
          </div>
        );
      })}
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
