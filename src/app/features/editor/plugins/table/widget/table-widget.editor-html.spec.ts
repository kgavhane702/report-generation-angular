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



