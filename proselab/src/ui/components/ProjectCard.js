// src/ui/components/ProjectCard.js

import { Component } from '../component.js';

export class ProjectCard extends Component {
  template() {
    const {
      project = {},
      stats = {}
    } = this.props;

    const {
      id,
      title = 'Untitled',
      genre = '',
      updatedAt,
      createdAt,
      coverColor = '#6366f1'
    } = project;

    const wordCount = stats.wordCount || 0;
    const chapterCount = stats.chapterCount || 0;
    const lastEdited = updatedAt ? this.timeAgo(new Date(updatedAt)) : 'Never';

    return `
      <div class="project-card" data-project-id="${id}" tabindex="0" role="button" aria-label="Open ${this.escapeHtml(title)}">
        <div class="project-card-cover" style="background-color: ${coverColor}">
          <div class="project-card-cover-text">${this.escapeHtml(title.charAt(0).toUpperCase())}</div>
        </div>
        <div class="project-card-body">
          <h3 class="project-card-title">${this.escapeHtml(title)}</h3>
          ${genre ? `<span class="project-card-genre">${this.escapeHtml(genre)}</span>` : ''}
          <div class="project-card-meta">
            <span>${chapterCount} chapter${chapterCount !== 1 ? 's' : ''}</span>
            <span>${wordCount.toLocaleString()} words</span>
          </div>
          <div class="project-card-footer">
            <span class="project-card-date">Edited ${lastEdited}</span>
            <button class="btn-icon btn-xs project-card-menu" data-project-menu="${id}" title="More options">⋮</button>
          </div>
        </div>
      </div>
    `;
  }

  afterMount() {
    // Open project
    this.on(this.el, 'click', (e) => {
      if (!e.target.closest('.project-card-menu')) {
        this.emit('open-project', { id: this.props.project.id });
      }
    });

    this.on(this.el, 'keydown', (e) => {
      if (e.key === 'Enter' && !e.target.closest('.project-card-menu')) {
        this.emit('open-project', { id: this.props.project.id });
      }
    });

    // Context menu
    this.on(this.el, 'click', (e) => {
      const menuBtn = e.target.closest('.project-card-menu');
      if (menuBtn) {
        e.stopPropagation();
        this.showProjectMenu(menuBtn);
      }
    });
  }

  showProjectMenu(anchorEl) {
    document.querySelectorAll('.context-menu').forEach(m => m.remove());
    const rect = anchorEl.getBoundingClientRect();
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.top = `${rect.bottom + 4}px`;
    menu.style.left = `${rect.left}px`;
    menu.innerHTML = `
      <div class="context-menu-item" data-action="open">📂 Open</div>
      <div class="context-menu-item" data-action="rename">✏️ Rename</div>
      <div class="context-menu-item" data-action="duplicate">📄 Duplicate</div>
      <div class="context-menu-item" data-action="export">📤 Export</div>
      <div class="context-menu-separator"></div>
      <div class="context-menu-item context-menu-danger" data-action="delete">🗑️ Delete</div>
    `;
    document.body.appendChild(menu);

    const handleClick = (e) => {
      const item = e.target.closest('.context-menu-item');
      if (item) {
        this.emit('project-action', {
          action: item.dataset.action,
          projectId: this.props.project.id
        });
      }
      menu.remove();
      document.removeEventListener('click', handleOutside);
    };

    const handleOutside = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', handleOutside);
      }
    };

    menu.addEventListener('click', handleClick);
    setTimeout(() => document.addEventListener('click', handleOutside), 0);
  }

  timeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.floor(months / 12)}y ago`;
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
