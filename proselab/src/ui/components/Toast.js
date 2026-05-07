// src/ui/components/Toast.js

import { Component } from '../component.js';

export class Toast extends Component {
  template() {
    const { message = '', type = 'info', duration = 3000, action = null } = this.props;
    const icons = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌' };

    return `
      <div class="toast toast-${type}" role="alert">
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span class="toast-message">${this.escapeHtml(message)}</span>
        ${action ? `<button class="btn btn-xs toast-action" id="toast-action">${this.escapeHtml(action.label)}</button>` : ''}
        <button class="btn-icon btn-xs toast-close" id="toast-close">✕</button>
      </div>
    `;
  }

  afterMount() {
    const { duration = 3000 } = this.props;

    this.on(this.el, 'click', (e) => {
      if (e.target.closest('#toast-close')) {
        this.dismiss();
      }
    });

    this.on(this.el, 'click', (e) => {
      if (e.target.closest('#toast-action')) {
        this.emit('toast-action', { action: this.props.action });
        this.dismiss();
      }
    });

    if (duration > 0) {
      this._timeout = setTimeout(() => this.dismiss(), duration);
    }

    // Animate in
    requestAnimationFrame(() => {
      this.el.querySelector('.toast')?.classList.add('toast-enter');
    });
  }

  dismiss() {
    if (this._timeout) clearTimeout(this._timeout);
    const toast = this.el.querySelector('.toast');
    if (toast) {
      toast.classList.add('toast-exit');
      setTimeout(() => this.unmount(), 300); // Updated to use the base class unmount method
    } else {
      this.unmount();
    }
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

// Toast container manager
export class ToastContainer {
  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'toast-container';
    document.body.appendChild(this.container);
  }

  show(message, type = 'info', options = {}) {
    const toast = new Toast({
      message,
      type,
      duration: options.duration ?? 3000,
      action: options.action || null
    });
    toast.mount(this.container);
    return toast;
  }

  info(message, options) { return this.show(message, 'info', options); }
  success(message, options) { return this.show(message, 'success', options); }
  warning(message, options) { return this.show(message, 'warning', options); }
  error(message, options) { return this.show(message, 'error', options); }
}
