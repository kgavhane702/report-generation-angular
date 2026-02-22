import { TableWidgetComponent } from './table-widget.component';

describe('TableWidgetComponent - merge normalization (coveredBy rebuild)', () => {
  const makeLocalRowsSignal = (initialRows: any[]) => {
    let rows = initialRows;
    const localRowsFn: any = () => rows;
    localRowsFn.update = (updater: (r: any[]) => any[]) => {
      rows = updater(rows);
    };
    return { localRowsFn, getRows: () => rows };
  };

  const makeBaseComponentForMergeSplit = (initialRows: any[]) => {
    const c = Object.create(TableWidgetComponent.prototype) as any;
    const { localRowsFn, getRows } = makeLocalRowsSignal(initialRows);

    c.localRows = localRowsFn;
    c.cloneRows = (inputRows: any[]) => JSON.parse(JSON.stringify(inputRows));
    c.emitPropsChange = () => {};
    c.cdr = { markForCheck: () => {} };
    c.scheduleRecomputeResizeSegments = () => {};
    c.setSelection = () => {};
    c.syncCellContent = () => {};
    c.toolbarService = { setActiveCell: () => {} };
    c.widget = { id: 'w1' };
    c.rowsAtEditStart = [];

    return { c, getRows };
  };

  it('rebuildTopLevelCoveredBy repairs stale coveredBy so merged cells do not render twice', () => {
    const c = Object.create(TableWidgetComponent.prototype) as any;

    // Minimal helper needed by rebuildTopLevelCoveredBy
    c.getTopLevelColCount = (rows: any[]) =>
      Math.max(0, ...((rows ?? []).map((r) => (Array.isArray(r?.cells) ? r.cells.length : 0)) as number[]));

    const rows: any[] = [
      {
        id: 'r0',
        cells: [
          { id: 'a', contentHtml: '<div>a</div>' },
          // Anchor merge across B+C (colSpan=2)
          { id: 'b', contentHtml: '<div>b</div>', merge: { rowSpan: 1, colSpan: 2 } },
          // BUGGY STATE: this should be coveredBy B but is not (would render twice)
          { id: 'c', contentHtml: '<div>c</div>' },
        ],
      },
    ];

    c.rebuildTopLevelCoveredBy(rows);

    expect(rows[0].cells[2].coveredBy).toEqual({ row: 0, col: 1 });
    expect(rows[0].cells[2].contentHtml).toBe('');
    expect(rows[0].cells[2].merge).toBeUndefined();
    expect(rows[0].cells[2].split).toBeUndefined();
  });

  it('rebuildSplitCoveredBy repairs stale coveredBy inside split grids', () => {
    const c = Object.create(TableWidgetComponent.prototype) as any;

    const owner: any = {
      id: 'owner',
      contentHtml: '',
      split: {
        rows: 1,
        cols: 2,
        cells: [
          // Anchor merge across both split columns
          { id: 'b', contentHtml: '<div>b</div>', merge: { rowSpan: 1, colSpan: 2 } },
          // BUGGY STATE: should be coveredBy (0,0) but is not
          { id: 'c', contentHtml: '<div>c</div>' },
        ],
      },
    };

    c.rebuildSplitCoveredBy(owner);

    expect(owner.split.cells[1].coveredBy).toEqual({ row: 0, col: 0 });
    expect(owner.split.cells[1].contentHtml).toBe('');
    expect(owner.split.cells[1].merge).toBeUndefined();
    expect(owner.split.cells[1].split).toBeUndefined();
  });

  it('canMergeAcrossSplitParents allows mixed split and non-split parent selections', () => {
    const c = Object.create(TableWidgetComponent.prototype) as any;

    const rows: any[] = [
      {
        id: 'r0',
        cells: [
          {
            id: 'left',
            contentHtml: '',
            split: {
              rows: 1,
              cols: 2,
              cells: [
                { id: 'l0', contentHtml: '<div>L0</div>' },
                { id: 'l1', contentHtml: '<div>L1</div>' },
              ],
            },
          },
          {
            id: 'right',
            contentHtml: '<div>R</div>',
          },
        ],
      },
    ];

    c.localRows = () => rows;

    const ok = c.canMergeAcrossSplitParents([
      { row: 0, col: 0, path: [1] },
      { row: 0, col: 1, path: [] },
    ]);

    expect(ok).toBe(true);
  });

  it('normalizeSelection removes ancestor paths when nested split siblings are selected', () => {
    const c = Object.create(TableWidgetComponent.prototype) as any;

    const rows: any[] = [
      {
        id: 'r0',
        cells: [
          {
            id: 'root',
            contentHtml: '',
            split: {
              rows: 1,
              cols: 2,
              cells: [
                {
                  id: 'left-parent',
                  contentHtml: '',
                  split: {
                    rows: 1,
                    cols: 2,
                    cells: [
                      { id: 'left-a', contentHtml: '<div>A</div>' },
                      { id: 'left-b', contentHtml: '<div>B</div>' },
                    ],
                  },
                },
                { id: 'right', contentHtml: '<div>R</div>' },
              ],
            },
          },
        ],
      },
    ];

    c.localRows = () => rows;

    const normalized: Set<string> = c.normalizeSelection(new Set(['0-0-0', '0-0-0-0', '0-0-0-1']));

    expect(Array.from(normalized).sort()).toEqual(['0-0-0-0', '0-0-0-1']);
  });

  it('mergeWithinSplitGrid collapses fully-merged nested split and keeps canonical leaf id level', () => {
    const c = Object.create(TableWidgetComponent.prototype) as any;

    let rows: any[] = [
      {
        id: 'r0',
        cells: [
          {
            id: 'base',
            contentHtml: '',
            split: {
              rows: 1,
              cols: 1,
              cells: [
                {
                  id: 'nested-owner',
                  contentHtml: '',
                  split: {
                    rows: 2,
                    cols: 2,
                    cells: [
                      { id: 'a', contentHtml: '<div>A</div>' },
                      { id: 'b', contentHtml: '<div>B</div>' },
                      { id: 'c', contentHtml: '<div>C</div>' },
                      { id: 'd', contentHtml: '<div>D</div>' },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    ];

    const localRowsFn: any = () => rows;
    localRowsFn.update = (updater: (r: any[]) => any[]) => {
      rows = updater(rows);
    };

    c.localRows = localRowsFn;
    c.emitPropsChange = () => {};
    c.cdr = { markForCheck: () => {} };

    let selected: Set<string> | null = null;
    c.setSelection = (s: Set<string>) => {
      selected = s;
    };

    c.mergeWithinSplitGrid([
      { row: 0, col: 0, path: [0, 0] },
      { row: 0, col: 0, path: [0, 1] },
      { row: 0, col: 0, path: [0, 2] },
      { row: 0, col: 0, path: [0, 3] },
    ]);

    // Nested owner split should collapse after full-grid merge.
    expect(rows[0].cells[0].split.cells[0].split).toBeUndefined();
    // Selection should point to collapsed owner path (0), not redundant 0-0.
    const selectedIds = selected ? Array.from(selected) : [];
    expect(selectedIds).toEqual(['0-0-0']);
  });

  it('split on a top-level merged anchor with matching dimensions restores top-level cells (no nested split ids)', () => {
    const c = Object.create(TableWidgetComponent.prototype) as any;

    let rows: any[] = [
      {
        id: 'r0',
        cells: [
          { id: '0,0', contentHtml: '<div>A</div>' },
          { id: '0,1', contentHtml: '<div>M</div>', merge: { rowSpan: 1, colSpan: 2 } },
          { id: '0,2', contentHtml: '', coveredBy: { row: 0, col: 1 } },
        ],
      },
    ];

    const localRowsFn: any = () => rows;
    localRowsFn.update = (updater: (r: any[]) => any[]) => {
      rows = updater(rows);
    };

    c.localRows = localRowsFn;
    c.selectedCells = () => new Set<string>(['0-1']);
    c.activeCellId = null;
    c.syncCellContent = () => {};
    c.parseLeafId = (leafId: string) => {
      const parts = leafId.split('-');
      if (parts.length < 2) return null;
      const row = Number(parts[0]);
      const col = Number(parts[1]);
      if (!Number.isFinite(row) || !Number.isFinite(col)) return null;
      const path: number[] = [];
      for (const p of parts.slice(2)) {
        const n = Number(p);
        if (!Number.isFinite(n)) return null;
        path.push(n);
      }
      return { row, col, path };
    };
    c.getCellAtPath = (root: any, path: number[]) => {
      let current = root;
      for (const idx of path) {
        current = current?.split?.cells?.[idx];
        if (!current) return null;
      }
      return current;
    };
    c.cloneRows = (inputRows: any[]) => JSON.parse(JSON.stringify(inputRows));
    c.rebuildTopLevelCoveredBy = (nextRows: any[]) => {
      for (const row of nextRows) {
        for (const cell of row?.cells ?? []) {
          if (cell) cell.coveredBy = undefined;
        }
      }
      for (let r = 0; r < nextRows.length; r++) {
        const row = nextRows[r];
        for (let cIdx = 0; cIdx < (row?.cells?.length ?? 0); cIdx++) {
          const anchor = row.cells[cIdx];
          if (!anchor?.merge) continue;
          const rs = Math.max(1, Math.trunc(anchor.merge.rowSpan ?? 1));
          const cs = Math.max(1, Math.trunc(anchor.merge.colSpan ?? 1));
          for (let rr = r; rr < r + rs; rr++) {
            for (let cc = cIdx; cc < cIdx + cs; cc++) {
              if (rr === r && cc === cIdx) continue;
              const covered = nextRows?.[rr]?.cells?.[cc];
              if (covered) covered.coveredBy = { row: r, col: cIdx };
            }
          }
        }
      }
    };
    c.getTopLevelColCount = (arr: any[]) => Math.max(0, ...arr.map((r: any) => (r?.cells?.length ?? 0)));
    c.emitPropsChange = () => {};
    c.rowsAtEditStart = [];
    c.toolbarService = { setActiveCell: () => {} };
    c.widget = { id: 'w1' };
    c.cdr = { markForCheck: () => {} };
    c.maxSplitDepth = 4;

    c.applySplitToSelection({ rows: 1, cols: 2 });

    expect(rows[0].cells[1].merge).toBeUndefined();
    expect(rows[0].cells[1].split).toBeUndefined();
    expect(rows[0].cells[2].coveredBy).toBeUndefined();
  });

  it('mergeTopLevelCells merges adjacent rectangular top-level selection', () => {
    const { c, getRows } = makeBaseComponentForMergeSplit([
      {
        id: 'r0',
        cells: [
          { id: 'a', contentHtml: '<div>A</div>' },
          { id: 'b', contentHtml: '<div>B</div>' },
          { id: 'c', contentHtml: '<div>C</div>' },
        ],
      },
    ]);

    c.mergeTopLevelCells([
      { row: 0, col: 1 },
      { row: 0, col: 2 },
    ]);

    const rows = getRows();
    expect(rows[0].cells[1].merge).toEqual({ rowSpan: 1, colSpan: 2 });
    expect(rows[0].cells[2].coveredBy).toEqual({ row: 0, col: 1 });
  });

  it('mergeTopLevelCells rejects non-rectangular top-level selection (diagonal)', () => {
    const { c, getRows } = makeBaseComponentForMergeSplit([
      {
        id: 'r0',
        cells: [
          { id: 'a', contentHtml: '<div>A</div>' },
          { id: 'b', contentHtml: '<div>B</div>' },
        ],
      },
      {
        id: 'r1',
        cells: [
          { id: 'c', contentHtml: '<div>C</div>' },
          { id: 'd', contentHtml: '<div>D</div>' },
        ],
      },
    ]);

    c.mergeTopLevelCells([
      { row: 0, col: 0 },
      { row: 1, col: 1 },
    ]);

    const rows = getRows();
    expect(rows[0].cells[0].merge).toBeUndefined();
    expect(rows[1].cells[1].coveredBy).toBeUndefined();
  });

  it('mergeTopLevelCells expands through existing merge anchors when selection includes covered cells', () => {
    const { c, getRows } = makeBaseComponentForMergeSplit([
      {
        id: 'r0',
        cells: [
          { id: 'a', contentHtml: '<div>A</div>', merge: { rowSpan: 1, colSpan: 2 } },
          { id: 'a_cov', contentHtml: '', coveredBy: { row: 0, col: 0 } },
          { id: 'c', contentHtml: '<div>C</div>' },
        ],
      },
    ]);

    c.mergeTopLevelCells([
      { row: 0, col: 1 },
      { row: 0, col: 2 },
    ]);

    const rows = getRows();
    expect(rows[0].cells[0].merge).toEqual({ rowSpan: 1, colSpan: 3 });
    expect(rows[0].cells[1].coveredBy).toEqual({ row: 0, col: 0 });
    expect(rows[0].cells[2].coveredBy).toEqual({ row: 0, col: 0 });
  });

  it('mergeWithinSplitGrid merges a sub-rectangle without collapsing owner split', () => {
    const { c, getRows } = makeBaseComponentForMergeSplit([
      {
        id: 'r0',
        cells: [
          {
            id: 'base',
            contentHtml: '',
            split: {
              rows: 2,
              cols: 2,
              cells: [
                { id: 'a', contentHtml: '<div>A</div>' },
                { id: 'b', contentHtml: '<div>B</div>' },
                { id: 'c', contentHtml: '<div>C</div>' },
                { id: 'd', contentHtml: '<div>D</div>' },
              ],
            },
          },
        ],
      },
    ]);

    c.mergeWithinSplitGrid([
      { row: 0, col: 0, path: [0] },
      { row: 0, col: 0, path: [1] },
    ]);

    const rows = getRows();
    const owner = rows[0].cells[0];
    expect(owner.split).toBeTruthy();
    expect(owner.split.cells[0].merge).toEqual({ rowSpan: 1, colSpan: 2 });
    expect(owner.split.cells[1].coveredBy).toEqual({ row: 0, col: 0 });
  });

  it('mergeWithinSplitGrid canonicalizes selection to top-level covered cell id for exact merged tile', () => {
    const { c, getRows } = makeBaseComponentForMergeSplit([
      {
        id: 'r0',
        cells: [{ id: '0,0', contentHtml: '' }, { id: '0,1', contentHtml: '' }, { id: '0,2', contentHtml: '' }],
      },
      {
        id: 'r1',
        cells: [{ id: '1,0', contentHtml: '' }, { id: '1,1', contentHtml: '' }, { id: '1,2', contentHtml: '' }],
      },
      {
        id: 'r2',
        cells: [
          { id: '2,0', contentHtml: '' },
          {
            id: '2,1',
            contentHtml: '',
            merge: { rowSpan: 1, colSpan: 2 },
            split: {
              rows: 2,
              cols: 2,
              cells: [
                { id: 'a', contentHtml: '<div>A</div>' },
                { id: 'b', contentHtml: '<div>B</div>' },
                { id: 'c', contentHtml: '<div>C</div>' },
                { id: 'd', contentHtml: '<div>D</div>' },
              ],
            },
          },
          { id: '2,2', contentHtml: '', coveredBy: { row: 2, col: 1 } },
        ],
      },
    ]);

    let selected: Set<string> | null = null;
    c.setSelection = (s: Set<string>) => {
      selected = s;
    };

    // Merge right-column leaves in the 2x2 split: indices 1 and 3.
    c.mergeWithinSplitGrid([
      { row: 2, col: 1, path: [1] },
      { row: 2, col: 1, path: [3] },
    ]);

    const rows = getRows();
    const owner = rows[2].cells[1];
    expect(owner.split).toBeTruthy();
    expect(owner.split.cells[1].merge).toEqual({ rowSpan: 2, colSpan: 1 });

    // Canonical id should map to the original covered top-level cell (2-2), not nested 2-1-1.
    const selectedIds = selected ? Array.from(selected) : [];
    expect(selectedIds).toEqual(['2-2']);
  });

  it('computeCanMergeSelection rejects mixed-depth split selections under same top-level cell', () => {
    const c = Object.create(TableWidgetComponent.prototype) as any;

    c.localRows = () => [
      {
        id: 'r0',
        cells: [
          {
            id: 'base',
            contentHtml: '',
            split: {
              rows: 1,
              cols: 2,
              cells: [
                {
                  id: 'nested',
                  contentHtml: '',
                  split: {
                    rows: 1,
                    cols: 2,
                    cells: [
                      { id: 'x', contentHtml: '<div>X</div>' },
                      { id: 'y', contentHtml: '<div>Y</div>' },
                    ],
                  },
                },
                { id: 'z', contentHtml: '<div>Z</div>' },
              ],
            },
          },
        ],
      },
    ];

    const ok = c.computeCanMergeSelection(new Set(['0-0-0', '0-0-0-1']));
    expect(ok).toBe(false);
  });

  it('applySplitToSelection creates split for a plain top-level cell and moves content to first child', () => {
    const { c, getRows } = makeBaseComponentForMergeSplit([
      {
        id: 'r0',
        cells: [{ id: 'a', contentHtml: '<div>A</div>', style: { fontSize: '12px' } }],
      },
    ]);

    c.maxSplitDepth = 4;
    c.selectedCells = () => new Set<string>(['0-0']);
    c.activeCellId = null;

    c.applySplitToSelection({ rows: 1, cols: 2 });

    const rows = getRows();
    const cell = rows[0].cells[0];
    expect(cell.split).toBeTruthy();
    expect(cell.split.rows).toBe(1);
    expect(cell.split.cols).toBe(2);
    expect(cell.split.cells[0].contentHtml).toContain('A');
    expect(cell.contentHtml).toBe('');
  });

  it('applySplitToSelection ignores covered top-level cells', () => {
    const { c, getRows } = makeBaseComponentForMergeSplit([
      {
        id: 'r0',
        cells: [
          { id: 'a', contentHtml: '<div>A</div>', merge: { rowSpan: 1, colSpan: 2 } },
          { id: 'b', contentHtml: '', coveredBy: { row: 0, col: 0 } },
        ],
      },
    ]);

    c.maxSplitDepth = 4;
    c.selectedCells = () => new Set<string>(['0-1']);
    c.activeCellId = null;

    c.applySplitToSelection({ rows: 1, cols: 2 });

    const rows = getRows();
    expect(rows[0].cells[1].split).toBeUndefined();
    expect(rows[0].cells[1].coveredBy).toEqual({ row: 0, col: 0 });
  });

  it('applySplitToSelection respects maxSplitDepth and skips deeper split', () => {
    const { c, getRows } = makeBaseComponentForMergeSplit([
      {
        id: 'r0',
        cells: [
          {
            id: 'a',
            contentHtml: '',
            split: {
              rows: 1,
              cols: 1,
              cells: [{ id: 'leaf', contentHtml: '<div>L</div>' }],
            },
          },
        ],
      },
    ]);

    c.maxSplitDepth = 1;
    c.selectedCells = () => new Set<string>(['0-0-0']);
    c.activeCellId = null;

    c.applySplitToSelection({ rows: 1, cols: 2 });

    const rows = getRows();
    expect(rows[0].cells[0].split.cells[0].split).toBeUndefined();
  });

  it('split on merged top-level anchor with non-matching dimensions creates nested split (no top-level unmerge)', () => {
    const { c, getRows } = makeBaseComponentForMergeSplit([
      {
        id: 'r0',
        cells: [
          { id: 'a', contentHtml: '<div>M</div>', merge: { rowSpan: 1, colSpan: 2 } },
          { id: 'b', contentHtml: '', coveredBy: { row: 0, col: 0 } },
        ],
      },
    ]);

    c.maxSplitDepth = 4;
    c.selectedCells = () => new Set<string>(['0-0']);
    c.activeCellId = null;

    c.applySplitToSelection({ rows: 2, cols: 2 });

    const rows = getRows();
    expect(rows[0].cells[0].merge).toEqual({ rowSpan: 1, colSpan: 2 });
    expect(rows[0].cells[0].split).toBeTruthy();
    expect(rows[0].cells[1].coveredBy).toEqual({ row: 0, col: 0 });
  });
});


