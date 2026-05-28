/**
 * retrievalService.js
 * 
 * A decoupled, stateless orchestration gateway for manuscript retrieval.
 * Delegates all database and IndexedDB operations to an injected adapter,
 * ensuring architectural boundaries are respected and stateless execution is preserved.
 */

let activeAdapter = null;

export const retrievalService = {
  /**
   * Initializes the service with a storage/retrieval adapter.
   * @param {Object} adapter - The adapter to register. Must implement getPassages.
   */
  init(adapter) {
    if (activeAdapter) {
      throw new Error("RetrievalService: Already initialized with an adapter.");
    }
    if (!adapter || typeof adapter.getPassages !== "function") {
      throw new Error("RetrievalService: Invalid adapter. Must implement getPassages(projectId, query, options).");
    }
    activeAdapter = adapter;
    console.log("[RetrievalService] Successfully initialized with adapter.");
  },

  /**
   * Returns whether an adapter is active.
   * @returns {boolean}
   */
  isInitialized() {
    return activeAdapter !== null;
  },

  /**
   * Resets the registered adapter (primarily for testing and recovery).
   */
  reset() {
    activeAdapter = null;
  },

  /**
   * Asynchronously retrieves matching prose passages for a query in a project.
   * Enforces the unified return contract: { success, data, warnings, error }
   * 
   * @param {string} projectId - The active project ID.
   * @param {string} query - The retrieval query (keyword or prose).
   * @param {Object} [options={}] - Configurable search limits and options.
   * @returns {Promise<Object>} The standard return payload.
   */
  async getPassages(projectId, query, options = {}) {
    if (!activeAdapter) {
      return {
        success: false,
        data: null,
        warnings: [],
        error: "RetrievalService: Service is not initialized. Please call init(adapter) first."
      };
    }

    try {
      const startTime = Date.now();
      const adapterResult = await activeAdapter.getPassages(projectId, query, options);
      const durationMs = Date.now() - startTime;

      // Extract details from the adapter result
      const passages = adapterResult?.passages || [];
      const warnings = adapterResult?.warnings || [];
      const error = adapterResult?.error || null;
      const success = adapterResult?.success !== false && !error;

      return {
        success,
        data: {
          passages,
          metrics: {
            duration_ms: durationMs,
            ...(adapterResult?.metrics || {})
          }
        },
        warnings,
        error
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        warnings: [],
        error: err instanceof Error ? err.message : String(err)
      };
    }
  }
};
