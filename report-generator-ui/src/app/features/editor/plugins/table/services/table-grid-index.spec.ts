import { TableGridIndex } from './table-grid-index';

describe('TableGridIndex', () => {
  it('builds leaf columns for a 2x2 split header as f > b and s > r (no 55 leakage)', () => {
    const props: any = {
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
    };

    const idx = new TableGridIndex(props);
    const cols = idx.buildColumnCatalog();

    const leaf0 = cols.find((c) => c.kind === 'leaf' && c.topColIndex === 2 && c.leafPath.join('-') === '0');
    const leaf1 = cols.find((c) => c.kind === 'leaf' && c.topColIndex === 2 && c.leafPath.join('-') === '1');

    expect(leaf0?.name).toBe('f > b');
    expect(leaf1?.name).toBe('s > r');
    expect(cols.some((c) => (c.name ?? '').includes('55'))).toBe(false);
  });

  it('builds leaf columns for a nested split header as d > a and d > b', () => {
    const props: any = {
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
    };

    const idx = new TableGridIndex(props);
    const cols = idx.buildColumnCatalog();

    expect(cols.find((c) => c.kind === 'leaf' && c.topColIndex === 0 && c.leafPath.join('-') === '0')?.name).toBe('d > a');
    expect(cols.find((c) => c.kind === 'leaf' && c.topColIndex === 0 && c.leafPath.join('-') === '1')?.name).toBe('d > b');
  });

  it('does not promote header depth from a body merge when the body values live in a split (10 / 20)', () => {
    const props: any = {
      headerRow: true,
      headerRowCount: 1,
      rows: [
        {
          id: 'h0',
          cells: [
            { id: 'a', contentHtml: '<div>a</div>', merge: { rowSpan: 1, colSpan: 2 } },
            { id: 'a_covered', contentHtml: '', coveredBy: { row: 0, col: 0 } },
          ],
        },
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
            { id: 'r1c1', contentHtml: '', merge: { rowSpan: 1, colSpan: 1 } },
          ],
        },
      ],
      columnFractions: [0.5, 0.5],
      rowFractions: [0.5, 0.5],
      showBorders: true,
    };

    const idx = new TableGridIndex(props);
    const cols = idx.buildColumnCatalog();

    expect(cols.some((c) => (c.name ?? '').includes('10'))).toBe(false);
    expect(cols.some((c) => (c.name ?? '').includes('20'))).toBe(false);
  });
});


