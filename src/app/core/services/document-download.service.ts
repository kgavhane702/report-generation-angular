import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { DocumentModel } from '../../models/document.model';
import { ChartExportService } from './chart-export.service';
import { convertDocumentLogo } from '../utils/image-converter.util';
import { ExportUiStateService } from './export-ui-state.service';

export type DocumentDownloadFormat = 'pdf' | 'docx' | 'pptx';

@Injectable({
  providedIn: 'root',
})
export class DocumentDownloadService {
  private readonly http = inject(HttpClient);
  private readonly chartExportService = inject(ChartExportService);
  private readonly exportUi = inject(ExportUiStateService);

  // Backend: POST /api/document/export?format=pdf (format defaults to pdf if omitted)
  private readonly apiUrl = '/api/document/export';

  async requestDownloadBlob(
    documentModel: DocumentModel,
    format: DocumentDownloadFormat = 'pdf'
  ): Promise<Observable<Blob>> {
    const documentWithCharts = await this.chartExportService.exportAllCharts(documentModel);
    const documentWithLogo = await convertDocumentLogo(documentWithCharts);

    const url = `${this.apiUrl}?format=${encodeURIComponent(format)}`;
    return this.http.post<Blob>(
      url,
      { document: documentWithLogo },
      {
        headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
        responseType: 'blob' as 'json',
      }
    );
  }

  async download(
    documentModel: DocumentModel,
    format: DocumentDownloadFormat = 'pdf'
  ): Promise<void> {
    const label = format.toUpperCase();
    this.exportUi.start(`Generating ${label}…`);
    try {
      const download$ = await this.requestDownloadBlob(documentModel, format);
      this.exportUi.updateMessage(`Generating ${label}…`);

      const blob = await firstValueFrom(download$);
      if (!blob) throw new Error(`Failed to generate ${label}`);

      const url = window.URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = `${(documentModel.title || 'document')
        .replace(/[^a-z0-9]/gi, '-')
        .toLowerCase()}-${Date.now()}.${this.getExtension(format)}`;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } finally {
      this.exportUi.stop();
    }
  }

  async createObjectUrl(
    documentModel: DocumentModel,
    format: DocumentDownloadFormat = 'pdf'
  ): Promise<string> {
    const label = format.toUpperCase();
    this.exportUi.start(`Generating ${label}…`);
    try {
      const download$ = await this.requestDownloadBlob(documentModel, format);
      this.exportUi.updateMessage(`Generating ${label}…`);

      const blob = await firstValueFrom(download$);
      if (!blob) throw new Error(`Failed to generate ${label}`);

      return window.URL.createObjectURL(blob);
    } finally {
      this.exportUi.stop();
    }
  }

  private getExtension(format: DocumentDownloadFormat): string {
    switch (format) {
      case 'pdf':
        return 'pdf';
      case 'docx':
        return 'docx';
      case 'pptx':
        return 'pptx';
      default:
        return 'bin';
    }
  }
}


