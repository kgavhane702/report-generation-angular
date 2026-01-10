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
});


