import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { DocumentModel } from '../../models/document.model';
import { ChartExportService } from './chart-export.service';
import { convertDocumentLogo } from '../utils/image-converter.util';

/**
 * Service for generating PDFs from documents
 */
@Injectable({
  providedIn: 'root',
})
export class PdfService {
  private readonly apiUrl = 'http://localhost:8080/api/generate-pdf';
  private readonly chartExportService = inject(ChartExportService);

  constructor(private http: HttpClient) {}

  /**
   * Generate PDF from document
   */
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

  /**
   * Generate and download PDF
   */
  async downloadPDF(documentModel: DocumentModel): Promise<void> {
    try {
      const pdfObservable = await this.generatePDF(documentModel);
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
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw error;
    }
  }

  /**
   * Generate PDF and return as blob URL
   */
  async generatePDFUrl(documentModel: DocumentModel): Promise<string> {
    try {
      const pdfObservable = await this.generatePDF(documentModel);
      const blob = await firstValueFrom(pdfObservable);
      if (!blob) {
        throw new Error('Failed to generate PDF');
      }
      return window.URL.createObjectURL(blob);
    } catch (error) {
      console.error('Error generating PDF URL:', error);
      throw error;
    }
  }
}

