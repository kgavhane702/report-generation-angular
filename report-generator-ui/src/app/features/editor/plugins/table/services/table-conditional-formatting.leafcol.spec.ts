import { TableConditionalFormattingService } from './table-conditional-formatting.service';
import { TableColumnRulesDialogComponent } from '../ui/table-column-rules-dialog/table-column-rules-dialog.component';

describe('Split-leaf column rules', () => {
  it('enumerates leaf columns for a 2x2 split header as f > b and s > r (no 55 leakage)', () => {
    const dlg = new TableColumnRulesDialogComponent();
    dlg.props = {
      headerRow: true,
      headerRowCount: 1,
      rows: [
        {
          id: 'r0',
          cells: [
            { id: 'c00', contentHtml: '' },
            { id: 'c01', contentHtml: '' },
            {
              id: 'c02',
              contentHtml: '',
              split: {
                rows: 2,
                cols: 2,
                cells: [
                  { id: 'f', contentHtml: '<div>f</div>' },
                  { id: 's', contentHtml: '<div>s</div>' },
                  { id: 'b', contentHtml: '<div>b</div>' },
                  { id: 'r', contentHtml: '<div>r</div>' },
                ],
                columnFractions: [0.5, 0.5],
                rowFractions: [0.5, 0.5],
              },
            },
            { id: 'c03', contentHtml: '' },
          ],
        },
        {
          id: 'r1',
          cells: [
            { id: 'd00', contentHtml: '' },
            { id: 'd01', contentHtml: '' },
            { id: 'd02', contentHtml: '<div>55</div>' },
            { id: 'd03', contentHtml: '' },
          ],
        },
      ],
      showBorders: true,
      columnFractions: [0.25, 0.25, 0.25, 0.25],
      rowFractions: [0.5, 0.5],
    } as any;

    const cols = dlg.columns();
    const leaf0 = cols.find((c) => c.key === 'leafcol:2:0');
    const leaf1 = cols.find((c) => c.key === 'leafcol:2:1');

    expect(leaf0?.name).toBe('f > b');
    expect(leaf1?.name).toBe('s > r');
    expect(cols.some((c) => (c.name ?? '').includes('55'))).toBe(false);
  });

  it('enumerates leaf columns for a nested split header as d > a and d > b', () => {
    const dlg = new TableColumnRulesDialogComponent();
    dlg.props = {
      headerRow: true,
      headerRowCount: 1,
      rows: [
        {
          id: 'r0',
          cells: [
            {
              id: 'c00',
              contentHtml: '',
              split: {
                rows: 2,
                cols: 1,
                cells: [
                  { id: 'd', contentHtml: '<div>d</div>' },
                  {
                    id: 'ab',
                    contentHtml: '',
                    split: {
                      rows: 1,
                      cols: 2,
                      cells: [
                        { id: 'a', contentHtml: '<div>a</div>' },
                        { id: 'b', contentHtml: '<div>b</div>' },
                      ],
                      columnFractions: [0.5, 0.5],
                      rowFractions: [1],
                    },
                  },
                ],
                columnFractions: [1],
                rowFractions: [0.5, 0.5],
              },
            },
            { id: 'c01', contentHtml: '<div>x</div>' },
          ],
        },
      ],
      showBorders: true,
      columnFractions: [0.5, 0.5],
      rowFractions: [1],
    } as any;

    const cols = dlg.columns();
    expect(cols.find((c) => c.key === 'leafcol:0:0')?.name).toBe('d > a');
    expect(cols.find((c) => c.key === 'leafcol:0:1')?.name).toBe('d > b');
  });

  it('uses first relevant header split layer for leaf path catalog (no extra leaf paths)', () => {
    const dlg = new TableColumnRulesDialogComponent();
    dlg.props = {
      headerRow: true,
      headerRowCount: 2,
      rows: [
        {
          id: 'h0',
          cells: [
            {
              id: 'h0c0',
              contentHtml: '',
              split: {
                rows: 1,
                cols: 2,
                cells: [
                  { id: 'h0a', contentHtml: '<div>A</div>' },
                  { id: 'h0b', contentHtml: '<div>B</div>' },
                ],
              },
            },
          ],
        },
        {
          id: 'h1',
          cells: [
            {
              id: 'h1c0',
              contentHtml: '',
              split: {
                rows: 1,
                cols: 3,
                cells: [
                  { id: 'x', contentHtml: '<div>X</div>' },
                  { id: 'y', contentHtml: '<div>Y</div>' },
                  { id: 'z', contentHtml: '<div>Z</div>' },
                ],
              },
            },
          ],
        },
      ],
      showBorders: true,
      columnFractions: [1],
      rowFractions: [0.5, 0.5],
    } as any;

    const cols = dlg.columns();
    const leafKeys = cols.filter((c) => c.key.startsWith('leafcol:0:')).map((c) => c.key).sort();

    expect(leafKeys).toEqual(['leafcol:0:0', 'leafcol:0:1']);
  });

  it('applies leaf-column rules by leaf path, and applies to whole cell when body row is unsplit (apply_whole)', () => {
    const svc = new TableConditionalFormattingService();

    const rows: any[] = [
      {
        id: 'h0',
        cells: [
          {
            id: 'h0c0',
            contentHtml: '',
            // Header: d over a/b (nested split)
            split: {
              rows: 2,
              cols: 1,
              cells: [
                { id: 'd', contentHtml: '<div>d</div>' },
                {
                  id: 'ab',
                  contentHtml: '',
                  split: {
                    rows: 1,
                    cols: 2,
                    cells: [
                      { id: 'a', contentHtml: '<div>a</div>' },
                      { id: 'b', contentHtml: '<div>b</div>' },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
      {
        id: 'r1',
        cells: [
          {
            id: 'r1c0',
            contentHtml: '',
            // Body: 10 / 20 split into two leaf cols
            split: {
              rows: 1,
              cols: 2,
              cells: [
                { id: '10', contentHtml: '<div>10</div>' },
                { id: '20', contentHtml: '<div>20</div>' },
              ],
            },
          },
        ],
      },
      {
        id: 'r2',
        cells: [
          {
            id: 'r2c0',
            contentHtml: '<div>unsplit</div>',
          },
        ],
      },
    ];

    const columnRules: any[] = [
      {
        target: { kind: 'leaf', topColIndex: 0, leafPath: [0] },
        enabled: true,
        matchMode: 'any',
        rules: [
          {
            id: 'rule-1',
            enabled: true,
            priority: 0,
            when: { op: 'isNotEmpty' },
            then: { backgroundColor: '#ff0' },
            stopIfTrue: false,
          },
        ],
      },
    ];

    // Leaf 0 (10) should match
    const style10 = svc.getConditionalCellSurfaceStyle(1, 0, '0', rows[1].cells[0].split.cells[0], columnRules, rows, 1);
    expect(style10.backgroundColor).toBe('#ff0');

    // Leaf 1 (20) should NOT match leafcol:0
    const style20 = svc.getConditionalCellSurfaceStyle(1, 0, '1', rows[1].cells[0].split.cells[1], columnRules, rows, 1);
    expect(style20.backgroundColor).toBeUndefined();

    // Unsplit body row should still match (apply_whole behavior)
    const styleUnsplit = svc.getConditionalCellSurfaceStyle(2, 0, '', rows[2].cells[0], columnRules, rows, 1);
    expect(styleUnsplit.backgroundColor).toBe('#ff0');
  });

  it('does not pull numeric body rows into header naming even if a body merge exists', () => {
    const dlg = new TableColumnRulesDialogComponent();
    dlg.props = {
      headerRow: true,
      // Simulate an over-large persisted header count (buggy or user-imported)
      headerRowCount: 3,
      rows: [
        // Row 0: group header "a" spanning 3 columns (b,f,c)
        {
          id: 'h0',
          cells: [
            { id: 'a', contentHtml: '<div>a</div>', merge: { rowSpan: 1, colSpan: 3 } },
            { id: 'ab1', contentHtml: '', coveredBy: { row: 0, col: 0 } },
            { id: 'ab2', contentHtml: '', coveredBy: { row: 0, col: 0 } },
            { id: 'd', contentHtml: '<div>d</div>' },
            { id: 'e', contentHtml: '<div>e</div>' },
          ],
        },
        // Row 1: leaf headers b/f/c
        {
          id: 'h1',
          cells: [
            { id: 'b', contentHtml: '<div>b</div>' },
            { id: 'f', contentHtml: '<div>f</div>' },
            { id: 'c', contentHtml: '<div>c</div>' },
            { id: 'd1', contentHtml: '' },
            { id: 'e1', contentHtml: '' },
          ],
        },
        // Row 2: BODY numeric row (11/12/20), with a body merge anchor at d (simulates merge of 4 cells around 20)
        {
          id: 'r2',
          cells: [
            { id: 'v11', contentHtml: '<div>11</div>' },
            { id: 'v12', contentHtml: '<div>12</div>' },
            { id: 'v11b', contentHtml: '<div>11</div>' },
            { id: 'v20', contentHtml: '<div>20</div>', merge: { rowSpan: 2, colSpan: 1 } },
            { id: 've', contentHtml: '' },
          ],
        },
      ],
      columnFractions: [0.2, 0.2, 0.2, 0.2, 0.2],
      rowFractions: [0.3, 0.3, 0.4],
    } as any;

    const cols = dlg.columns();
    // Ensure we do not see body values appended as extra header segments.
    expect(cols.some((c) => (c.name ?? '').includes(' > 11'))).toBe(false);
    expect(cols.some((c) => (c.name ?? '').includes(' > 12'))).toBe(false);
    expect(cols.some((c) => (c.name ?? '').includes(' > 20'))).toBe(false);
  });

  it('does not promote header depth from a body merge when the body row values live in a split (10 / 20)', () => {
    const dlg = new TableColumnRulesDialogComponent();
    dlg.props = {
      headerRow: true,
      headerRowCount: 1,
      rows: [
        // Row 0: header group "a" spanning 2 columns
        {
          id: 'h0',
          cells: [
            { id: 'a', contentHtml: '<div>a</div>', merge: { rowSpan: 1, colSpan: 2 } },
            { id: 'a_covered', contentHtml: '', coveredBy: { row: 0, col: 0 } },
          ],
        },
        // Row 1: BODY row, with a split numeric value "10 / 20" and a merge anchor elsewhere on the row
        {
          id: 'r1',
          cells: [
            {
              id: 'r1c0',
              contentHtml: '',
              split: {
                rows: 1,
                cols: 2,
                cells: [
                  { id: '10', contentHtml: '<div>10</div>' },
                  { id: '20', contentHtml: '<div>20</div>' },
                ],
              },
            },
            {
              id: 'r1c1',
              contentHtml: '',
              // merge anchor in a body row (can happen after user merges body cells)
              merge: { rowSpan: 1, colSpan: 1 },
            },
          ],
        },
      ],
      columnFractions: [0.5, 0.5],
      rowFractions: [0.5, 0.5],
      showBorders: true,
    } as any;

    const cols = dlg.columns();
    expect(cols.some((c) => (c.name ?? '').includes('10'))).toBe(false);
    expect(cols.some((c) => (c.name ?? '').includes('20'))).toBe(false);
  });
});


