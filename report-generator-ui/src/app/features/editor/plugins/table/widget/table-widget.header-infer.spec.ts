import { TableWidgetComponent } from './table-widget.component';

describe('TableWidgetComponent - inferHeaderRowCountFromRows', () => {
  it('infers 3 header rows for nested JSON-style headers (address > geo > lat/lng)', () => {
    const c = Object.create(TableWidgetComponent.prototype) as any;

    // Reuse the component's resolveCoveredCell + htmlToPlainTextForSizing dependencies indirectly by
    // providing minimal helpers it uses in getTopLevelColCount/getResolvedRowLabels.
    c.getTopLevelColCount = (rows: any[]) =>
      Math.max(0, ...((rows ?? []).map((r) => (Array.isArray(r?.cells) ? r.cells.length : 0)) as number[]));
    c.htmlToPlainTextForSizing = (html: string) => (html ?? '').toString().replace(/<[^>]*>/g, ' ');
    c.resolveCoveredCell = (_rows: any[], _rowIndex: number, _colIndex: number, cell: any) => cell;
    c.getResolvedRowLabels = TableWidgetComponent.prototype['getResolvedRowLabels'].bind(c);
    c.inferHeaderRowCountFromRows = TableWidgetComponent.prototype['inferHeaderRowCountFromRows'].bind(c);

    const rows: any[] = [
      // Row 0: address spans 5 cols; simple cols span 3 header rows
      {
        id: 'h0',
        cells: [
          { id: 'id', contentHtml: '<div>id</div>', merge: { rowSpan: 3, colSpan: 1 } },
          { id: 'name', contentHtml: '<div>name</div>', merge: { rowSpan: 3, colSpan: 1 } },
          { id: 'username', contentHtml: '<div>username</div>', merge: { rowSpan: 3, colSpan: 1 } },
          { id: 'email', contentHtml: '<div>email</div>', merge: { rowSpan: 3, colSpan: 1 } },
          { id: 'address', contentHtml: '<div>address</div>', merge: { rowSpan: 1, colSpan: 5 } },
          { id: 'address_cov1', contentHtml: '', coveredBy: { row: 0, col: 4 } },
          { id: 'address_cov2', contentHtml: '', coveredBy: { row: 0, col: 4 } },
          { id: 'address_cov3', contentHtml: '', coveredBy: { row: 0, col: 4 } },
          { id: 'address_cov4', contentHtml: '', coveredBy: { row: 0, col: 4 } },
        ],
      },
      // Row 1: street/suite/city/zipcode span down; geo spans lat/lng
      {
        id: 'h1',
        cells: [
          { id: 'id_cov', contentHtml: '', coveredBy: { row: 0, col: 0 } },
          { id: 'name_cov', contentHtml: '', coveredBy: { row: 0, col: 1 } },
          { id: 'username_cov', contentHtml: '', coveredBy: { row: 0, col: 2 } },
          { id: 'email_cov', contentHtml: '', coveredBy: { row: 0, col: 3 } },
          { id: 'street', contentHtml: '<div>street</div>', merge: { rowSpan: 2, colSpan: 1 } },
          { id: 'suite', contentHtml: '<div>suite</div>', merge: { rowSpan: 2, colSpan: 1 } },
          { id: 'city', contentHtml: '<div>city</div>', merge: { rowSpan: 2, colSpan: 1 } },
          { id: 'zipcode', contentHtml: '<div>zipcode</div>', merge: { rowSpan: 2, colSpan: 1 } },
          { id: 'geo', contentHtml: '<div>geo</div>', merge: { rowSpan: 1, colSpan: 2 } },
        ],
      },
      // Row 2: lat/lng leaf headers (no merges needed)
      {
        id: 'h2',
        cells: [
          { id: 'id_cov2', contentHtml: '', coveredBy: { row: 0, col: 0 } },
          { id: 'name_cov2', contentHtml: '', coveredBy: { row: 0, col: 1 } },
          { id: 'username_cov2', contentHtml: '', coveredBy: { row: 0, col: 2 } },
          { id: 'email_cov2', contentHtml: '', coveredBy: { row: 0, col: 3 } },
          { id: 'street_cov', contentHtml: '', coveredBy: { row: 1, col: 4 } },
          { id: 'suite_cov', contentHtml: '', coveredBy: { row: 1, col: 5 } },
          { id: 'city_cov', contentHtml: '', coveredBy: { row: 1, col: 6 } },
          { id: 'zipcode_cov', contentHtml: '', coveredBy: { row: 1, col: 7 } },
          { id: 'lat', contentHtml: '<div>lat</div>' },
          { id: 'lng', contentHtml: '<div>lng</div>' },
        ],
      },
    ];

    expect(c.inferHeaderRowCountFromRows(rows)).toBe(3);
  });
});


