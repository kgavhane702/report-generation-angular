import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { TableCellMerge, TableRow } from '../../models/widget.model';

export interface ExcelTableImportResponseDto {
  rows: Array<{
    id: string;
    cells: Array<{
      id: string;
      contentHtml: string;
      merge: TableCellMerge | null;
      coveredBy: { row: number; col: number } | null;
    }>;
  }>;
  columnFractions: number[];
  rowFractions: number[];
}

@Injectable({ providedIn: 'root' })
export class TableImportService {
  private readonly http = inject(HttpClient);

  importExcel(file: File, sheetIndex?: number): Observable<ExcelTableImportResponseDto> {
    const form = new FormData();
    form.append('file', file);
    if (sheetIndex !== undefined && sheetIndex !== null) {
      form.append('sheetIndex', String(sheetIndex));
    }

    return this.http.post<ExcelTableImportResponseDto>('/api/table/import/excel', form);
  }
}
