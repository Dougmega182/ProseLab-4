// src/ui/router.js

export class Router {
  constructor() {
    this.routes = [];
    this.currentPath = '';
    this.listeners = new Set();
  }

  addRoute(pattern, handler) {
    // Convert /project/:id to regex
    const paramNames = [];
    const regexStr = pattern.replace(/:(\w+)/g, (_, name) => {
      paramNames.push(name);
      return '([^/]+)';
    });
    const regex = new RegExp(`^${regexStr}$`);
    this.routes.push({ pattern, regex, paramNames, handler });
  }

  start() {
    window.addEventListener('popstate', () => this.handleRoute());
    this.handleRoute();
  }

  navigate(path) {
    if (path === this.currentPath) return;
    window.history.pushState({}, '', `#${path}`);
    this.handleRoute();
  }

  handleRoute() {
    const hash = window.location.hash.slice(1) || '/';
    this.currentPath = hash;

    for (const route of this.routes) {
      const match = hash.match(route.regex);
      if (match) {
        const params = {};
        route.paramNames.forEach((name, i) => {
          params[name] = match[i + 1];
        });
        route.handler(params);
        this.notifyListeners(hash, params);
        return; }
    }

    // Default: go to home
    if (this.routes.length > 0) {
      this.routes[0].handler({});
    }
  }

  notifyListeners(path, params) {
    for (const listener of this.listeners) {
      listener(path, params);
    }
  }

  onChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
