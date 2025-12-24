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



