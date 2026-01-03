import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { DocumentModel } from '../../models/document.model';
import { ChartExportService } from './chart-export.service';
import { convertDocumentLogo } from '../utils/image-converter.util';
import { ExportUiStateService } from './export-ui-state.service';
import { RemoteWidgetPreloadService } from './remote-widget-preload.service';

export type DocumentDownloadFormat = 'pdf' | 'docx' | 'pptx';

@Injectable({
  providedIn: 'root',
})
export class DocumentDownloadService {
  private readonly http = inject(HttpClient);
  private readonly chartExportService = inject(ChartExportService);
  private readonly exportUi = inject(ExportUiStateService);
  private readonly urlPreload = inject(RemoteWidgetPreloadService);

  // Backend: POST /api/document/export?format=pdf (format defaults to pdf if omitted)
  private readonly apiUrl = '/api/document/export';

  async requestDownloadBlob(
    documentModel: DocumentModel,
    format: DocumentDownloadFormat = 'pdf'
  ): Promise<Observable<Blob>> {
    // Run URL table/text preloading and chart capture in parallel.
    // - URL preloading is network-bound (backend calls)
    // - Chart export is UI/DOM-bound (capture)
    // Parallelizing overlaps work and reduces total export time.
    this.exportUi.updateMessage('Preparing content…');

    const hasCharts = hasAnyCharts(documentModel);
    const [documentWithUrlData, chartExportDoc] = await Promise.all([
      this.urlPreload.preloadUrlWidgets(documentModel),
      hasCharts ? this.chartExportService.exportAllCharts(documentModel) : Promise.resolve(documentModel),
    ]);

    const merged = applyExportedChartImages(documentWithUrlData, chartExportDoc);
    const documentWithLogo = await convertDocumentLogo(merged);

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

function applyExportedChartImages(target: DocumentModel, source: DocumentModel): DocumentModel {
  const exportedByWidgetId = new Map<string, string>();

  for (const section of source.sections || []) {
    for (const subsection of section.subsections || []) {
      for (const page of subsection.pages || []) {
        for (const widget of page.widgets || []) {
          if (widget.type !== 'chart') continue;
          const props: any = (widget as any).props || {};
          const img = (props.exportedImage ?? '').toString();
          if (img) exportedByWidgetId.set(widget.id, img);
        }
      }
    }
  }

  if (exportedByWidgetId.size === 0) return target;

  for (const section of target.sections || []) {
    for (const subsection of section.subsections || []) {
      for (const page of subsection.pages || []) {
        for (const widget of page.widgets || []) {
          if (widget.type !== 'chart') continue;
          const img = exportedByWidgetId.get(widget.id);
          if (!img) continue;
          const props: any = (widget as any).props || {};
          (widget as any).props = { ...props, exportedImage: img };
        }
      }
    }
  }

  return target;
}

function hasAnyCharts(document: DocumentModel): boolean {
  for (const section of document.sections || []) {
    for (const subsection of section.subsections || []) {
      for (const page of subsection.pages || []) {
        for (const widget of page.widgets || []) {
          if (widget.type === 'chart') return true;
        }
      }
    }
  }
  return false;
}


