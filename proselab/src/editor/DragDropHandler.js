export class DragDropHandler {
  constructor(editor) {
    this.editor = editor;
    this.draggedBlock = null;
    this.placeholder = null;
    this.init();
  }

  init() {
    this.editor.el.addEventListener('dragstart', (e) => this.onDragStart(e));
    this.editor.el.addEventListener('dragover', (e) => this.onDragOver(e));
    this.editor.el.addEventListener('dragend', (e) => this.onDragEnd(e));

    this.editor.el.addEventListener('drop', (e) => this.onDrop(e));

    // File drop support
    this.editor.el.addEventListener('dragover', (e) => {
      if (e.dataTransfer && e.dataTransfer.types.includes('Files')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        this.editor.el.classList.add('rte-file-dragover');
      }
    });

    this.editor.el.addEventListener('dragleave', (e) => {
      if (!this.editor.el.contains(e.relatedTarget)) {
        this.editor.el.classList.remove('rte-file-dragover');
      }
    });

    this.editor.el.addEventListener('drop', (e) => {
      this.editor.el.classList.remove('rte-file-dragover');
      if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        e.preventDefault();
        this.handleFileDrop(e.dataTransfer.files);
      }
    });
  }

  onDragStart(e) {
    const handle = e.target.closest('.rte-drag-handle');
    if (!handle) return;

    const block = handle.closest('[data-rte-block]');
    if (!block) return;

    this.draggedBlock = block;
    block.classList.add('rte-dragging');

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');

    // Create placeholder
    this.placeholder = document.createElement('div');
    this.placeholder.className = 'rte-drop-placeholder';
    this.placeholder.style.height = block.offsetHeight + 'px';
  }

  onDragOver(e) {
    if (!this.draggedBlock) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const target = this.getDropTarget(e);
    if (!target || target === this.draggedBlock) return;

    const rect = target.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;

    if (e.clientY < midY) {
      target.parentNode.insertBefore(this.placeholder, target);
    } else {
      target.parentNode.insertBefore(this.placeholder, target.nextSibling);
    }
  }

  onDragEnd(e) {
    if (this.draggedBlock) {
      this.draggedBlock.classList.remove('rte-dragging');
    }
    if (this.placeholder && this.placeholder.parentNode) {
      this.placeholder.parentNode.removeChild(this.placeholder);
    }
    this.draggedBlock = null;
    this.placeholder = null;
  }

  onDrop(e) {
    if (!this.draggedBlock || !this.placeholder || !this.placeholder.parentNode) return;
    e.preventDefault();

    this.placeholder.parentNode.insertBefore(this.draggedBlock, this.placeholder);
    this.placeholder.parentNode.removeChild(this.placeholder);

    this.draggedBlock.classList.remove('rte-dragging');
    this.draggedBlock = null;
    this.placeholder = null;

    this.editor.saveState();
  }

  getDropTarget(e) {
    const blocks = this.editor.el.querySelectorAll('[data-rte-block]');
    let closest = null;
    let closestDist = Infinity;

    blocks.forEach(block => {
      if (block === this.draggedBlock) return;
      const rect = block.getBoundingClientRect();
      const dist = Math.abs(e.clientY - (rect.top + rect.height / 2));
      if (dist < closestDist) {
        closestDist = dist;
        closest = block;
      }
    });

    return closest;
  }

  handleFileDrop(files) {
    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        this.handleImageFile(file);
      }
    });
  }

  handleImageFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = document.createElement('img');
      img.src = e.target.result;
      img.alt = file.name;
      img.style.maxWidth = '100%';

      const figure = document.createElement('figure');
      figure.className = 'rte-image-block';
      figure.setAttribute('data-rte-block', 'true');
      figure.contentEditable = 'false';
      figure.appendChild(img);

      const caption = document.createElement('figcaption');
      caption.contentEditable = 'true';
      caption.setAttribute('placeholder', 'Add a caption...');
      caption.innerHTML = '<br>';
      figure.appendChild(caption);

      const block = this.editor.getCurrentBlock();
      if (block) {
        block.parentNode.insertBefore(figure, block.nextSibling);
      } else {
        this.editor.el.appendChild(figure);
      }

      this.editor.saveState();
      this.editor.emit('imageInserted', { file, element: figure });
    };
    reader.readAsDataURL(file);
  }
}


// ============================================================
// History Manager (Undo/Redo)
// ============================================================

