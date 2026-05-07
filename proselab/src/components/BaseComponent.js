/**
 * Base Component
 * Simple component base class with event emission capabilities.
 */
export class BaseComponent {
  constructor(appContext) {
    this.appContext = appContext;
    this.events = {};
  }

  /**
   * Emit an event to listeners and the app context
   */
  emit(event, data) {
    // If the component has a specific event handler
    if (this.events[event]) {
      this.events[event].forEach(callback => callback(data));
    }

    // Forward to app context if it supports event bubbling/emission
    if (this.appContext && typeof this.appContext.emit === 'function') {
      this.appContext.emit(event, data);
    }
    
    // Also check for 'onEvent' naming convention in appContext for direct coupling
    const handlerName = 'on' + event.charAt(0).toUpperCase() + event.slice(1);
    if (this.appContext && typeof this.appContext[handlerName] === 'function') {
      this.appContext[handlerName](data);
    }
  }

  /**
   * Register an event listener
   */
  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
    return () => this.off(event, callback);
  }

  /**
   * Remove an event listener
   */
  off(event, callback) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter(cb => cb !== callback);
  }

  /**
   * Lifecycle method for cleanup
   */
  destroy() {
    this.events = {};
  }
}
