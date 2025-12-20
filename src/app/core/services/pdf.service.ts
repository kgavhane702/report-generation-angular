import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { DocumentModel } from '../../models/document.model';
import { ChartExportService } from './chart-export.service';
import { convertDocumentLogo } from '../utils/image-converter.util';
import { ExportUiStateService } from './export-ui-state.service';

@Injectable({
  providedIn: 'root',
})
export class PdfService {
  private readonly apiUrl = 'http://localhost:8080/api/generate-pdf';
  private readonly chartExportService = inject(ChartExportService);
  private readonly exportUi = inject(ExportUiStateService);

  constructor(private http: HttpClient) {}

  async generatePDF(documentModel: DocumentModel): Promise<Observable<Blob>> {
    const documentWithCharts = await this.chartExportService.exportAllCharts(documentModel);
    const documentWithLogo = await convertDocumentLogo(documentWithCharts);

    return this.http.post<Blob>(
      this.apiUrl,
      { document: documentWithLogo },
      {
        headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
        responseType: 'blob' as 'json',
      }
    );
  }

  async downloadPDF(documentModel: DocumentModel): Promise<void> {
    this.exportUi.start('Generating PDF…');
    try {
      const pdfObservable = await this.generatePDF(documentModel);
      // At this point charts/logo are prepared; backend request is in-flight.
      this.exportUi.updateMessage('Generating PDF…');

      const blob = await firstValueFrom(pdfObservable);
      if (!blob) {
        throw new Error('Failed to generate PDF');
      }

      const url = window.URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = `${(documentModel.title || 'document').replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${Date.now()}.pdf`;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } finally {
      this.exportUi.stop();
    }
  }

  async generatePDFUrl(documentModel: DocumentModel): Promise<string> {
    this.exportUi.start('Generating PDF…');
    try {
      const pdfObservable = await this.generatePDF(documentModel);
      this.exportUi.updateMessage('Generating PDF…');
      const blob = await firstValueFrom(pdfObservable);
      if (!blob) {
        throw new Error('Failed to generate PDF');
      }
      return window.URL.createObjectURL(blob);
    } finally {
      this.exportUi.stop();
    }
  }
}

