import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { TableCellMerge, TableRow } from '../../models/widget.model';

export interface ApiErrorDto {
  code?: string;
  message: string;
  details?: Record<string, any> | null;
}

export interface ApiResponseDto<T> {
  success: boolean;
  data: T | null;
  error?: ApiErrorDto | null;
}

export interface TableImportResponseDto {
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

  importExcel(file: File, sheetIndex?: number): Observable<ApiResponseDto<TableImportResponseDto>> {
    const form = new FormData();
    form.append('file', file);
    if (sheetIndex !== undefined && sheetIndex !== null) {
      form.append('sheetIndex', String(sheetIndex));
    }

    return this.http.post<ApiResponseDto<TableImportResponseDto>>('/api/table/import/excel', form);
  }

  importCsv(file: File, delimiter?: string): Observable<ApiResponseDto<TableImportResponseDto>> {
    const form = new FormData();
    form.append('file', file);
    if (delimiter) {
      form.append('delimiter', delimiter);
    }
    return this.http.post<ApiResponseDto<TableImportResponseDto>>('/api/table/import/csv', form);
  }

  importJson(file: File): Observable<ApiResponseDto<TableImportResponseDto>> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<ApiResponseDto<TableImportResponseDto>>('/api/table/import/json', form);
  }
}
