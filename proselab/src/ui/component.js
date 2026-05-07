export class Component {
  constructor(props = {}) {
    this.props = props;
    this.el = null;
    this.children = [];
    this.mounted = false;
    this.cleanups = [];
  }

  mount(container) {
    this.unmount();
    container.innerHTML = '';
    this.el = container;
    this.mounted = true;
    this.el.innerHTML = this.template();
    this.afterMount();
  }

  template() {
    return '';
  }

  afterMount() {
    // Override in subclasses to bind events
  }

  update(newProps = {}) {
    Object.assign(this.props, newProps);
    if (this.mounted && this.el) {
      this.el.innerHTML = this.template();
      this.afterMount();
    }
  }

  unmount() {
    for (const cleanup of this.cleanups) {
      cleanup();
    }
    this.cleanups = [];
    for (const child of this.children) {
      child.unmount();
    }
    this.children = [];
    this.mounted = false;
  }

  $(selector) {
    return this.el?.querySelector(selector);
  }

  $$(selector) {
    return this.el?.querySelectorAll(selector) || [];
  }

  on(element, event, handler) {
    if (!element) return;
    element.addEventListener(event, handler);
    this.cleanups.push(() => element.removeEventListener(event, handler));
  }

  emit(name, detail = {}) {
    this.el?.dispatchEvent(new CustomEvent(name, { bubbles: true, detail }));
  }
}
