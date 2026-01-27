import { TableWidgetComponent } from './table-widget.component';

describe('TableWidgetComponent - Tab navigation (leaf-aware)', () => {
  it('tabs through split subcells before moving to the next top-level cell', () => {
    const c = Object.create(TableWidgetComponent.prototype) as any;

    const rows: any[] = [
      {
        id: 'r0',
        cells: [
          {
            id: 'a',
            contentHtml: '',
            split: {
              rows: 2,
              cols: 2,
              cells: [
                { id: 'a0', contentHtml: '<div>1</div>' },
                { id: 'a1', contentHtml: '<div>2</div>' },
                { id: 'a2', contentHtml: '<div>3</div>' },
                { id: 'a3', contentHtml: '<div>4</div>' },
              ],
            },
          },
          { id: 'b', contentHtml: '<div>b</div>' },
        ],
      },
    ];

    c.localRows = () => rows;

    // From first leaf (index 0) -> second leaf (index 1)
    expect(c.getNextLeafIdForTab('0-0-0', 1)).toBe('0-0-1');
    // From leaf 3 -> next top-level cell (0-1)
    expect(c.getNextLeafIdForTab('0-0-3', 1)).toBe('0-1');
    // Shift+Tab backwards within split
    expect(c.getNextLeafIdForTab('0-0-2', -1)).toBe('0-0-1');
  });
});


