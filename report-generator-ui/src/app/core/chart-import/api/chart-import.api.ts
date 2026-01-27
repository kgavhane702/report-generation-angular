import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ChartImportRequestOptions, ChartImportResponseDto } from '../models/chart-import.model';
import type { HttpRequestSpec } from '../../../shared/http-request/models/http-request.model';
import type { ImportFormat } from '../../tabular-import/enums/import-format.enum';
import type { ChartImportAggregation } from '../models/chart-import.model';

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

/**
 * HTTP client for backend chart import endpoint.
 *
 * Endpoint: POST /api/import/chart (multipart)
 */
@Injectable({ providedIn: 'root' })
export class ChartImportApi {
  private readonly http = inject(HttpClient);

  importChart(options: ChartImportRequestOptions): Observable<ApiResponseDto<ChartImportResponseDto>> {
    const form = new FormData();
    form.append('file', options.file);
    form.append('chartType', options.chartType);

    if (options.format) {
      form.append('format', options.format);
    }
    if (options.sheetIndex !== undefined && options.sheetIndex !== null) {
      form.append('sheetIndex', String(options.sheetIndex));
    }
    if (options.delimiter) {
      form.append('delimiter', options.delimiter);
    }

    if (options.hasHeader !== undefined && options.hasHeader !== null) {
      form.append('hasHeader', String(!!options.hasHeader));
    }
    if (options.headerRowIndex !== undefined && options.headerRowIndex !== null) {
      form.append('headerRowIndex', String(options.headerRowIndex));
    }
    if (options.categoryColumnIndex !== undefined && options.categoryColumnIndex !== null) {
      form.append('categoryColumnIndex', String(options.categoryColumnIndex));
    }
    if (options.seriesColumnIndexes && options.seriesColumnIndexes.length > 0) {
      for (const idx of options.seriesColumnIndexes) {
        form.append('seriesColumnIndexes', String(idx));
      }
    }
    if (options.aggregation) {
      form.append('aggregation', options.aggregation);
    }

    return this.http.post<ApiResponseDto<ChartImportResponseDto>>('/api/import/chart', form);
  }

  importChartFromUrl(request: ChartImportFromUrlRequestDto): Observable<ApiResponseDto<ChartImportResponseDto>> {
    return this.http.post<ApiResponseDto<ChartImportResponseDto>>('/api/import/chart/url', request);
  }
}

export interface ChartImportFromUrlRequestDto {
  request: HttpRequestSpec;
  format?: ImportFormat;
  sheetIndex?: number;
  delimiter?: string;

  chartType: string;

  hasHeader?: boolean;
  headerRowIndex?: number;
  categoryColumnIndex?: number;
  seriesColumnIndexes?: number[];
  aggregation?: ChartImportAggregation;
}


