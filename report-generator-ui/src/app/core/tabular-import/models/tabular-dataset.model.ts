export interface TabularImportWarningDto {
  code: string;
  message: string;
}

export interface TabularCoveredByDto {
  row: number;
  col: number;
}

export interface TabularMergeDto {
  rowSpan: number;
  colSpan: number;
}

export interface TabularCellDto {
  id: string;
  contentHtml: string;
  merge: TabularMergeDto | null;
  coveredBy: TabularCoveredByDto | null;
}

export interface TabularRowDto {
  id: string;
  cells: TabularCellDto[];
}

/**
 * Format-agnostic internal representation (IR) of imported tabular data.
 * Mirrors the backend `TabularDataset` contract.
 */
export interface TabularDatasetDto {
  rows: TabularRowDto[];
  columnFractions: number[];
  rowFractions: number[];
}

export interface TabularImportResponseDto {
  dataset: TabularDatasetDto;
  warnings: TabularImportWarningDto[];
}


