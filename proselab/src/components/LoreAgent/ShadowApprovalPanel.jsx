/**
 * ShadowApprovalPanel
 * UI for reviewing and applying proposed lore updates (Shadow Actions).
 */

import React, { useState } from 'react';
import { useShadowActions } from '../../hooks/useShadowActions.js';

export default function ShadowApprovalPanel({ projectId, sceneId }) {
  const { pendingActions, loading, approve, approveWithModification, reject, approveAll } = useShadowActions(projectId, sceneId);
  const [editingActionId, setEditingActionId] = useState(null);
  const [modifiedPayload, setModifiedPayload] = useState(null);

  if (loading && pendingActions.length === 0) {
    return <div className="shadow-panel-loading">Scanning for world changes...</div>;
  }

  if (pendingActions.length === 0) {
    return (
      <div className="shadow-panel-empty">
        <p>No pending lore updates.</p>
        <p className="hint">Generated prose is monitored for new entities and state changes.</p>
      </div>
    );
  }

  const handleStartEdit = (action) => {
    setEditingActionId(action.id);
    setModifiedPayload(JSON.stringify(action.payload, null, 2));
  };

  const handleSaveEdit = async (actionId) => {
    try {
      const payload = JSON.parse(modifiedPayload);
      await approveWithModification(actionId, payload);
      setEditingActionId(null);
    } catch (e) {
      alert("Invalid JSON payload: " + e.message);
    }
  };

  return (
    <div className="shadow-panel">
      <div className="shadow-panel-header">
        <h3>Proposed Lore Updates ({pendingActions.length})</h3>
        <button className="btn btn-ghost" onClick={approveAll} disabled={loading}>Approve All</button>
      </div>

      <div className="shadow-list">
        {pendingActions.map(action => (
          <div key={action.id} className={`shadow-item type-${action.type.toLowerCase()}`}>
            <div className="shadow-item-meta">
              <span className="action-type">{action.type.replace('_', ' ')}</span>
              {action.citation && <span className="action-citation">“{action.citation}”</span>}
            </div>

            <div className="shadow-item-content">
              {editingActionId === action.id ? (
                <textarea
                  className="payload-editor"
                  value={modifiedPayload}
                  onChange={(e) => setModifiedPayload(e.target.value)}
                  rows={6}
                />
              ) : (
                <div className="payload-display">
                  {renderPayload(action)}
                </div>
              )}
            </div>

            <div className="shadow-item-actions">
              {editingActionId === action.id ? (
                <>
                  <button className="btn btn-primary btn-sm" onClick={() => handleSaveEdit(action.id)}>Apply</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditingActionId(null)}>Cancel</button>
                </>
              ) : (
                <>
                  <button className="btn btn-primary btn-sm" onClick={() => approve(action.id)}>Approve</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleStartEdit(action)}>Modify</button>
                  <button className="btn btn-ghost btn-sm btn-danger" onClick={() => reject(action.id)}>Reject</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderPayload(action) {
  const { payload } = action;
  switch (action.type) {
    case 'ADD_ENTITY':
      return (
        <div>
          <strong>New {payload.type}: {payload.name}</strong>
          <p>{payload.description}</p>
          {payload.aliases?.length > 0 && <small>Aliases: {payload.aliases.join(', ')}</small>}
        </div>
      );
    case 'UPDATE_STATE':
      return (
        <div>
          <strong>{payload.entityName}</strong>: {payload.attribute} changed
          <div className="state-diff">
            <span className="old-value">{payload.previousValue || 'none'}</span>
            <span className="arrow">→</span>
            <span className="new-value">{payload.newValue}</span>
          </div>
        </div>
      );
    case 'UPDATE_RELATIONSHIP':
      return (
        <div>
          <strong>{payload.entityName}</strong> → <strong>{payload.targetName}</strong>: {payload.relationshipType}
          <p>{payload.description}</p>
        </div>
      );
    case 'FLAG_CONTRADICTION':
      return (
        <div className="contradiction-alert">
          <strong>CONTRADICTION</strong> in {payload.entityName}
          <p>{payload.suggestedResolution}</p>
          <div className="state-diff">
            <span className="old-value">Known: {payload.establishedValue}</span>
            <span className="new-value">Prose: {payload.contradictingValue}</span>
          </div>
        </div>
      );
    default:
      return <pre>{JSON.stringify(payload, null, 2)}</pre>;
  }
}
