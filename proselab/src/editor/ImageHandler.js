export class ImageHandler {
  constructor(editor) {
    this.editor = editor;
    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.accept = 'image/*';
    this.fileInput.style.display = 'none';
    this.fileInput.addEventListener('change', (e) => this.handleFile(e));
    document.body.appendChild(this.fileInput);

    this.setupPasteHandler();
    this.setupDropHandler();
  }

  trigger() {
    this.fileInput.click();
  }

  handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    this.insertImage(file);
    this.fileInput.value = '';
  }

  insertImage(file) {
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      this.editor.history.saveStateImmediate();

      const wrapper = document.createElement('figure');
      wrapper.className = 'rte-image-wrapper';
      wrapper.contentEditable = 'false';

      const img = document.createElement('img');
      img.src = e.target.result;
      img.alt = file.name;
      img.className = 'rte-image';

      // Resize handle
      const resizeHandle = document.createElement('div');
      resizeHandle.className = 'rte-image-resize-handle';

      // Caption
      const caption = document.createElement('figcaption');
      caption.contentEditable = 'true';
      caption.setAttribute('data-placeholder', 'Add a caption...');
      caption.innerHTML = '<br>';

      wrapper.appendChild(img);
      wrapper.appendChild(resizeHandle);
      wrapper.appendChild(caption);

      const sel = window.getSelection();
      if (sel.rangeCount) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(wrapper);
      } else {
        this.editor.el.appendChild(wrapper);
      }

      // Add a paragraph after if none exists
      if (!wrapper.nextSibling) {
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        this.editor.el.appendChild(p);
      }

      this.editor.history.saveState();
    };
    reader.readAsDataURL(file);
  }

  setupPasteHandler() {
    this.editor.el.addEventListener('paste', (e) => {
      const items = (e.clipboardData || e.originalEvent.clipboardData).items;
      for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          this.insertImage(file);
        }
      }
    });
  }

  setupDropHandler() {
    this.editor.el.addEventListener('drop', (e) => {
      e.preventDefault();
      const files = e.dataTransfer.files;
      if (files.length > 0 && files[0].type.startsWith('image/')) {
        this.insertImage(files[0]);
      }
    });
  }
}
