// The central registry for system commands.
// Commands map to unique IDs and emit events via the eventBus.

class CommandRegistry {
  constructor() {
    this.commands = new Map();
  }

  /**
   * Registers a command in the system.
   * @param {Object} cmd 
   * @param {string} cmd.id - Unique identifier for the command (e.g. 'rewrite.start')
   * @param {string} cmd.label - Human-readable label (e.g. 'Start Rewrite')
   * @param {string} cmd.category - Grouping category (e.g. 'Rewrite', 'System', 'Navigation')
   * @param {string} cmd.event - The event name to emit when executed
   * @param {string} [cmd.description] - Optional subtext
   * @param {string} [cmd.hotkey] - Optional keyboard shortcut text
   */
  register(cmd) {
    if (!cmd.id || !cmd.label || !cmd.event || !cmd.category) {
      console.warn(`[CommandRegistry] Invalid command definition:`, cmd);
      return;
    }
    this.commands.set(cmd.id, cmd);
  }

  getCommand(id) {
    return this.commands.get(id);
  }

  getAll() {
    return Array.from(this.commands.values());
  }
}

export const commandRegistry = new CommandRegistry();
