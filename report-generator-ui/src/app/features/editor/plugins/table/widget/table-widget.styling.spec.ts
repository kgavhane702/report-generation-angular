import { TableWidgetComponent } from './table-widget.component';

describe('TableWidgetComponent - styling operations regression', () => {
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
    c.activeCellId = null;
    c.syncCellContent = () => {};
    c.emitPropsChange = () => {};
    c.cdr = { markForCheck: () => {} };
    c.rowsAtEditStart = [];

    return { c, getRows: () => rows };
  };

  it('applies textAlign to multi-cell top-level selection', () => {
    const { c, getRows } = createBase([
      { id: 'r0', cells: [{ id: 'a', contentHtml: '' }, { id: 'b', contentHtml: '' }] },
      { id: 'r1', cells: [{ id: 'c', contentHtml: '' }, { id: 'd', contentHtml: '' }] },
    ]);

    c.selectedCells = () => new Set<string>(['0-0', '1-1']);

    c.applyStyleToSelection({ textAlign: 'center' });

    const rows = getRows();
    expect(rows[0].cells[0].style?.textAlign).toBe('center');
    expect(rows[1].cells[1].style?.textAlign).toBe('center');
    expect(rows[0].cells[1].style).toBeUndefined();
  });

  it('applies verticalAlign across mixed non-split and split-leaf selection', () => {
    const { c, getRows } = createBase([
      {
        id: 'r0',
        cells: [
          { id: 'a', contentHtml: '' },
          {
            id: 'owner',
            contentHtml: '',
            split: {
              rows: 1,
              cols: 2,
              cells: [
                { id: 's0', contentHtml: '' },
                { id: 's1', contentHtml: '' },
              ],
            },
          },
        ],
      },
    ]);

    c.selectedCells = () => new Set<string>(['0-0', '0-1-1']);

    c.applyStyleToSelection({ verticalAlign: 'bottom' });

    const rows = getRows();
    expect(rows[0].cells[0].style?.verticalAlign).toBe('bottom');
    expect(rows[0].cells[1].split.cells[1].style?.verticalAlign).toBe('bottom');
  });

  it('applies backgroundColor to selection and persists once as discrete action', () => {
    const { c, getRows } = createBase([
      { id: 'r0', cells: [{ id: 'a', contentHtml: '' }, { id: 'b', contentHtml: '' }] },
    ]);

    c.selectedCells = () => new Set<string>(['0-0', '0-1']);
    spyOn(c, 'emitPropsChange').and.stub();

    c.applyStyleToSelection({ backgroundColor: '#ffeeaa' });

    const rows = getRows();
    expect(rows[0].cells[0].style?.backgroundColor).toBe('#ffeeaa');
    expect(rows[0].cells[1].style?.backgroundColor).toBe('#ffeeaa');
    expect(c.emitPropsChange).toHaveBeenCalledTimes(1);
  });

  it('applies border color/width/style consistently across selection', () => {
    const { c, getRows } = createBase([
      { id: 'r0', cells: [{ id: 'a', contentHtml: '' }, { id: 'b', contentHtml: '' }] },
      { id: 'r1', cells: [{ id: 'c', contentHtml: '' }, { id: 'd', contentHtml: '' }] },
    ]);

    c.selectedCells = () => new Set<string>(['0-1', '1-0']);

    c.applyStyleToSelection({
      borderColor: '#112233',
      borderWidth: 2,
      borderStyle: 'dashed',
    });

    const rows = getRows();
    expect(rows[0].cells[1].style?.borderColor).toBe('#112233');
    expect(rows[0].cells[1].style?.borderWidth).toBe(2);
    expect(rows[0].cells[1].style?.borderStyle).toBe('dashed');

    expect(rows[1].cells[0].style?.borderColor).toBe('#112233');
    expect(rows[1].cells[0].style?.borderWidth).toBe(2);
    expect(rows[1].cells[0].style?.borderStyle).toBe('dashed');
  });
});
