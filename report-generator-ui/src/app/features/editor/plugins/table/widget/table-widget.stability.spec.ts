import { TableWidgetComponent } from './table-widget.component';

describe('TableWidgetComponent - stability/safety regression', () => {
  const makeSignal = <T,>(initial: T) => {
    const fn: any = () => fn.value as T;
    fn.value = initial;
    fn.set = (v: T) => {
      fn.value = v;
    };
    fn.update = (updater: (v: T) => T) => {
      fn.value = updater(fn.value);
    };
    return fn;
  };

  const createBase = (initialRows: any[]) => {
    const c = Object.create(TableWidgetComponent.prototype) as any;

    const rowsSig = makeSignal<any[]>(JSON.parse(JSON.stringify(initialRows)));
    c.localRows = rowsSig;
    c.cloneRows = (rows: any[]) => JSON.parse(JSON.stringify(rows));

    c.selectedCells = makeSignal<Set<string>>(new Set());
    c.activeCellId = null;
    c.activeCellElement = null;

    c.syncCellContent = () => {};
    c.emitPropsChange = () => {};
    c.rowsAtEditStart = [];
    c.widget = { id: 'w1', size: { width: 300, height: 200 }, props: { showBorders: true } };
    c.rowFractions = makeSignal<number[]>([1]);
    c.columnFractions = makeSignal<number[]>([1]);
    c.growWidgetSizeBy = () => ({ nextWidth: c.widget.size.width, nextHeight: c.widget.size.height, appliedWidthPx: 0, appliedHeightPx: 0 });

    c.toolbarService = {
      setActiveCell: () => {},
      setSelectedCells: () => {},
      setCanMergeSelection: () => {},
    };
    c.cdr = { markForCheck: () => {} };
    c.scheduleRecomputeResizeSegments = () => {};

    return { c, getRows: () => rowsSig() };
  };

  it('handles malformed leaf IDs safely without mutation', () => {
    const { c, getRows } = createBase([
      { id: 'r0', cells: [{ id: 'a', contentHtml: '' }, { id: 'b', contentHtml: '' }] },
    ]);

    const before = JSON.stringify(getRows());
    c.selectedCells.set(new Set<string>(['bad-id', '0-x', 'foo-bar-baz']));

    expect(() => c.applySplitToSelection({ rows: 2, cols: 2 })).not.toThrow();
    expect(c.getCellModelByLeafId('bad-id')).toBeNull();
    expect(c.getCellModelByLeafId('0-x')).toBeNull();

    const after = JSON.stringify(getRows());
    expect(after).toBe(before);
  });

  it('returns null for out-of-range split path traversal without throwing', () => {
    const { c } = createBase([
      {
        id: 'r0',
        cells: [
          {
            id: 'owner',
            contentHtml: '',
            split: {
              rows: 1,
              cols: 2,
              cells: [{ id: 's0', contentHtml: '' }, { id: 's1', contentHtml: '' }],
            },
          },
        ],
      },
    ]);

    const root = c.localRows()[0].cells[0];

    expect(() => c.getCellAtPath(root, [99])).not.toThrow();
    expect(c.getCellAtPath(root, [99])).toBeNull();

    expect(() => c.getCellModelByLeafId('0-0-99')).not.toThrow();
    expect(c.getCellModelByLeafId('0-0-99')).toBeNull();
  });

  it('repeated merge/split cycles do not leave orphan merge/coveredBy metadata', () => {
    const { c, getRows } = createBase([
      { id: 'r0', cells: [{ id: 'a', contentHtml: 'A' }, { id: 'b', contentHtml: 'B' }] },
    ]);

    for (let i = 0; i < 5; i++) {
      c.selectedCells.set(new Set<string>(['0-0', '0-1']));
      c.applyMergeSelection();

      let rows = getRows();
      expect(rows[0].cells[0].merge).toEqual({ rowSpan: 1, colSpan: 2 });
      expect(rows[0].cells[1].coveredBy).toEqual({ row: 0, col: 0 });

      c.selectedCells.set(new Set<string>(['0-0']));
      c.applySplitToSelection({ rows: 1, cols: 2 });

      rows = getRows();
      expect(rows[0].cells[0].merge).toBeUndefined();
      expect(rows[0].cells[0].coveredBy).toBeUndefined();
      expect(rows[0].cells[0].split).toBeUndefined();

      expect(rows[0].cells[1].merge).toBeUndefined();
      expect(rows[0].cells[1].coveredBy).toBeUndefined();
      expect(rows[0].cells[1].split).toBeUndefined();
    }
  });

  it('large-table merge/split/insert/delete smoke completes within practical threshold', () => {
    const size = 20;
    const rows = Array.from({ length: size }, (_, r) => ({
      id: `r${r}`,
      cells: Array.from({ length: size }, (_, c2) => ({ id: `${r}-${c2}`, contentHtml: `${r},${c2}` })),
    }));

    const { c, getRows } = createBase(rows);
    c.rowFractions.set(Array.from({ length: size }, () => 1 / size));
    c.columnFractions.set(Array.from({ length: size }, () => 1 / size));

    const t0 = performance.now();

    c.selectedCells.set(new Set<string>(['5-5', '5-6', '6-5', '6-6']));
    c.applyMergeSelection();

    c.selectedCells.set(new Set<string>(['5-5']));
    c.applySplitToSelection({ rows: 2, cols: 2 });

    c.insertIntoTable('row', 'after', 10);
    c.insertIntoTable('col', 'after', 10);
    c.deleteFromTable('row', 3, 3);
    c.deleteFromTable('col', 3, 3);

    const elapsedMs = performance.now() - t0;
    const finalRows = getRows();

    expect(finalRows.length).toBe(size);
    expect(finalRows[0].cells.length).toBe(size);
    expect(elapsedMs).toBeLessThan(1500);
  });
});
