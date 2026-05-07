export class TableManager {
  constructor(editor) {
    this.editor = editor;
    this.init();
  }

  init() {
    // Delegate click events for table controls
    this.editor.el.addEventListener('click', (e) => {
      const addRowBtn = e.target.closest('.rte-table-add-row');
      const addColBtn = e.target.closest('.rte-table-add-col');
      const deleteRowBtn = e.target.closest('.rte-table-del-row');
      const deleteColBtn = e.target.closest('.rte-table-del-col');

      if (addRowBtn) { e.preventDefault(); this.addRow(addRowBtn.closest('.rte-table-wrapper')); }
      if (addColBtn) { e.preventDefault(); this.addColumn(addColBtn.closest('.rte-table-wrapper')); }
      if (deleteRowBtn) { e.preventDefault(); this.deleteRow(); }
      if (deleteColBtn) { e.preventDefault(); this.deleteColumn(); }
    });

    // Tab navigation within tables
    this.editor.el.addEventListener('keydown', (e) => {
      if (e.key === 'Tab' && this.isInTable()) {
        e.preventDefault();
        this.navigateCell(e.shiftKey ? -1 : 1);
      }
    });
  }

  createTable(rows = 3, cols = 3) {
    const wrapper = document.createElement('div');
    wrapper.className = 'rte-table-wrapper';
    wrapper.contentEditable = 'false';

    const table = document.createElement('table');
    table.className = 'rte-table';

    // Header row
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    for (let j = 0; j < cols; j++) {
      const th = document.createElement('th');
      th.contentEditable = 'true';
      th.textContent = `Header ${j + 1}`;
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body rows
    const tbody = document.createElement('tbody');
    for (let i = 0; i < rows - 1; i++) {
      const row = document.createElement('tr');
      for (let j = 0; j < cols; j++) {
        const td = document.createElement('td');
        td.contentEditable = 'true';
        td.innerHTML = '<br>';
        row.appendChild(td);
      }
      tbody.appendChild(row);
    }
    table.appendChild(tbody);

    wrapper.appendChild(

table);

    // Table controls
    const controls = document.createElement('div');
    controls.className = 'rte-table-controls';
    controls.innerHTML = `
      <button type="button" class="rte-table-add-row" title="Add row">+ Row</button>
      <button type="button" class="rte-table-add-col" title="Add column">+ Col</button>
      <button type="button" class="rte-table-del-row" title="Delete row">- Row</button>
      <button type="button" class="rte-table-del-col" title="Delete column">- Col</button>
    `;
    wrapper.appendChild(controls);

    return wrapper;
  }

  addRow(wrapper) {
    if (!wrapper) return;
    const table = wrapper.querySelector('table');
    if (!table) return;

    const tbody = table.querySelector('tbody') || table;
    const colCount = table.querySelector('tr').children.length;

    const row = document.createElement('tr');
    for (let i = 0; i < colCount; i++) {
      const td = document.createElement('td');
      td.contentEditable = 'true';
      td.innerHTML = '<br>';
      row.appendChild(td);
    }
    tbody.appendChild(row);
    this.editor.saveState();
  }

  addColumn(wrapper) {
    if (!wrapper) return;
    const table = wrapper.querySelector('table');
    if (!table) return;

    const rows = table.querySelectorAll('tr');
    rows.forEach((row, i) => {
      const cell = document.createElement(i === 0 && row.parentNode.tagName === 'THEAD' ? 'th' : 'td');
      cell.contentEditable = 'true';
      cell.innerHTML = i === 0 && row.parentNode.tagName === 'THEAD' ? 'Header' : '<br>';
      row.appendChild(cell);
    });
    this.editor.saveState();
  }

  deleteRow() {
    const cell = this.getCurrentCell();
    if (!cell) return;

    const row = cell.closest('tr');
    const table = cell.closest('table');
    if (!row || !table) return;

    const allRows = table.querySelectorAll('tr');
    if (allRows.length <= 1) return; // Don't delete last row

    row.parentNode.removeChild(row);
    this.editor.saveState();
  }

  deleteColumn() {
    const cell = this.getCurrentCell();
    if (!cell) return;

    const row = cell.closest('tr');
    const table = cell.closest('table');
    if (!row || !table) return;

    const cellIndex = Array.from(row.children).indexOf(cell);
    const colCount = row.children.length;
    if (colCount <= 1) return; // Don't delete last column

    table.querySelectorAll('tr').forEach(r => {
      if (r.children[cellIndex]) {
        r.removeChild(r.children[cellIndex]);
      }
    });
    this.editor.saveState();
  }

  isInTable() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return false;
    const node = sel.anchorNode;
    return node && node.nodeType === Node.TEXT_NODE
      ? !!node.parentElement.closest('table')
      : !!(node && node.closest && node.closest('table'));
  }

  getCurrentCell() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    let node = sel.anchorNode;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    return node ? node.closest('td, th') : null;
  }

  navigateCell(direction) {
    const cell = this.getCurrentCell();
    if (!cell) return;

    const row = cell.closest('tr');
    const table = cell.closest('table');
    if (!row || !table) return;

    const cells = Array.from(table.querySelectorAll('td, th'));
    const currentIndex = cells.indexOf(cell);
    const nextIndex = currentIndex + direction;

    if (nextIndex >= 0 && nextIndex < cells.length) {
      const nextCell = cells[nextIndex];
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(nextCell);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    } else if (direction > 0) {
      // Add a new row when tabbing past the last cell
      const wrapper = table.closest('.rte-table-wrapper');
      this.addRow(wrapper);
      const newCells = table.querySelectorAll('td, th');
      const lastRowFirstCell = newCells[newCells.length - row.children.length];
      if (lastRowFirstCell) {
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(lastRowFirstCell);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
  }
}


// ============================================================
// Clipboard Handler
// ============================================================

