import React, { useState, useEffect, useRef } from 'react';
import { commandRegistry } from '../../orchestration/commands';
import { eventBus } from '../../orchestration/events';
import './CommandPalette.css'; // We will create this minimal CSS next

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  // Filter and group commands
  const allCommands = commandRegistry.getAll();
  
  const filteredCommands = query 
    ? allCommands.filter(cmd => 
        cmd.label.toLowerCase().includes(query.toLowerCase()) || 
        cmd.category.toLowerCase().includes(query.toLowerCase())
      )
    : allCommands;

  // Global hotkey listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // List navigation
  useEffect(() => {
    const handleNavigation = (e) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
      }
      if (e.key === 'Enter' && filteredCommands[selectedIndex]) {
        e.preventDefault();
        executeCommand(filteredCommands[selectedIndex]);
      }
    };

    window.addEventListener('keydown', handleNavigation);
    return () => window.removeEventListener('keydown', handleNavigation);
  }, [isOpen, filteredCommands, selectedIndex]);

  const executeCommand = (cmd) => {
    setIsOpen(false);
    eventBus.emit(cmd.event, { source: 'command_palette', cmdId: cmd.id });
  };

  if (!isOpen) return null;

  return (
    <div className="command-palette-overlay" onClick={() => setIsOpen(false)}>
      <div className="command-palette-modal" onClick={e => e.stopPropagation()}>
        <div className="command-palette-header">
          <input
            ref={inputRef}
            type="text"
            className="command-palette-input"
            placeholder="Type a command or search..."
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
          />
        </div>
        <div className="command-palette-list">
          {filteredCommands.length === 0 ? (
            <div className="command-palette-empty">No commands found.</div>
          ) : (
            filteredCommands.map((cmd, index) => (
              <div
                key={cmd.id}
                className={`command-palette-item ${index === selectedIndex ? 'selected' : ''}`}
                onClick={() => executeCommand(cmd)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="command-palette-item-left">
                  <span className="command-category">{cmd.category}</span>
                  <span className="command-label">{cmd.label}</span>
                </div>
                {cmd.hotkey && (
                  <div className="command-palette-item-right">
                    <span className="command-hotkey">{cmd.hotkey}</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
