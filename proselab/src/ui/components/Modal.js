// src/ui/components/Modal.js

import { Component } from '../component.js';

export class Modal extends Component {
  template() {
    const {
      title = '',
      content = '',
      buttons = [],
      size = 'medium', // small, medium, large
      closable = true
    } = this.props;

    return `
      <div class="modal-overlay" id="modal-overlay">
        <div class="modal modal-${size}" role="dialog" aria-modal="true" aria-label="${this.escapeHtml(title)}">
          <div class="modal-header">
            <h3 class="modal-title">${this.escapeHtml(title)}</h3>
            ${closable ? '<button class="btn-icon modal-close" id="modal-close" aria-label="Close">✕</button>' : ''}
          </div>
          <div class="modal-body" id="modal-body">
            ${content}
          </div>
          ${buttons.length > 0 ? `
            <div class="modal-footer">
              ${buttons.map(btn => `
                <button class="btn ${btn.primary ? 'btn-primary' : ''} ${btn.danger ? 'btn-danger' : ''}"
                        data-modal-action="${btn.action}"
                        ${btn.disabled ? 'disabled' : ''}>
                  ${this.escapeHtml(btn.label)}
                </button>
              `).join('')}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  afterMount() {
    // Close button
    this.on(this.el, 'click', (e) => {
      if (e.target.closest('#modal-close')) {
        this.emit('modal-close');
        this.close();
      }
    });

    // Overlay click to close
    this.on(this.el, 'click', (e) => {
      if (e.target.id === 'modal-overlay' && this.props.closable !== false) {
        this.emit('modal-close');
        this.close();
      }
    });

    // Button actions
    this.on(this.el, 'click', (e) => {
      const btn = e.target.closest('[data-modal-action]');
      if (btn) {
        this.emit('modal-action', { action: btn.dataset.modalAction });
      }
    });

    // Escape key
    this._escHandler = (e) => {
      if (e.key === 'Escape' && this.props.closable !== false) {
        this.emit('modal-close');
        this.close();
      }
    };
    document.addEventListener('keydown', this._escHandler);

    // Focus trap
    this.trapFocus();
  }

  trapFocus() {
    const modal = this.el.querySelector('.modal');
    if (!modal) return;
    const focusable = modal.querySelectorAll('button, input, textarea, select, [tabindex]:not([tabindex="-1"])');
    if (focusable.length === 0) return;
    focusable[0].focus();
  }

  close() {
    if (this._escHandler) {
      document.removeEventListener('keydown', this._escHandler);
    }
    this.el.classList.add('modal-closing');
    setTimeout(() => {
      this.unmount(); // Updated to use the base class unmount method
    }, 200);
  }

  getBody() {
    return this.$('#modal-body');
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
