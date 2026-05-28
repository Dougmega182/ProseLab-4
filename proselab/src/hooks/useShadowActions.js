/**
 * useShadowActions Hook
 * Provides a reactive interface for the ShadowManager.
 */

import { useState, useCallback, useEffect } from 'react';
import { ShadowManager } from '../engine/shadow-manager.js';
import { db } from '../db/index.js';

const shadowManager = new ShadowManager(db);

export function useShadowActions(projectId, sceneId = null) {
  const [pendingActions, setPendingActions] = useState([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      let actions;
      if (sceneId) {
        actions = await shadowManager.getPendingActionsForScene(sceneId);
      } else {
        actions = await shadowManager.getPendingActions(projectId);
      }
      setPendingActions(actions);
    } finally {
      setLoading(false);
    }
  }, [projectId, sceneId]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      await Promise.resolve();
      if (active) {
        refresh();
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [refresh]);

  const approve = useCallback(async (actionId) => {
    await shadowManager.approveAction(actionId);
    await refresh();
  }, [refresh]);

  const approveWithModification = useCallback(async (actionId, modifiedPayload) => {
    await shadowManager.approveWithModification(actionId, modifiedPayload);
    await refresh();
  }, [refresh]);

  const reject = useCallback(async (actionId) => {
    await shadowManager.rejectAction(actionId);
    await refresh();
  }, [refresh]);

  const approveAll = useCallback(async () => {
    await shadowManager.approveAll(projectId);
    await refresh();
  }, [projectId, refresh]);

  return {
    pendingActions,
    loading,
    refresh,
    approve,
    approveWithModification,
    reject,
    approveAll
  };
}
