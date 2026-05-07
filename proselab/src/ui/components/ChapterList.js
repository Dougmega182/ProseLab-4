// src/ui/components/ChapterList.js

import { Component } from '../component.js';

export class ChapterList extends Component {
  constructor(props) {
    super(props);
    this.draggedId = null;
  }

  template() {
    const { chapters = [], activeChapterId = null, projectTitle = '' } = this.props;

    return `
      <div class="chapter-list">
        <div class="chapter-list-header">
          <button class="btn-icon btn-sm" id="btn-back-dashboard" title="Back to Dashboard">←</button>
          <h3 class="chapter-list-title" title="${this.escapeAttr(projectTitle)}">${this.escapeHtml(projectTitle)}</h3>
          <button class="btn-icon btn-sm" id="btn-project-settings" title="Project Settings">⚙</button>
        </div>

        <div class="chapter-list-actions">
          <button class="btn btn-sm btn-primary" id="btn-add-chapter" style="width:100%">+ Add Chapter</button>
        </div>

        <div class="chapter-list-items" id="chapter-list-items">
          ${chapters.length === 0 ? `
            <div class="chapter-list-empty">
              <p>No chapters yet.</p>
            </div>
          ` : chapters.map((ch, i) => this.renderChapterItem(ch, i, activeChapterId)).join('')}
        </div>

        <div class="chapter-list-footer">
          <div class="project-stats">
            <span>${this.getTotalWords(chapters).toLocaleString()} words</span>
            <span>${chapters.length} chapter${chapters.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>
    `;
  }

  renderChapterItem(chapter, index, activeId) {
    const isActive = chapter.id === activeId;
    const wordCount = this.countWords(chapter.content);
    const status = chapter.status || 'draft';
    const statusIcons = {
      draft: '📝',
      'in-progress': '✏️',
      revision: '🔄',
      complete: '✅'
    };

    return `
      <div class="chapter-item ${isActive ? 'active' : ''}" 
           data-chapter-id="${chapter.id}" 
           draggable="true"
           data-chapter-index="${index}">
        <div class="chapter-item-drag-handle" title="Drag to reorder">⠿</div>
        <div class="chapter-item-content">
          <div class="chapter-item-title">
            <span class="chapter-item-number">${index + 1}.</span>
            <span class="chapter-item-name">${this.escapeHtml(chapter.title || 'Untitled')}</span>
          </div>
          <div class="chapter-item-meta">
            <span class="chapter-status" title="${status}">${statusIcons[status] || '📝'}</span>
            <span class="chapter-words">${wordCount.toLocaleString()} words</span>
          </div>
        </div>
        <button class="btn-icon btn-xs chapter-item-menu" data-chapter-menu="${chapter.id}">⋮</button>
      </div>
    `;
  }

  afterMount() {
    // Select chapter
    this.on(this.el, 'click', (e) => {
      const item = e.target.closest('.chapter-item');
      if (item && !e.target.closest('.chapter-item-menu') && !e.target.closest('.chapter-item-drag-handle')) {
        this.emit('select-chapter', { id: item.dataset.chapterId });
      }
    });

    // Add chapter
    this.on(this.el, 'click', (e) => {
      if (e.target.closest('#btn-add-chapter')) {
        this.emit('add-chapter');
      }
    });

    // Back to dashboard
    this.on(this.el, 'click', (e) => {
      if (e.target.closest('#btn-back-dashboard')) {
        this.emit('back-to-dashboard');
      }
    });

    // Project settings
    this.on(this.el, 'click', (e) => {
      if (e.target.closest('#btn-project-settings')) {
        this.emit('project-settings');
      }
    });

    // Chapter context menu
    this.on(this.el, 'click', (e) => {
      const menuBtn = e.target.closest('[data-chapter-menu]');
      if (menuBtn) {
        e.stopPropagation();
        this.showChapterMenu(menuBtn.dataset.chapterMenu, menuBtn);
      }
    });

    // Drag and drop for reordering
    const listContainer = this.$('#chapter-list-items');
    if (listContainer) {
      this.on(listContainer, 'dragstart', (e) => {
        const item = e.target.closest('.chapter-item');
        if (item) {
          this.draggedId = item.dataset.chapterId;
          item.classList.add('dragging');
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', item.dataset.chapterId);
        }
      });

      this.on(listContainer, 'dragend', (e) => {
        const item = e.target.closest('.chapter-item');
        if (item) {
          item.classList.remove('dragging');
          this.draggedId = null;
        }
        // Remove all drag-over indicators
        listContainer.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
      });

      this.on(listContainer, 'dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const item = e.target.closest('.chapter-item');
        if (item && item.dataset.chapterId !== this.draggedId) {
          listContainer.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
          item.classList.add('drag-over');
        }
      });

      this.on(listContainer, 'dragleave', (e) => {
        const item = e.target.closest('.chapter-item');
        if (item) {
          item.classList.remove('drag-over');
        }
      });

      this.on(listContainer, 'drop', (e) => {
        e.preventDefault();
        const targetItem = e.target.closest('.chapter-item');
        if (targetItem && this.draggedId && targetItem.dataset.chapterId !== this.draggedId) {
          const fromIndex = parseInt(this.el.querySelector(`[data-chapter-id="${this.draggedId}"]`)?.dataset.chapterIndex);
          const toIndex = parseInt(targetItem.dataset.chapterIndex);
          if (!isNaN(fromIndex) && !isNaN(toIndex)) {
            this.emit('reorder-chapters', { fromIndex, toIndex });
          }
        }
        listContainer.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        this.draggedId = null;
      });
    }
  }

  showChapterMenu(chapterId, anchorEl) {
    const existing = document.querySelector('.context-menu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.innerHTML = `
      <button class="context-menu-item" data-action="rename">✏️ Rename</button>
      <button class="context-menu-item" data-action="duplicate">📋 Duplicate</button>
      <div class="context-menu-separator"></div>
      <button class="context-menu-item" data-action="status-draft">📝 Mark as Draft</button>
      <button class="context-menu-item" data-action="status-in-progress">✏️ Mark In Progress</button>
      <button class="context-menu-item" data-action="status-revision">🔄 Mark for Revision</button>
      <button class="context-menu-item" data-action="status-complete">✅ Mark Complete</button>
      <div class="context-menu-separator"></div>
      <button class="context-menu-item" data-action="move-up">⬆ Move Up</button>
      <button class="context-menu-item" data-action="move-down">⬇ Move Down</button>
      <div class="context-menu-separator"></div>
      <button class="context-menu-item danger" data-action="delete">🗑 Delete</button>
    `;

    const rect = anchorEl.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = `${rect.bottom + 4}px`;
    menu.style.left = `${rect.right}px`;
    menu.style.zIndex = '9999';

    document.body.appendChild(menu);

    // Ensure menu stays in viewport
    requestAnimationFrame(() => {
      const menuRect = menu.getBoundingClientRect();
      if (menuRect.right > window.innerWidth) {
        menu.style.left = `${rect.left - menuRect.width}px`;
      }
      if (menuRect.bottom > window.innerHeight) {
        menu.style.top = `${rect.top - menuRect.height}px`;
      }
    });

    const handleClick = (e) => {
      const item = e.target.closest('.context-menu-item');
      if (item) {
        const action = item.dataset.action;
        if (action.startsWith('status-')) {
          this.emit('chapter-status', { id: chapterId, status: action.replace('status-', '') });
        } else {
          this.emit('chapter-action', { action, id: chapterId });
        }
      }
      menu.remove();
      document.removeEventListener('click', handleClick);
    };

    setTimeout(() => {
      document.addEventListener('click', handleClick);
    }, 10);
  }

  getTotalWords(chapters) {
    return chapters.reduce((sum, ch) => sum + this.countWords(ch.content), 0);
  }

  countWords(text) {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  escapeAttr(str) {
    return this.escapeHtml(str).replace(/'/g, '&#39;');
  }
}
