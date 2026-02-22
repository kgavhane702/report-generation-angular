import { TableWidgetComponent } from './table-widget.component';

describe('TableWidgetComponent - insert/delete regression', () => {
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

    let rows = JSON.parse(JSON.stringify(initialRows));
    const localRowsFn: any = () => rows;
    localRowsFn.update = (updater: (r: any[]) => any[]) => {
      rows = updater(rows);
    };

    c.localRows = localRowsFn;
    c.cloneRows = (r: any[]) => JSON.parse(JSON.stringify(r));
    c.selectedCells = () => new Set<string>();
    c.setSelection = () => {};
    c.syncCellContent = () => {};
    c.emitPropsChange = () => {};
    c.scheduleRecomputeResizeSegments = () => {};
    c.cdr = { markForCheck: () => {} };
    c.toolbarService = { setActiveCell: () => {} };
    c.tableContainer = { nativeElement: document.createElement('div') };

    c.rowFractions = makeSignal<number[]>([1]);
    c.columnFractions = makeSignal<number[]>([1]);

    c.widget = {
      id: 'w1',
      size: { width: 300, height: 200 },
    };

    c.growWidgetSizeBy = () => ({
      nextWidth: c.widget.size.width,
      nextHeight: c.widget.size.height,
      appliedWidthPx: 0,
      appliedHeightPx: 0,
    });

    c.rowsAtEditStart = [];
    c.activeCellId = null;

    return { c, getRows: () => rows };
  };

  it('insertIntoTable inserts a row at requested index', () => {
    const { c, getRows } = createBase([
      { id: 'r0', cells: [{ id: 'a', contentHtml: '' }, { id: 'b', contentHtml: '' }] },
      { id: 'r1', cells: [{ id: 'c', contentHtml: '' }, { id: 'd', contentHtml: '' }] },
    ]);

    c.rowFractions.set([0.5, 0.5]);
    c.columnFractions.set([0.5, 0.5]);

    c.insertIntoTable('row', 'before', 1);

    const rows = getRows();
    expect(rows.length).toBe(3);
    expect(rows[1].cells.length).toBe(2);
  });

  it('insertIntoTable inserts a column at requested index', () => {
    const { c, getRows } = createBase([
      { id: 'r0', cells: [{ id: 'a', contentHtml: '' }, { id: 'b', contentHtml: '' }] },
      { id: 'r1', cells: [{ id: 'c', contentHtml: '' }, { id: 'd', contentHtml: '' }] },
    ]);

    c.rowFractions.set([0.5, 0.5]);
    c.columnFractions.set([0.5, 0.5]);

    c.insertIntoTable('col', 'before', 1);

    const rows = getRows();
    expect(rows[0].cells.length).toBe(3);
    expect(rows[1].cells.length).toBe(3);
  });

  it('insertIntoTable inserts a column after target index', () => {
    const { c, getRows } = createBase([
      { id: 'r0', cells: [{ id: 'a', contentHtml: '' }, { id: 'b', contentHtml: '' }] },
      { id: 'r1', cells: [{ id: 'c', contentHtml: '' }, { id: 'd', contentHtml: '' }] },
    ]);

    c.rowFractions.set([0.5, 0.5]);
    c.columnFractions.set([0.5, 0.5]);

    c.insertIntoTable('col', 'after', 2);

    const rows = getRows();
    expect(rows[0].cells.length).toBe(3);
    expect(rows[1].cells.length).toBe(3);
  });

  it('deleteFromTable removes selected row range and keeps at least one row', () => {
    const { c, getRows } = createBase([
      { id: 'r0', cells: [{ id: 'a', contentHtml: '' }] },
      { id: 'r1', cells: [{ id: 'b', contentHtml: '' }] },
      { id: 'r2', cells: [{ id: 'c', contentHtml: '' }] },
    ]);

    c.rowFractions.set([1 / 3, 1 / 3, 1 / 3]);
    c.columnFractions.set([1]);

    c.deleteFromTable('row', 1, 1);

    const rows = getRows();
    expect(rows.length).toBe(2);
    expect(rows[0].id).toBe('r0');
    expect(rows[1].id).toBe('r2');
  });

  it('deleteFromTable is no-op when operation would remove all columns', () => {
    const { c, getRows } = createBase([
      { id: 'r0', cells: [{ id: 'a', contentHtml: '' }] },
      { id: 'r1', cells: [{ id: 'b', contentHtml: '' }] },
    ]);

    c.rowFractions.set([0.5, 0.5]);
    c.columnFractions.set([1]);

    c.deleteFromTable('col', 0, 0);

    const rows = getRows();
    expect(rows[0].cells.length).toBe(1);
    expect(rows[1].cells.length).toBe(1);
  });

  it('deleteFromTable shrinks merge span when deleting within merged top-level range', () => {
    const { c, getRows } = createBase([
      {
        id: 'r0',
        cells: [
          { id: 'a', contentHtml: '<div>A</div>', merge: { rowSpan: 1, colSpan: 3 } },
          { id: 'b', contentHtml: '', coveredBy: { row: 0, col: 0 } },
          { id: 'c', contentHtml: '', coveredBy: { row: 0, col: 0 } },
        ],
      },
    ]);

    c.rowFractions.set([1]);
    c.columnFractions.set([1 / 3, 1 / 3, 1 / 3]);

    c.deleteFromTable('col', 1, 1);

    const rows = getRows();
    expect(rows[0].cells.length).toBe(2);
    expect(rows[0].cells[0].merge).toEqual({ rowSpan: 1, colSpan: 2 });
    expect(rows[0].cells[1].coveredBy).toEqual({ row: 0, col: 0 });
  });

  it('deleteFromTable removes merge when anchor column itself is deleted', () => {
    const { c, getRows } = createBase([
      {
        id: 'r0',
        cells: [
          { id: 'x', contentHtml: '<div>X</div>' },
          { id: 'a', contentHtml: '<div>A</div>', merge: { rowSpan: 1, colSpan: 2 } },
          { id: 'b', contentHtml: '', coveredBy: { row: 0, col: 1 } },
          { id: 'y', contentHtml: '<div>Y</div>' },
        ],
      },
    ]);

    c.rowFractions.set([1]);
    c.columnFractions.set([0.25, 0.25, 0.25, 0.25]);

    c.deleteFromTable('col', 1, 1);

    const rows = getRows();
    expect(rows[0].cells.length).toBe(3);
    expect(rows[0].cells[1].merge).toBeUndefined();
    expect(rows[0].cells[1].coveredBy).toBeUndefined();
    expect(rows[0].cells[2].coveredBy).toBeUndefined();
  });

  it('insertIntoSplit inserts a split row in targeted owner', () => {
    const { c, getRows } = createBase([
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
              rowFractions: [1],
              columnFractions: [0.5, 0.5],
            },
          },
        ],
      },
    ]);

    c.rowFractions.set([1]);
    c.columnFractions.set([1]);

    c.insertIntoSplit({ kind: 'split', ownerRow: 0, ownerCol: 0, ownerPath: [] }, 'row', 'before', 0);

    const rows = getRows();
    const owner = rows[0].cells[0];
    expect(owner.split.rows).toBe(2);
    expect(owner.split.cols).toBe(2);
    expect(owner.split.cells.length).toBe(4);
  });

  it('deleteFromSplit deletes a split column in targeted owner', () => {
    const { c, getRows } = createBase([
      {
        id: 'r0',
        cells: [
          {
            id: 'owner',
            contentHtml: '',
            split: {
              rows: 1,
              cols: 3,
              cells: [
                { id: 's0', contentHtml: '' },
                { id: 's1', contentHtml: '' },
                { id: 's2', contentHtml: '' },
              ],
              rowFractions: [1],
              columnFractions: [1 / 3, 1 / 3, 1 / 3],
            },
          },
        ],
      },
    ]);

    c.rowFractions.set([1]);
    c.columnFractions.set([1]);

    c.deleteFromSplit({ kind: 'split', ownerRow: 0, ownerCol: 0, ownerPath: [] }, 'col', 1, 1);

    const rows = getRows();
    const owner = rows[0].cells[0];
    expect(owner.split.cols).toBe(2);
    expect(owner.split.cells.length).toBe(2);
  });

  it('deleteFromSplit is no-op when deletion would remove all split rows', () => {
    const { c, getRows } = createBase([
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
              rowFractions: [1],
              columnFractions: [0.5, 0.5],
            },
          },
        ],
      },
    ]);

    c.rowFractions.set([1]);
    c.columnFractions.set([1]);

    c.deleteFromSplit({ kind: 'split', ownerRow: 0, ownerCol: 0, ownerPath: [] }, 'row', 0, 0);

    const rows = getRows();
    const owner = rows[0].cells[0];
    expect(owner.split.rows).toBe(1);
    expect(owner.split.cols).toBe(2);
    expect(owner.split.cells.length).toBe(2);
  });

  it('applyInsert dispatches to split insert path when target kind is split', () => {
    const c = Object.create(TableWidgetComponent.prototype) as any;

    c.syncCellContent = () => {};
    c.activeCellId = '0-0-0';
    c.selectedCells = () => new Set<string>(['0-0-0']);

    const target = { kind: 'split', ownerRow: 0, ownerCol: 0, ownerPath: [] as number[] };
    c.resolveInsertTarget = () => target;
    c.computeSplitBoundsForSelection = () => ({ minRow: 0, maxRow: 0, minCol: 0, maxCol: 1, ownerRows: 1, ownerCols: 2, ownerDepth: 0 });

    const spy = jasmine.createSpy('insertIntoSplit');
    c.insertIntoSplit = spy;

    c.applyInsert({ axis: 'col', placement: 'after' });

    expect(spy).toHaveBeenCalled();
  });

  it('applyInsert uses top-level multi-selection bounds for table insert index', () => {
    const c = Object.create(TableWidgetComponent.prototype) as any;

    c.syncCellContent = () => {};
    c.activeCellId = null;
    c.selectedCells = () => new Set<string>(['0-2', '0-4']);
    c.resolveInsertTarget = () => ({ kind: 'table' });
    c.computeTableBoundsForSelection = () => ({ minRow: 0, maxRow: 0, minCol: 2, maxCol: 4 });

    const spy = jasmine.createSpy('insertIntoTable');
    c.insertIntoTable = spy;

    c.applyInsert({ axis: 'col', placement: 'after' });

    expect(spy).toHaveBeenCalledWith('col', 'after', 5);
  });

  it('applyDelete dispatches to split delete path when target kind is split', () => {
    const c = Object.create(TableWidgetComponent.prototype) as any;

    c.syncCellContent = () => {};
    c.activeCellId = '0-0-0';
    c.selectedCells = () => new Set<string>(['0-0-0']);

    const target = { kind: 'split', ownerRow: 0, ownerCol: 0, ownerPath: [] as number[] };
    c.resolveInsertTarget = () => target;
    c.computeSplitBoundsForSelection = () => ({ minRow: 0, maxRow: 0, minCol: 1, maxCol: 1, ownerRows: 1, ownerCols: 3, ownerDepth: 0 });

    const spy = jasmine.createSpy('deleteFromSplit');
    c.deleteFromSplit = spy;

    c.applyDelete({ axis: 'col' });

    expect(spy).toHaveBeenCalledWith(target, 'col', 1, 1);
  });
});
