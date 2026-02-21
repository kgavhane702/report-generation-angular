import { TableWidgetComponent } from './table-widget.component';

describe('TableWidgetComponent - merge normalization (coveredBy rebuild)', () => {
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
});


