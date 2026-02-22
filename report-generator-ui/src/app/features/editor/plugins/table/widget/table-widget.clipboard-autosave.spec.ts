import { TableWidgetComponent } from './table-widget.component';

describe('TableWidgetComponent - clipboard/autosave regression', () => {
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

  const deepClone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

  const createBase = (initialRows: any[]) => {
    const c = Object.create(TableWidgetComponent.prototype) as any;

    let rows = deepClone(initialRows);
    const localRowsFn: any = () => rows;
    localRowsFn.set = (next: any[]) => {
      rows = deepClone(next);
    };
    localRowsFn.update = (updater: (r: any[]) => any[]) => {
      rows = updater(rows);
    };

    c.localRows = localRowsFn;
    c.cloneRows = (r: any[]) => deepClone(r);
    c.rowsAtEditStart = deepClone(rows);

    c.tableContainer = { nativeElement: document.createElement('div') };
    c.isResizingGrid = false;
    c.isResizingSplitGrid = false;
    c.isLoadingSig = () => false;

    c.isActivelyEditing = makeSignal(false);
    c.selectedCells = () => new Set<string>();

    c.activeCellId = null;
    c.activeCellElement = null;

    c.cdr = { markForCheck: () => {} };
    c.toolbarService = {
      activeTableWidgetId: 'other',
      clearActiveCell: () => {},
      setSelectedCellsGetter: () => {},
    };
    c.pendingChangesRegistry = { unregister: () => {} };

    c.widget = {
      id: 'w1',
      props: { showBorders: true },
      size: { width: 300, height: 200 },
    };

    c.editingChange = { emit: () => {} };
    c.syncCellContent = () => {};
    c.syncCellContentFromElement = () => {};
    c.scheduleRecomputeResizeSegments = () => {};
    c.maybeAutoGrowToFit = () => {};
    c.resolveLeafEditorElement = () => null;
    c.getCellModelByLeafId = () => null;
    c.ensureCaretPlaceholderForEmptyEditor = () => {};
    c.normalizeEditorHtmlForModel = (html: string) => html ?? '';
    c.htmlToPlainTextForSizing = (html: string) => (html ?? '').replace(/<[^>]*>/g, '');

    c.emitPropsChange = () => {};

    return { c, getRows: () => rows };
  };

  it('copies top-level rectangular selection to TSV clipboard payload', () => {
    const { c } = createBase([
      { id: 'r0', cells: [{ id: 'a', contentHtml: '<div>A</div>' }, { id: 'b', contentHtml: '<div>B</div>' }] },
      { id: 'r1', cells: [{ id: 'c', contentHtml: '<div>C</div>' }, { id: 'd', contentHtml: '<div>D</div>' }] },
    ]);

    c.activeCellId = '0-0';
    c.selectedCells = () => new Set<string>(['0-0', '0-1', '1-0', '1-1']);
    c.computeTableBoundsForSelection = () => ({ minRow: 0, maxRow: 1, minCol: 0, maxCol: 1 });
    c.hasTextSelectionInActiveCell = () => false;

    const target = document.createElement('div');
    c.tableContainer.nativeElement.appendChild(target);

    const setData = jasmine.createSpy('setData');
    const event: any = {
      target,
      clipboardData: { setData },
      preventDefault: jasmine.createSpy('preventDefault'),
      stopPropagation: jasmine.createSpy('stopPropagation'),
    };

    c.handleClipboardCopy(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(setData).toHaveBeenCalledWith('text/plain', 'A\tB\r\nC\tD');
    expect(setData).toHaveBeenCalledWith(
      'text/html',
      '<table><tbody><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></tbody></table>'
    );
  });

  it('pastes TSV grid into top-level cells with table bounds clipping', () => {
    const { c, getRows } = createBase([
      { id: 'r0', cells: [{ id: 'a', contentHtml: '' }, { id: 'b', contentHtml: '' }] },
      { id: 'r1', cells: [{ id: 'c', contentHtml: '' }, { id: 'd', contentHtml: '' }] },
    ]);

    spyOn(c, 'syncCellContent').and.callThrough();
    spyOn(c, 'commitChanges').and.stub();

    c.applyTabularPasteToTopLevel(1, 1, [
      ['X', 'Y'],
      ['Z', 'W'],
    ]);

    const rows = getRows();
    expect(rows[1].cells[1].contentHtml).toBe('X');
    expect(rows[0].cells[0].contentHtml).toBe('');
    expect(c.commitChanges).toHaveBeenCalledWith('autosave');
  });

  it('routes top-level paste on covered cell to its merge anchor', () => {
    const { c, getRows } = createBase([
      {
        id: 'r0',
        cells: [
          { id: 'a', contentHtml: 'old', merge: { rowSpan: 1, colSpan: 2 } },
          { id: 'b', contentHtml: '', coveredBy: { row: 0, col: 0 } },
        ],
      },
    ]);

    spyOn(c, 'commitChanges').and.stub();

    c.applyTabularPasteToTopLevel(0, 1, [['NEW']]);

    const rows = getRows();
    expect(rows[0].cells[0].contentHtml).toBe('NEW');
    expect(rows[0].cells[1].coveredBy).toEqual({ row: 0, col: 0 });
  });

  it('ignores spreadsheet-style paste for split-leaf targets (safe no-op)', () => {
    const { c } = createBase([
      { id: 'r0', cells: [{ id: 'a', contentHtml: '' }] },
    ]);

    c.activeCellId = '0-0-1';
    c.selectedCells = () => new Set<string>();
    spyOn(c, 'applyTabularPasteToTopLevel').and.stub();

    const editor = document.createElement('div');
    editor.className = 'table-widget__cell-editor';
    const target = document.createElement('span');
    editor.appendChild(target);
    c.tableContainer.nativeElement.appendChild(editor);

    const event: any = {
      target,
      clipboardData: {
        getData: (type: string) => (type === 'text/plain' ? 'A\tB' : ''),
      },
      preventDefault: jasmine.createSpy('preventDefault'),
      stopPropagation: jasmine.createSpy('stopPropagation'),
    };

    c.handleClipboardPaste(event);

    expect(c.applyTabularPasteToTopLevel).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('debounces autosave and commits once for latest edited leaf', () => {
    const { c } = createBase([{ id: 'r0', cells: [{ id: 'a', contentHtml: '' }] }]);

    jasmine.clock().install();
    try {
      c.isActivelyEditing.set(true);

      const first = document.createElement('div');
      const second = document.createElement('div');

      c.resolveLeafEditorElement = (_id: string, preferred: HTMLElement | null) => preferred;
      spyOn(c, 'syncCellContentFromElement').and.stub();
      spyOn(c, 'commitChanges').and.stub();

      c.scheduleAutosaveCommit('0-0', first);
      c.scheduleAutosaveCommit('0-1', second);

      jasmine.clock().tick(700);

      expect(c.syncCellContentFromElement).toHaveBeenCalledTimes(1);
      expect(c.syncCellContentFromElement).toHaveBeenCalledWith(second, '0-1');
      expect(c.commitChanges).toHaveBeenCalledTimes(1);
      expect(c.commitChanges).toHaveBeenCalledWith('autosave');
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('syncs blurred element content to the correct leaf id before blur commit', () => {
    const { c } = createBase([{ id: 'r0', cells: [{ id: 'a', contentHtml: '' }] }]);

    jasmine.clock().install();
    try {
      c.isActivelyEditing.set(true);

      const blurredEl = document.createElement('div');
      blurredEl.innerHTML = '<div>changed</div>';

      spyOn(c, 'syncCellContentFromElement').and.stub();
      spyOn(c, 'commitChanges').and.stub();

      c.onCellBlur(blurredEl, 2, 3, '4-5');

      expect(c.syncCellContentFromElement).toHaveBeenCalledWith(blurredEl, '2-3-4-5');

      jasmine.clock().tick(170);

      expect(c.commitChanges).toHaveBeenCalledWith('blur');
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('commits pending edits on destroy when actively editing', () => {
    const { c } = createBase([{ id: 'r0', cells: [{ id: 'a', contentHtml: '' }] }]);

    c.isActivelyEditing.set(true);
    c.autosaveTimeoutId = window.setTimeout(() => {}, 5000);

    spyOn(c, 'commitChanges').and.stub();
    spyOn(c.pendingChangesRegistry, 'unregister').and.stub();

    c.ngOnDestroy();

    expect(c.commitChanges).toHaveBeenCalledTimes(1);
    expect(c.commitChanges).toHaveBeenCalledWith('destroy');
    expect(c.pendingChangesRegistry.unregister).toHaveBeenCalledWith('w1');
  });
});
