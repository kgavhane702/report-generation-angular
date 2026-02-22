import { TableWidgetComponent } from './table-widget.component';

describe('TableWidgetComponent - resize constraint helpers', () => {
  it('computeOwnerBoundaryIndexForSharedAbs maps shared boundary to nearest owner boundary index', () => {
    const c = Object.create(TableWidgetComponent.prototype) as any;

    const tableEl = document.createElement('div');
    const grid = document.createElement('div');
    grid.setAttribute('data-owner-leaf', 'A');
    tableEl.appendChild(grid);

    c.getTableElement = () => tableEl;
    c.getTableRect = () => ({ left: 0, top: 0, width: 200, height: 100 } as DOMRect);
    spyOn(tableEl, 'querySelector').and.callFake((selector: string) => {
      if (selector.includes('data-owner-leaf="A"')) return grid;
      return null;
    });
    spyOn(grid, 'getBoundingClientRect').and.returnValue({
      left: 50,
      top: 10,
      width: 100,
      height: 40,
      right: 150,
      bottom: 50,
      x: 50,
      y: 10,
      toJSON: () => ({}),
    } as DOMRect);

    c.getSplitColFractions = () => [0.2, 0.3, 0.5];

    // Shared abs = 0.49 projects to within ~0.48 in this grid, nearest boundary is 0.5 => index 2.
    const idx = c.computeOwnerBoundaryIndexForSharedAbs('col', 'A', { split: { cols: 3, rows: 1 } }, 0.49);
    expect(idx).toBe(2);
  });

  it('computeMinTopLevelRowHeightPx returns base min when container is unavailable', () => {
    const c = Object.create(TableWidgetComponent.prototype) as any;

    c.minRowPx = 24;
    c.localRows = () => [{ id: 'r0', cells: [{ id: 'a', contentHtml: '<div>A</div>' }] }];
    c.getTopLevelRowCount = (rows: any[]) => rows.length;
    c.getTopLevelColCount = (rows: any[]) => rows[0].cells.length;
    c.tableContainer = undefined;

    const min = c.computeMinTopLevelRowHeightPx(0, [40], 1);
    expect(min).toBe(24);
  });

  it('computeMinSplitAdjacentRowHeightsPx returns base mins when split grid element is unavailable', () => {
    const c = Object.create(TableWidgetComponent.prototype) as any;

    c.minSplitRowPx = 18;
    c.normalizeFractions = (arr: number[], count: number) =>
      arr.length === count ? arr : Array.from({ length: count }, () => 1 / count);
    c.parseLeafId = (id: string) => {
      const p = id.split('-').map(Number);
      return { row: p[0], col: p[1], path: p.slice(2) };
    };
    c.getTableElement = () => null;

    const ownerCell = {
      split: {
        rows: 2,
        cols: 1,
        rowFractions: [0.6, 0.4],
        cells: [{ id: 'c0', contentHtml: '' }, { id: 'c1', contentHtml: '' }],
      },
    };

    const mins = c.computeMinSplitAdjacentRowHeightsPx('0-0', ownerCell, 1, 100, 1);
    expect(mins.minTopPx).toBe(18);
    expect(mins.minBottomPx).toBe(18);
  });

  it('computeMinSplitAdjacentRowHeightsPx raises minTopPx for visible non-empty leaf content', () => {
    const c = Object.create(TableWidgetComponent.prototype) as any;

    c.minSplitRowPx = 18;
    c.normalizeFractions = (arr: number[], count: number) => {
      if (arr.length !== count) return Array.from({ length: count }, () => 1 / count);
      const sum = arr.reduce((a, b) => a + b, 0);
      return arr.map((x) => x / sum);
    };
    c.parseLeafId = (id: string) => {
      const parts = id.split('-').map(Number);
      return { row: parts[0], col: parts[1], path: parts.slice(2) };
    };
    c.normalizeEditorHtmlForModel = (html: string) => (html ?? '').trim();

    const tableEl = document.createElement('div');
    const gridEl = document.createElement('div');
    gridEl.className = 'table-widget__split-grid';
    gridEl.setAttribute('data-owner-leaf', '0-0');

    const splitLeaf = document.createElement('div');
    splitLeaf.className = 'table-widget__cell--split-leaf';
    const editor = document.createElement('div');
    editor.className = 'table-widget__cell-editor';
    editor.setAttribute('data-leaf', '0-0-0');
    editor.innerHTML = '<div>Text</div>';

    Object.defineProperty(editor, 'scrollHeight', { value: 80, configurable: true });
    Object.defineProperty(editor, 'offsetHeight', { value: 80, configurable: true });
    spyOn(editor, 'getBoundingClientRect').and.returnValue({
      left: 0,
      top: 0,
      width: 50,
      height: 80,
      right: 50,
      bottom: 80,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    spyOn(splitLeaf, 'getBoundingClientRect').and.returnValue({
      left: 0,
      top: 0,
      width: 50,
      height: 40,
      right: 50,
      bottom: 40,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    splitLeaf.appendChild(editor);
    gridEl.appendChild(splitLeaf);
    tableEl.appendChild(gridEl);

    c.getTableElement = () => tableEl;

    const ownerCell = {
      split: {
        rows: 2,
        cols: 1,
        rowFractions: [0.6, 0.4],
        cells: [{ id: 'c0', contentHtml: '<div>x</div>' }, { id: 'c1', contentHtml: '' }],
      },
    };

    const mins = c.computeMinSplitAdjacentRowHeightsPx('0-0', ownerCell, 1, 100, 1);

    expect(mins.minTopPx).toBeGreaterThan(18);
    expect(mins.minBottomPx).toBe(18);
  });
});
