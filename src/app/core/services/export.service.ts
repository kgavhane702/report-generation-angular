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
  exportToJson(documentModel: DocumentModel, options?: {
    includeMetadata?: boolean;
    exportedBy?: string;
    description?: string;
  }): string {
    const exportData: DocumentExport = {
      metadata: {
        exportedAt: new Date().toISOString(),
        exportedBy: options?.exportedBy,
        version: documentModel.version || '1.0.0',
        appVersion: '1.0.0', // Could be from environment
        description: options?.description,
      },
      document: this.deepClone(documentModel),
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Export document and trigger download
   */
  exportToFile(documentModel: DocumentModel, filename?: string, options?: {
    includeMetadata?: boolean;
    exportedBy?: string;
    description?: string;
  }): void {
    const json = this.exportToJson(documentModel, options);
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
      const json = this.exportToJson(documentModel, options);
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

