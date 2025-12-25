import type { ImportFormat } from '../../../core/tabular-import/enums/import-format.enum';
import type { ChartType } from '../../../models/chart-data.model';
import type { ChartImportAggregation } from '../../../core/chart-import/models/chart-import.model';
import type { HttpRequestSpec } from './http-request.model';

export type HttpDataSourceKind = 'http';

export interface TableHttpDataSourceConfig {
  kind: HttpDataSourceKind;
  request: HttpRequestSpec;

  /** Optional parser override (otherwise backend detects from response). */
  format?: ImportFormat;
  /** Optional parser options. */
  sheetIndex?: number;
  delimiter?: string;
}

export interface ChartHttpDataSourceConfig {
  kind: HttpDataSourceKind;
  request: HttpRequestSpec;

  /** Optional parser override (otherwise backend detects from response). */
  format?: ImportFormat;
  /** Optional parser options. */
  sheetIndex?: number;
  delimiter?: string;

  /** Chart mapping options */
  chartType: ChartType;
  hasHeader?: boolean;
  headerRowIndex?: number;
  categoryColumnIndex?: number;
  seriesColumnIndexes?: number[];
  aggregation?: ChartImportAggregation;
}



