import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ImportFormat } from '../enums/import-format.enum';
import { TabularImportOptions } from '../models/tabular-import-options.model';
import { TabularImportResponseDto } from '../models/tabular-dataset.model';

/**
 * HTTP client for the backend generic tabular import endpoint.
 *
 * Endpoint: POST /api/import/tabular (multipart)
 */
@Injectable({ providedIn: 'root' })
export class TabularImportApi {
  private readonly http = inject(HttpClient);

  importFile(file: File, options?: TabularImportOptions): Observable<TabularImportResponseDto> {
    const form = new FormData();
    form.append('file', file);
    if (options?.sheetIndex !== undefined && options?.sheetIndex !== null) {
      form.append('sheetIndex', String(options.sheetIndex));
    }
    const format: ImportFormat | undefined = options?.format;
    if (format) {
      form.append('format', format);
    }
    return this.http.post<TabularImportResponseDto>('/api/import/tabular', form);
  }
}


