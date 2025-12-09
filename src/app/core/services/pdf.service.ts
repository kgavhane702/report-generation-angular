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
    console.log('Starting PDF generation, exporting charts and logo...');
    // Export all charts to base64 before sending to backend
    const documentWithCharts = await this.chartExportService.exportAllCharts(documentModel);

    // Convert logo image to base64 if it's a local asset
    const documentWithLogo = await this.convertLogoToBase64(documentWithCharts);

    // Verify charts were exported
    let chartCount = 0;
    let exportedCount = 0;
    if (documentWithLogo.sections) {
      for (const section of documentWithLogo.sections) {
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

    // Verify logo was converted
    if (documentWithLogo.logo?.url) {
      if (documentWithLogo.logo.url.startsWith('data:')) {
        console.log('Logo converted to base64 successfully');
      } else {
        console.warn('Logo URL is not a base64 data URL:', documentWithLogo.logo.url);
      }
    }

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
    });

    return this.http.post<Blob>(
      this.apiUrl,
      { document: documentWithLogo },
      {
        headers,
        responseType: 'blob' as 'json',
      }
    );
  }

  /**
   * Convert logo image to base64 data URL if it's a local asset
   */
  private async convertLogoToBase64(documentModel: DocumentModel): Promise<DocumentModel> {
    const clonedDocument = JSON.parse(JSON.stringify(documentModel)) as DocumentModel;
    
    if (clonedDocument.logo?.url) {
      const logoUrl = clonedDocument.logo.url;
      // Convert if it's a local asset path (not already a data URL or external URL)
      if (logoUrl.startsWith('/assets/') || logoUrl.startsWith('assets/')) {
        try {
          const base64Url = await this.convertImageToBase64(logoUrl);
          if (base64Url) {
            clonedDocument.logo.url = base64Url;
            console.log('Logo converted to base64');
          } else {
            console.warn('Failed to convert logo to base64 - returned null');
          }
        } catch (error) {
          console.error('Error converting logo to base64:', error);
        }
      } else if (logoUrl.startsWith('data:')) {
        console.log('Logo is already a data URL');
      } else {
        console.warn('Logo URL is not a local asset, may not work in PDF:', logoUrl);
      }
    }
    
    return clonedDocument;
  }

  /**
   * Convert image URL to base64 data URL
   */
  private async convertImageToBase64(imageUrl: string): Promise<string | null> {
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        console.error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        return null;
      }
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          console.log(`Image converted to base64, length: ${result.length}`);
          resolve(result);
        };
        reader.onerror = (error) => {
          console.error('FileReader error:', error);
          reject(error);
        };
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error converting image to base64:', error);
      return null;
    }
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

