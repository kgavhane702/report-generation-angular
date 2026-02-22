import { TableWidgetComponent } from './table-widget.component';

describe('TableWidgetComponent - editor HTML normalization', () => {
  it('normalizes legacy valign wrapper-only content to empty', () => {
    const c = Object.create(TableWidgetComponent.prototype) as any;
    const res = c.normalizeEditorHtmlForModel('<div class="table-widget__valign"><br></div>');
    expect(res).toBe('');
  });

  it('preserves user-entered blank lines (<br>) as meaningful content', () => {
    const c = Object.create(TableWidgetComponent.prototype) as any;
    const res = c.normalizeEditorHtmlForModel('<div><br></div><div><br></div>');
    expect(res).not.toBe('');
    expect(res).toContain('<br');
  });

  it('strips legacy `.table-widget__valign` classes but preserves multi-line content', () => {
    const c = Object.create(TableWidgetComponent.prototype) as any;
    const res = c.normalizeEditorHtmlForModel(
      '<div class="table-widget__valign">line1</div><div class="table-widget__valign">line2</div>'
    );
    expect(res).toContain('line1');
    expect(res).toContain('line2');
    expect(res).not.toContain('table-widget__valign');
  });

  it('ensures a single caret placeholder block for an empty editor element', () => {
    const c = Object.create(TableWidgetComponent.prototype) as any;
    const el = document.createElement('div');
    el.innerHTML = '<div class="table-widget__valign"><br></div>';
    c.ensureCaretPlaceholderForEmptyEditor(el);
    expect(el.innerHTML).toBe('<div><br></div>');
  });
});

describe('TableWidgetComponent - import sizing helpers', () => {
  it('allocates more width to a column with longer content when extra space is available', () => {
    const c = Object.create(TableWidgetComponent.prototype) as any;
    const rows = [
      {
        id: 'r-0',
        cells: [
          { id: '0-0', contentHtml: 'Short' },
          { id: '0-1', contentHtml: 'This is a much longer value than the first column' },
        ],
      },
    ];

    const fractions: number[] = c.computeImportColumnFractionsFromRows(rows, 40, 400);
    expect(Array.isArray(fractions)).toBe(true);
    expect(fractions.length).toBe(2);
    expect(fractions[1]).toBeGreaterThan(fractions[0]);
    expect(fractions.reduce((a: number, b: number) => a + b, 0)).toBeCloseTo(1, 6);
  });

  it('falls back to equal fractions when there is no extra width beyond the min column widths', () => {
    const c = Object.create(TableWidgetComponent.prototype) as any;
    const rows = [
      {
        id: 'r-0',
        cells: [
          { id: '0-0', contentHtml: 'Short' },
          { id: '0-1', contentHtml: 'This is a much longer value than the first column' },
        ],
      },
    ];

    // 2 cols * 40px min => 80px total, no extra width to distribute.
    const fractions: number[] = c.computeImportColumnFractionsFromRows(rows, 40, 80);
    expect(fractions.length).toBe(2);
    expect(fractions[0]).toBeCloseTo(0.5, 6);
    expect(fractions[1]).toBeCloseTo(0.5, 6);
  });
});

describe('TableWidgetComponent - applyExcelImport (preserveWidgetFrame)', () => {
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

  it('does not grow the widget height or run AutoFit when preserveWidgetFrame=true', () => {
    const c = Object.create(TableWidgetComponent.prototype) as any;

    // Minimal instance wiring (no Angular runtime)
    c.minColPx = 40;
    c.minRowPx = 24;
    c.widget = { id: 'w-1', size: { width: 200, height: 120 }, props: {} };

    c.isLoadingSig = makeSignal<boolean>(true);
    c.localRows = makeSignal<any[]>([]);
    c.columnFractions = makeSignal<number[]>([]);
    c.rowFractions = makeSignal<number[]>([]);

    c.cloneRows = (rows: any[]) => JSON.parse(JSON.stringify(rows));
    c.getTopLevelRowCount = (rows: any[]) => (Array.isArray(rows) ? rows.length : 0);
    c.getTopLevelColCount = (rows: any[]) => {
      const first = Array.isArray(rows) ? rows[0] : null;
      const cells = first?.cells;
      return Array.isArray(cells) ? cells.length : 0;
    };

    c.clearSelection = () => void 0;
    c.toolbarService = { setActiveCell: () => void 0 };

    c.normalizeFractions = (arr: number[], count: number) => {
      if (count <= 0) return [];
      if (!Array.isArray(arr) || arr.length !== count) {
        return Array.from({ length: count }, () => 1 / count);
      }
      const sum = arr.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
      if (!Number.isFinite(sum) || sum <= 0) {
        return Array.from({ length: count }, () => 1 / count);
      }
      return arr.map((x) => (Number.isFinite(x) ? x / sum : 1 / count));
    };

    c.computeImportColumnFractionsFromRows = () => [0.5, 0.5];

    c.propsChange = { emit: () => void 0 };
    c.draftState = { hasDraft: () => false, commitDraft: () => void 0 };
    c.cdr = { markForCheck: () => void 0 };
    c.scheduleRecomputeResizeSegments = () => void 0;

    c.growWidgetSizeBy = () => void 0;
    c.startAutoFitAfterTopColResize = () => void 0;
    c.lastLeafTextLen = new Map<string, number>();
    c.manualTopLevelRowMinHeightsPx = [];

    const growSpy = spyOn(c, 'growWidgetSizeBy').and.callThrough();
    const autoFitSpy = spyOn(c, 'startAutoFitAfterTopColResize').and.callThrough();

    const originalRaf = window.requestAnimationFrame;
    const rafSpy = spyOn(window, 'requestAnimationFrame').and.callFake(() => 0 as any);

    const rows = [
      {
        id: 'r-0',
        cells: [
          { id: '0-0', contentHtml: 'A', merge: null, coveredBy: null },
          { id: '0-1', contentHtml: 'B', merge: null, coveredBy: null },
        ],
      },
    ];

    c.applyExcelImport({
      widgetId: 'w-1',
      rows,
      columnFractions: [0.5, 0.5],
      rowFractions: [1],
      preserveWidgetFrame: true,
    });

    expect(growSpy).not.toHaveBeenCalled();
    expect(autoFitSpy).not.toHaveBeenCalled();
    // In preserveWidgetFrame mode we still schedule a post-import header-fit pass (RAF-based),
    // but we must NOT auto-grow the widget or run the old AutoFit height grow loop.
    expect(rafSpy).toHaveBeenCalled();

    // Restore RAF to avoid leaking a spy into other tests.
    (window as any).requestAnimationFrame = originalRaf;
  });

  const makeImportHarness = (opts?: {
    existingRows?: any[];
    columnFractions?: number[];
    rowFractions?: number[];
    propsPatch?: Record<string, any>;
  }) => {
    const c = Object.create(TableWidgetComponent.prototype) as any;

    c.minColPx = 40;
    c.minRowPx = 24;

    const existingRows = opts?.existingRows ?? [];

    c.widget = {
      id: 'w-1',
      size: { width: 320, height: 180 },
      props: {
        rows: existingRows,
        showBorders: true,
        loading: false,
        headerRow: false,
        headerRowCount: 0,
        preserveHeaderOnUrlLoad: false,
        ...(opts?.propsPatch ?? {}),
      },
    };

    c.isLoadingSig = makeSignal<boolean>(false);
    c.localRows = makeSignal<any[]>(JSON.parse(JSON.stringify(existingRows)));
    c.columnFractions = makeSignal<number[]>(opts?.columnFractions ?? [0.5, 0.5]);
    c.rowFractions = makeSignal<number[]>(opts?.rowFractions ?? [1]);

    c.cloneRows = (rows: any[]) => JSON.parse(JSON.stringify(rows));
    c.getTopLevelRowCount = (rows: any[]) => (Array.isArray(rows) ? rows.length : 0);
    c.getTopLevelColCount = (rows: any[]) => {
      const first = Array.isArray(rows) ? rows[0] : null;
      const cells = first?.cells;
      return Array.isArray(cells) ? cells.length : 0;
    };

    c.clearSelection = () => void 0;
    c.toolbarService = { setActiveCell: () => void 0 };
    c.cdr = { markForCheck: () => void 0 };
    c.scheduleRecomputeResizeSegments = () => void 0;
    c.lastLeafTextLen = new Map<string, number>();
    c.manualTopLevelRowMinHeightsPx = [];

    c.normalizeFractions = (arr: number[], count: number) => {
      const n = Math.max(1, Math.trunc(count));
      if (!Array.isArray(arr) || arr.length !== n) {
        return Array.from({ length: n }, () => 1 / n);
      }
      const cleaned = arr.map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
      const sum = cleaned.reduce((a, b) => a + b, 0);
      if (!Number.isFinite(sum) || sum <= 0) {
        return Array.from({ length: n }, () => 1 / n);
      }
      return cleaned.map((v) => v / sum);
    };

    c.computeImportColumnFractionsFromRows = () => [0.5, 0.5];
    c.growWidgetSizeBy = () => ({ appliedWidthPx: 0, appliedHeightPx: 0 });
    c.startAutoFitAfterTopColResize = () => void 0;
    c.schedulePostImportFitHeaderRow = () => void 0;

    c.propsChange = { emit: jasmine.createSpy('emit') };
    c.draftState = {
      hasDraft: () => false,
      commitDraft: () => void 0,
    };

    return c;
  };

  it('preserves existing header rows and replaces body during URL auto-load', () => {
    const existingRows = [
      {
        id: 'hdr',
        cells: [
          { id: 'h0', contentHtml: 'Region' },
          { id: 'h1', contentHtml: 'Amount' },
        ],
      },
      {
        id: 'template',
        cells: [
          { id: 't0', contentHtml: '' },
          { id: 't1', contentHtml: '' },
        ],
      },
    ];

    const c = makeImportHarness({
      existingRows,
      propsPatch: {
        dataSource: { kind: 'http' },
        preserveHeaderOnUrlLoad: true,
        headerRow: true,
        headerRowCount: 1,
      },
    });

    c.applyExcelImport({
      widgetId: 'w-1',
      preserveWidgetFrame: true,
      rows: [
        // Incoming header-like row should be dropped because preserved header already exists.
        {
          id: 'r-h',
          cells: [
            { id: 'rh0', contentHtml: 'Region' },
            { id: 'rh1', contentHtml: 'Amount' },
            { id: 'rh2', contentHtml: 'Extra' },
          ],
        },
        {
          id: 'r-1',
          cells: [
            { id: 'r10', contentHtml: 'North' },
            { id: 'r11', contentHtml: '100' },
            { id: 'r12', contentHtml: 'ignored' },
          ],
        },
      ],
      columnFractions: [0.5, 0.5],
      rowFractions: [0.5, 0.5],
    } as any);

    const emitted = c.propsChange.emit.calls.mostRecent().args[0];
    expect(emitted.rows.length).toBe(2);
    expect(emitted.rows[0].cells[0].contentHtml).toBe('Region');
    expect(emitted.rows[0].cells[1].contentHtml).toBe('Amount');
    expect(emitted.rows[1].cells[0].contentHtml).toBe('North');
    expect(emitted.rows[1].cells[1].contentHtml).toBe('100');
    expect(emitted.rows[1].cells.length).toBe(2);
  });

  it('reapplies persisted fractions for placeholder-to-real URL data load', () => {
    const c = makeImportHarness({
      existingRows: [{ id: 'placeholder', cells: [{ id: 'p0', contentHtml: '' }] }],
      columnFractions: [1],
      rowFractions: [1],
      propsPatch: {
        dataSource: { kind: 'http' },
        headerRow: true,
        headerRowCount: 1,
        totalRow: true,
      },
    });

    c.pendingPropsColumnFractions = [0.7, 0.3];
    c.pendingPropsRowFractions = [0.4, 0.6];

    c.applyExcelImport({
      widgetId: 'w-1',
      preserveWidgetFrame: true,
      rows: [
        { id: 'r0', cells: [{ id: '0-0', contentHtml: 'H1' }, { id: '0-1', contentHtml: 'H2' }] },
        { id: 'r1', cells: [{ id: '1-0', contentHtml: 'A' }, { id: '1-1', contentHtml: '10' }] },
        { id: 'r2', cells: [{ id: '2-0', contentHtml: 'Total' }, { id: '2-1', contentHtml: '10' }] },
      ],
      columnFractions: [0.5, 0.5],
      rowFractions: [1 / 3, 1 / 3, 1 / 3],
    } as any);

    const emitted = c.propsChange.emit.calls.mostRecent().args[0];
    expect(emitted.columnFractions[0]).toBeCloseTo(0.7, 6);
    expect(emitted.columnFractions[1]).toBeCloseTo(0.3, 6);

    // Mapped row fractions should preserve stronger header/total weights versus middle rows.
    expect(emitted.rowFractions.length).toBe(3);
    expect(emitted.rowFractions[0]).toBeGreaterThan(emitted.rowFractions[1]);
    expect(emitted.rowFractions[2]).toBeGreaterThan(emitted.rowFractions[1]);

    expect(c.pendingPropsColumnFractions).toBeNull();
    expect(c.pendingPropsRowFractions).toBeNull();
  });

  it('maps imported merge metadata into inline merge/coveredBy model', () => {
    const c = makeImportHarness();

    c.applyExcelImport({
      widgetId: 'w-1',
      preserveWidgetFrame: false,
      rows: [
        {
          id: 'r0',
          cells: [
            { id: '0-0', contentHtml: 'A', merge: { rowSpan: 1, colSpan: 2 } },
            { id: '0-1', contentHtml: '', coveredBy: { row: 0, col: 0 } },
          ],
        },
      ],
      columnFractions: [0.5, 0.5],
      rowFractions: [1],
    } as any);

    const emitted = c.propsChange.emit.calls.mostRecent().args[0];
    expect(emitted.rows[0].cells[0].merge).toEqual({ rowSpan: 1, colSpan: 2 });
    expect(emitted.rows[0].cells[1].coveredBy).toEqual({ row: 0, col: 0 });
    expect(emitted.mergedRegions).toEqual([]);
  });
});



