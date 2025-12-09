import { Injectable } from '@angular/core';
import { DocumentModel } from '../../models/document.model';

/**
 * Export metadata included in exported JSON
 */
export interface ExportMetadata {
  exportedAt: string;
  exportedBy?: string;
  version: string;
  appVersion?: string;
  description?: string;
}

/**
 * Complete export format including document and metadata
 */
export interface DocumentExport {
  metadata: ExportMetadata;
  document: DocumentModel;
}

/**
 * Service for exporting documents to JSON format
 */
@Injectable({
  providedIn: 'root',
})
export class ExportService {
  /**
   * Export document to JSON string
   */
  async exportToJson(documentModel: DocumentModel, options?: {
    includeMetadata?: boolean;
    exportedBy?: string;
    description?: string;
  }): Promise<string> {
    const clonedDocument = this.deepClone(documentModel);
    
    // Convert logo image to base64 if it's a local asset
    if (clonedDocument.logo?.url) {
      const logoUrl = clonedDocument.logo.url;
      if (logoUrl.startsWith('/assets/') || logoUrl.startsWith('assets/')) {
        try {
          const base64Url = await this.convertImageToBase64(logoUrl);
          if (base64Url) {
            clonedDocument.logo.url = base64Url;
          }
        } catch (error) {
          console.warn('Failed to convert logo to base64:', error);
        }
      }
    }

    const exportData: DocumentExport = {
      metadata: {
        exportedAt: new Date().toISOString(),
        exportedBy: options?.exportedBy,
        version: clonedDocument.version || '1.0.0',
        appVersion: '1.0.0', // Could be from environment
        description: options?.description,
      },
      document: clonedDocument,
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Convert image URL to base64 data URL
   */
  private async convertImageToBase64(imageUrl: string): Promise<string | null> {
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        return null;
      }
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error converting image to base64:', error);
      return null;
    }
  }

  /**
   * Export document and trigger download
   */
  async exportToFile(documentModel: DocumentModel, filename?: string, options?: {
    includeMetadata?: boolean;
    exportedBy?: string;
    description?: string;
  }): Promise<void> {
    const json = await this.exportToJson(documentModel, options);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || this.generateFilename(documentModel);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Export document to JSON and copy to clipboard
   */
  async exportToClipboard(documentModel: DocumentModel, options?: {
    includeMetadata?: boolean;
    exportedBy?: string;
    description?: string;
  }): Promise<boolean> {
    try {
      const json = await this.exportToJson(documentModel, options);
      await navigator.clipboard.writeText(json);
      return true;
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      return false;
    }
  }

  /**
   * Generate filename from document title
   */
  private generateFilename(documentModel: DocumentModel): string {
    const title = documentModel.title || 'document';
    const sanitized = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const timestamp = new Date().toISOString().split('T')[0];
    return `${sanitized}-${timestamp}.json`;
  }

  /**
   * Deep clone object to avoid reference issues
   */
  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }
}

