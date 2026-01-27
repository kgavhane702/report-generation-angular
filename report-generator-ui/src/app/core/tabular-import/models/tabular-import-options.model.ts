import { ImportFormat } from '../enums/import-format.enum';

export interface TabularImportOptions {
  /**
   * 0-based sheet index (XLSX).
   */
  sheetIndex?: number;

  /**
   * Explicit format. For now, XLSX is the only supported value.
   */
  format?: ImportFormat;
}


