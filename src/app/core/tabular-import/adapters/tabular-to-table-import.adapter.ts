import { TableImportFromExcelRequest } from '../../services/table-toolbar.service';
import { TabularDatasetDto } from '../models/tabular-dataset.model';

/**
 * Adapter: TabularDataset -> TableImportFromExcelRequest (table widget consumer).
 */
export function tabularDatasetToTableImportRequest(
  dataset: TabularDatasetDto,
  widgetId: string
): TableImportFromExcelRequest {
  return {
    widgetId,
    rows: dataset.rows.map((r) => ({
      id: r.id,
      cells: r.cells.map((c) => ({
        id: c.id,
        contentHtml: c.contentHtml ?? '',
        merge: c.merge ?? null,
        coveredBy: c.coveredBy ?? null,
      })),
    })),
    columnFractions: dataset.columnFractions,
    rowFractions: dataset.rowFractions,
  };
}


