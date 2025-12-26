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
    expect(el.innerHTML).toBe('<div data-tw-caret-placeholder="1"><br></div>');
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
});



