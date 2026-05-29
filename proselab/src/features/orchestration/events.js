// A lightweight pub/sub event bus to decouple feature communication.
// Commands emit events, and features listen to these events.

import { validateEventPayload } from './contract.js';

class EventBus {
  constructor() {
    this.listeners = {};
    // For debugging and event tracing:
    this.history = [];
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    
    // Return an unsubscribe function
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  emit(event, payload = {}) {
    this.history.push({ event, payload, timestamp: Date.now() });
    
    // Keep history bounded to 500 events
    if (this.history.length > 500) {
      this.history.shift();
    }

    // Validate payload against event contract
    validateEventPayload(event, payload);

    if (process.env.NODE_ENV === "development") {
      console.log(`[EventBus] Emitted: ${event}`, payload);
    }

    if (!this.listeners[event]) return;
    
    this.listeners[event].forEach(cb => {
      try {
        cb(payload);
      } catch (err) {
        console.error(`[EventBus] Error in listener for ${event}:`, err);
      }
    });
  }
}

export const eventBus = new EventBus();
