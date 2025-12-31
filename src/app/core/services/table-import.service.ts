import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { TableCellMerge, TableRow } from '../../models/widget.model';
import type { ImportFormat } from '../tabular-import/enums/import-format.enum';
import type { HttpRequestSpec } from '../../shared/http-request/models/http-request.model';
import type { ApiResponseDto } from './api-response.model';

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

export interface TableImportFromUrlRequestDto {
  request: HttpRequestSpec;
  /** Optional parser override; otherwise backend detects. */
  format?: ImportFormat;
  sheetIndex?: number;
  delimiter?: string;
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

  importXml(file: File): Observable<ApiResponseDto<TableImportResponseDto>> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<ApiResponseDto<TableImportResponseDto>>('/api/table/import/xml', form);
  }

  importFromUrl(request: TableImportFromUrlRequestDto): Observable<ApiResponseDto<TableImportResponseDto>> {
    return this.http.post<ApiResponseDto<TableImportResponseDto>>('/api/table/import/url', request);
  }
}
