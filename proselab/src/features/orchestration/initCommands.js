import { commandRegistry } from './commands';

export function initCommands() {
  // Navigation
  commandRegistry.register({
    id: 'nav.goto.write',
    label: 'Go to Write Tab',
    category: 'Navigation',
    event: 'nav.goto',
    hotkey: 'G W'
  });
  commandRegistry.register({
    id: 'nav.goto.preproduction',
    label: 'Go to Preproduction Tab',
    category: 'Navigation',
    event: 'nav.goto',
    hotkey: 'G P'
  });
  commandRegistry.register({
    id: 'nav.goto.reports',
    label: 'Go to Reports Tab',
    category: 'Navigation',
    event: 'nav.goto',
    hotkey: 'G R'
  });
  commandRegistry.register({
    id: 'nav.goto.lore',
    label: 'Go to Lore Tab',
    category: 'Navigation',
    event: 'nav.goto',
    hotkey: 'G L'
  });
  commandRegistry.register({
    id: 'nav.goto.system',
    label: 'Go to System Tab',
    category: 'Navigation',
    event: 'nav.goto',
    hotkey: 'G S'
  });

  // Rewrite
  commandRegistry.register({
    id: 'rewrite.start',
    label: 'Run Editorial Rewrite',
    category: 'Rewrite',
    event: 'rewrite.run',
    hotkey: 'Cmd+Enter'
  });

  // System
  commandRegistry.register({
    id: 'system.clear_cache',
    label: 'Clear Inference Cache',
    category: 'System',
    event: 'system.action'
  });
  commandRegistry.register({
    id: 'system.clear_token_log',
    label: 'Clear Token Log & Costs',
    category: 'System',
    event: 'system.action'
  });
}
