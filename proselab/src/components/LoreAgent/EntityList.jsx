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
      aliases: editForm.aliases.split(',').map((alias) => alias.trim()).filter(Boolean),
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
      {entities.map((entity) => {
        const isSelected = selectedEntity?.id === entity.id;
        const isEditing = editingId === entity.id;
        const entityRels = relationships.filter(
          (relationship) => relationship.sourceId === entity.id || relationship.targetId === entity.id
        );
        const needsReview = !entity.verified || entity.confidence < 0.6;
        const reviewLabel = !entity.verified ? 'Unverified' : (entity.confidence < 0.6 ? 'Low confidence' : '');

        return (
          <div
            key={entity.id}
            className={`entity-card ${isSelected ? 'selected' : ''} ${entity.verified ? 'verified' : ''} ${needsReview ? 'needs-review' : ''}`}
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
                  onChange={(event) => setEditForm({ ...editForm, name: event.target.value })}
                  className="edit-input"
                  onClick={(event) => event.stopPropagation()}
                />
              ) : (
                <span className="entity-name">{entity.name}</span>
              )}

              <div className="entity-meta">
                <span className="confidence-badge" title="Confidence">
                  {(entity.confidence * 100).toFixed(0)}%
                </span>
                <span className="mentions-badge" title="Mentions">
                  x{entity.mentions}
                </span>
                {entity.verified && (
                  <span className="verified-badge" title="Verified">Verified</span>
                )}
              </div>
            </div>

            {needsReview && !isEditing && (
              <div className="entity-review-banner">{reviewLabel}</div>
            )}

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
              <div className="entity-details" onClick={(event) => event.stopPropagation()}>
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
                    {entityRels.map((relationship) => {
                      const otherId = relationship.sourceId === entity.id ? relationship.targetId : relationship.sourceId;
                      const other = allEntities.find((candidate) => candidate.id === otherId);
                      const direction = relationship.sourceId === entity.id ? '->' : '<-';
                      return (
                        <div key={relationship.id} className="rel-row">
                          <span className="rel-direction">{direction}</span>
                          <span className="rel-type">{relationship.subtype || relationship.type}</span>
                          <span className="rel-target">{other?.name || 'Unknown'}</span>
                          <span className="rel-confidence">
                            {(relationship.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {entity.contexts && entity.contexts.length > 0 && (
                  <div className="contexts-section">
                    <h4>Contexts</h4>
                    {entity.contexts.slice(-3).map((context, index) => (
                      <div key={index} className="context-snippet">
                        "...{context}..."
                      </div>
                    ))}
                  </div>
                )}

                <div className="entity-actions">
                  {!entity.verified && (
                    <button className="action-btn verify" onClick={() => onVerify(entity.id)}>
                      Verify
                    </button>
                  )}
                  <button className="action-btn edit" onClick={() => handleEdit(entity)}>
                    Edit
                  </button>
                  <button className="action-btn merge" onClick={() => handleStartMerge(entity.id)}>
                    Merge
                  </button>
                  <button className="action-btn remove" onClick={() => onRemove(entity.id)}>
                    Remove
                  </button>
                </div>
              </div>
            )}

            {isEditing && (
              <div className="edit-form" onClick={(event) => event.stopPropagation()}>
                <div className="form-row">
                  <label>Type:</label>
                  <select
                    value={editForm.type}
                    onChange={(event) => setEditForm({ ...editForm, type: event.target.value })}
                  >
                    {['character', 'location', 'item', 'event', 'faction', 'concept', 'creature', 'unknown'].map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <label>Aliases:</label>
                  <input
                    value={editForm.aliases}
                    onChange={(event) => setEditForm({ ...editForm, aliases: event.target.value })}
                    placeholder="Comma-separated aliases"
                  />
                </div>
                <div className="form-row">
                  <label>Description:</label>
                  <textarea
                    value={editForm.description}
                    onChange={(event) => setEditForm({ ...editForm, description: event.target.value })}
                  />
                </div>
                <div className="form-actions">
                  <button onClick={() => handleSaveEdit(entity.id)}>Save</button>
                  <button onClick={() => setEditingId(null)}>Cancel</button>
                </div>
              </div>
            )}

            {mergeTarget === entity.id && (
              <div className="merge-panel" onClick={(event) => event.stopPropagation()}>
                <p>Select entity to merge with:</p>
                <select onChange={(event) => handleCompleteMerge(event.target.value)}>
                  <option value="">-- Select --</option>
                  {allEntities
                    .filter((candidate) => candidate.id !== entity.id)
                    .map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.name} ({candidate.type})
                      </option>
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
