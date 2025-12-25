import { ChartData, ChartType } from '../../../models/chart-data.model';
import { TabularImportWarningDto } from '../../tabular-import/models/tabular-dataset.model';
import { ImportFormat } from '../../tabular-import/enums/import-format.enum';

export type ChartImportAggregation = 'SUM' | 'AVG' | 'COUNT';

export interface TabularPreviewDto {
  totalRows: number;
  totalCols: number;
  rows: string[][];
}

export interface ChartImportMappingDto {
  hasHeader: boolean;
  headerRowIndex: number;
  categoryColumnIndex: number;
  seriesColumnIndexes: number[];
  aggregation: ChartImportAggregation;
}

export interface ChartImportResponseDto {
  chartData: ChartData;
  mapping: ChartImportMappingDto;
  preview: TabularPreviewDto;
  warnings: TabularImportWarningDto[];
}

export interface ChartImportRequestOptions {
  file: File;
  chartType: ChartType;

  // Parser options
  format?: ImportFormat;
  sheetIndex?: number;
  delimiter?: string;

  // Mapping options
  hasHeader?: boolean;
  headerRowIndex?: number;
  categoryColumnIndex?: number;
  seriesColumnIndexes?: number[];
  aggregation?: ChartImportAggregation;
}


