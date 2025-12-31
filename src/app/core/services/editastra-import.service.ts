import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import type { ImportFormat } from '../tabular-import/enums/import-format.enum';
import type { HttpRequestSpec } from '../../shared/http-request/models/http-request.model';
import type { ApiResponseDto } from './api-response.model';

export interface EditastraImportResponseDto {
  contentHtml: string;
}

export interface EditastraImportFromUrlRequestDto {
  request: HttpRequestSpec;
  /** Optional parser override; otherwise backend detects. */
  format?: ImportFormat;
  sheetIndex?: number;
  delimiter?: string;
}

@Injectable({ providedIn: 'root' })
export class EditastraImportService {
  private readonly http = inject(HttpClient);

  importFromUrl(request: EditastraImportFromUrlRequestDto): Observable<ApiResponseDto<EditastraImportResponseDto>> {
    return this.http.post<ApiResponseDto<EditastraImportResponseDto>>('/api/editastra/import/url', request);
  }
}


