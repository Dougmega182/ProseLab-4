/**
 * contract.js - Event Contract definitions for ProseLab platform shell.
 * Defines supported events, their expected payloads, and source owners.
 */

export const EVENT_CONTRACT = {
  // Navigation events
  "nav.goto": {
    owner: "UI",
    description: "Triggers transition between primary workspace tabs",
    validate: (payload) => {
      if (typeof payload.cmdId !== "string") throw new Error("nav.goto payload must contain a cmdId string");
    }
  },

  // Rewrite / AI pipeline events
  "rewrite.run": {
    owner: "UI/CommandPalette",
    description: "Triggers targeted rewrite or active mode execution",
    validate: (payload) => {
      // Empty or context payload is acceptable
    }
  },
  "pipeline.triggered": {
    owner: "useOrchestratorPipeline",
    description: "Emitted when a pipeline begins execution",
    validate: (payload) => {
      if (!payload.mode) throw new Error("pipeline.triggered payload must specify a 'mode'");
    }
  },
  "pipeline.stage_changed": {
    owner: "useOrchestratorPipeline",
    description: "Emitted when active orchestration stage shifts",
    validate: (payload) => {
      if (!payload.stage) throw new Error("pipeline.stage_changed payload must specify a 'stage'");
    }
  },
  "pipeline.completed": {
    owner: "useOrchestratorPipeline",
    description: "Emitted when pipeline terminates (success or failure)",
    validate: (payload) => {
      if (payload.success === undefined) throw new Error("pipeline.completed payload must contain success boolean");
    }
  },

  // Editor events
  "editor.text_mutated": {
    owner: "ProseEditor",
    description: "Emitted when editor text is mutated",
    validate: (payload) => {
      if (payload.text === undefined) throw new Error("editor.text_mutated payload must specify new 'text'");
    }
  },

  // System actions
  "system.action": {
    owner: "UI/SystemSettings",
    description: "Triggers system-wide operations",
    validate: (payload) => {
      if (typeof payload.cmdId !== "string") throw new Error("system.action payload must specify cmdId string");
    }
  },
  "costs.updated": {
    owner: "useOrchestratorPipeline",
    description: "Emitted when token costs or rates are updated",
    validate: (payload) => {
      if (!payload.costStats) throw new Error("costs.updated payload must specify costStats");
    }
  }
};

/**
 * Asserts event payload compliance with EVENT_CONTRACT
 */
export function validateEventPayload(event, payload) {
  const definition = EVENT_CONTRACT[event];
  if (!definition) {
    console.warn(`[EventContract] WARNING: Emitted undocumented event '${event}'. Please register it in contract.js.`);
    return;
  }
  try {
    definition.validate(payload);
  } catch (err) {
    console.error(`[EventContract] ERROR: Event '${event}' violated payload contract:`, err.message);
  }
}
