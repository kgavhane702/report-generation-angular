import { Injectable } from '@angular/core';
import { DocumentModel } from '../../models/document.model';
import { convertDocumentLogo } from '../utils/image-converter.util';
import { createEmptyChartData } from '../../models/chart-data.model';
import type { WidgetModel } from '../../models/widget.model';

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
    const clonedDocument = JSON.parse(JSON.stringify(documentModel)) as DocumentModel;
    // URL-based widgets: persist only the request config, not the fetched data.
    this.stripRemoteWidgetData(clonedDocument);
    const documentWithLogo = await convertDocumentLogo(clonedDocument);

    const exportData: DocumentExport = {
      metadata: {
        exportedAt: new Date().toISOString(),
        exportedBy: options?.exportedBy,
        version: documentWithLogo.version || '1.0.0',
        appVersion: '1.0.0',
        description: options?.description,
      },
      document: documentWithLogo,
    };

    return JSON.stringify(exportData, null, 2);
  }

  private stripRemoteWidgetData(document: DocumentModel): void {
    for (const section of document.sections || []) {
      for (const subsection of section.subsections || []) {
        for (const page of subsection.pages || []) {
          const widgets = page.widgets || [];
          for (const widget of widgets as unknown as WidgetModel[]) {
            if (!widget || !widget.props) continue;
            const props: any = widget.props as any;
            const ds: any = props.dataSource;
            if (!ds || ds.kind !== 'http') continue;

            // Never export transient loading flags/messages.
            props.loading = false;
            props.loadingMessage = undefined;

            if (widget.type === 'chart') {
              // Replace with empty dataset; keep chart type/provider + dataSource.
              const chartType = (props.chartType as any) || 'column';
              props.data = createEmptyChartData(chartType as any);
              props.exportedImage = undefined;
            } else if (widget.type === 'table') {
              // Replace with a minimal empty grid; keep styling flags + dataSource.
              // Optional: preserve existing header row(s) for URL tables, so users can keep custom headers/conditions
              // while still stripping remote (fetched) body data from exports.
              const preserveHeader = props.preserveHeaderOnUrlLoad === true;
              const hasHeaderFlag = props.headerRow === true;
              const headerRowCount =
                typeof props.headerRowCount === 'number' && Number.isFinite(props.headerRowCount)
                  ? Math.max(0, Math.trunc(props.headerRowCount))
                  : hasHeaderFlag
                    ? 1
                    : 0;

              const existingRows: any[] = Array.isArray(props.rows) ? props.rows : [];
              const headerRows = preserveHeader && headerRowCount > 0 ? existingRows.slice(0, headerRowCount) : [];

              // Create an empty placeholder body row that matches the header's column count (best-effort),
              // otherwise fall back to 1x1.
              const headerColCount =
                headerRows.length > 0
                  ? Math.max(
                      1,
                      ...headerRows.map((r) => (Array.isArray(r?.cells) ? r.cells.length : 0))
                    )
                  : 1;
              const emptyBodyRow = {
                id: 'row-0-body',
                cells: Array.from({ length: headerColCount }, (_, i) => ({
                  id: `cell-0-${i}`,
                  contentHtml: '',
                })),
              };

              props.rows = headerRows.length > 0 ? [...headerRows, emptyBodyRow] : [emptyBodyRow];
              // IMPORTANT: Preserve existing sizing fractions (if present) so exported+reimported URL tables
              // retain the user's column/row sizing after the remote data loads again.
              // These arrays may not match the 1x1 placeholder grid, but the table widget normalizes them safely.
              if (!Array.isArray(props.columnFractions) || props.columnFractions.length === 0) {
                props.columnFractions = [1];
              }
              if (!Array.isArray(props.rowFractions) || props.rowFractions.length === 0) {
                props.rowFractions = [1];
              }
              props.mergedRegions = [];
            }
          }
        }
      }
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
    } catch {
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

}

