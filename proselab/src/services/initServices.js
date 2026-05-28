/**
 * initServices.js
 * 
 * Unified startup routine for ProseLab V4.
 * Orchestrates early service initialization before the React tree renders.
 * This prevents null state race conditions and ensures DB and adapters are fully hydrated.
 */

import { retrievalService } from "./retrievalService.js";
import { dexieRetrievalAdapter } from "./adapters/dexieRetrievalAdapter.js";
import { initDB } from "./db.js";

let initializationPromise = null;

/**
 * Initializes all core application services.
 * Registers the Dexie retrieval adapter and initiates IndexedDB connection.
 * 
 * @returns {Promise<boolean>} Resolves to true on success, throws on critical failure.
 */
export function initServices() {
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    console.log("[initServices] Starting core services initialization sequence...");
    
    try {
      // 1. Initialize and register the retrieval service adapter
      console.log("[initServices] Registering Dexie retrieval adapter...");
      retrievalService.init(dexieRetrievalAdapter);

      // 2. Establish IndexedDB database connection and run upgrades
      console.log("[initServices] Establishing IndexedDB connection...");
      const dbInstance = await initDB();
      console.log(`[initServices] IndexedDB connected successfully. DB Name: ${dbInstance.name}, Version: ${dbInstance.version}`);

      // 3. Optional legacy migrations or other early-service runs can go here

      console.log("[initServices] All core services successfully initialized.");
      return true;
    } catch (error) {
      console.error("[initServices] CRITICAL INITIALIZATION ERROR:", error);
      // Reset initialization promise so it can be retried if needed
      initializationPromise = null;
      throw error;
    }
  })();

  return initializationPromise;
}
