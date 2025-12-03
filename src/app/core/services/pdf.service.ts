import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { DocumentModel } from '../../models/document.model';
import { ChartExportService } from './chart-export.service';

/**
 * Service for generating PDFs from documents
 */
@Injectable({
  providedIn: 'root',
})
export class PdfService {
  // private readonly apiUrl = 'http://localhost:3000/api/generate-pdf'; // Puppeteer Node backend
  private readonly apiUrl = 'http://localhost:8080/api/generate-pdf'; // Java Playwright backend
  // private readonly apiUrl = 'http://localhost:4000/api/generate-pdf'; // Node Playwright backend
  private readonly chartExportService = inject(ChartExportService);

  constructor(private http: HttpClient) {}

  /**
   * Generate PDF from document
   */
  async generatePDF(documentModel: DocumentModel): Promise<Observable<Blob>> {
    console.log('Starting PDF generation, exporting charts...');
    // Export all charts to base64 before sending to backend
    const documentWithCharts = await this.chartExportService.exportAllCharts(documentModel);

    // Verify charts were exported
    let chartCount = 0;
    let exportedCount = 0;
    if (documentWithCharts.sections) {
      for (const section of documentWithCharts.sections) {
        for (const subsection of section.subsections) {
          for (const page of subsection.pages) {
            for (const widget of page.widgets) {
              if (widget.type === 'chart') {
                chartCount++;
                const props = widget.props as any;
                if (props.exportedImage) {
                  exportedCount++;
                  console.log(`Chart ${widget.id} has exportedImage (length: ${props.exportedImage.length})`);
                } else {
                  console.warn(`Chart ${widget.id} missing exportedImage`);
                }
              }
            }
          }
        }
      }
    }
    console.log(`Chart export summary: ${exportedCount}/${chartCount} charts exported`);

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
    });

    return this.http.post<Blob>(
      this.apiUrl,
      { document: documentWithCharts },
      {
        headers,
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

