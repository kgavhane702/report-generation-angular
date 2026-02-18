import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { DocumentModel } from '../../models/document.model';
import { ChartExportService } from './chart-export.service';
import { convertDocumentLogo } from '../utils/image-converter.util';
import { ExportUiStateService } from './export-ui-state.service';
import { RemoteWidgetPreloadService } from './remote-widget-preload.service';
import {
  coerceSlideThemeId,
  coerceThemeSwatchId,
  getSlideThemeById,
} from '../slide-design/slide-design.theme-config';

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
    documentModel: DocumentModel
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
    const themedForBackend = withResolvedThemeMetadata(merged);
    const documentWithLogo = await convertDocumentLogo(themedForBackend);

    // Frontend currently supports PDF only.
    const url = `${this.apiUrl}?format=pdf`;
    return this.http.post<Blob>(
      url,
      { document: documentWithLogo },
      {
        headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
        responseType: 'blob' as 'json',
      }
    );
  }

  async download(documentModel: DocumentModel): Promise<void> {
    const label = 'PDF';
    this.exportUi.start(`Generating ${label}…`);
    try {
      const download$ = await this.requestDownloadBlob(documentModel);
      this.exportUi.updateMessage(`Generating ${label}…`);

      const blob = await firstValueFrom(download$);
      if (!blob) throw new Error(`Failed to generate ${label}`);

      const url = window.URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = `${(documentModel.title || 'document')
        .replace(/[^a-z0-9]/gi, '-')
        .toLowerCase()}-${Date.now()}.pdf`;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } finally {
      this.exportUi.stop();
    }
  }

  async createObjectUrl(documentModel: DocumentModel): Promise<string> {
    const label = 'PDF';
    this.exportUi.start(`Generating ${label}…`);
    try {
      const download$ = await this.requestDownloadBlob(documentModel);
      this.exportUi.updateMessage(`Generating ${label}…`);

      const blob = await firstValueFrom(download$);
      if (!blob) throw new Error(`Failed to generate ${label}`);

      return window.URL.createObjectURL(blob);
    } finally {
      this.exportUi.stop();
    }
  }
}

function withResolvedThemeMetadata(document: DocumentModel): DocumentModel {
  const metadata = { ...(document.metadata ?? {}) } as Record<string, unknown>;
  const themeId = coerceSlideThemeId(metadata['slideThemeId']);
  const swatchMapRaw = metadata['slideThemeSwatchByTheme'];
  const swatchMap = (swatchMapRaw && typeof swatchMapRaw === 'object')
    ? (swatchMapRaw as Record<string, unknown>)
    : {};
  const swatchId = coerceThemeSwatchId(themeId, swatchMap[themeId]);
  const resolvedTheme = getSlideThemeById(themeId, swatchId);
  const defaultVariantId = resolvedTheme.variants[0]?.id;
  if (!defaultVariantId) {
    throw new Error(`Resolved theme has no variants: ${resolvedTheme.id}`);
  }

  const variants = Object.fromEntries(
    resolvedTheme.variants.map((variant) => [
      variant.id,
      {
        id: variant.id,
        surfaceBackground: variant.surfaceBackground,
        surfaceForeground: variant.surfaceForeground,
        fontFamily: variant.fontFamily || "'Inter', sans-serif",
        fontSize: variant.fontSize || '16px',
        titleFontFamily: variant.titleFontFamily || variant.fontFamily || "'Inter', sans-serif",
        titleFontSize: variant.titleFontSize || '28px',
        titleFontWeight: String(variant.titleFontWeight ?? 700),
        accentColor: variant.accentColor || variant.surfaceForeground,
        overlaySoftColor: variant.overlaySoftColor || 'rgba(255, 255, 255, 0.14)',
        overlayStrongColor: variant.overlayStrongColor || 'rgba(255, 255, 255, 0.2)',
        tabColor: variant.tabColor || variant.accentColor || variant.surfaceForeground,
      },
    ])
  );

  metadata['slideThemeResolved'] = {
    themeId: resolvedTheme.id,
    swatchId,
    defaultVariantId,
    variants,
  };

  const themeCss = buildThemeLayerCss(resolvedTheme.id, resolvedTheme.variants.map((variant) => variant.id));
  if (themeCss) {
    metadata['renderManifest'] = {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      themeCss,
    };
  } else {
    delete metadata['renderManifest'];
  }

  return {
    ...document,
    metadata,
  };
}

function buildThemeLayerCss(themeId: string, variantIds: string[]): string {
  const normalizedTheme = sanitizeCssToken(themeId);
  if (normalizedTheme !== 'curvy-magenta') {
    return '';
  }

  const coverVariant = sanitizeCssToken(variantIds[0] ?? '');
  const contentVariant = sanitizeCssToken(variantIds[1] ?? '');
  const blankVariant = sanitizeCssToken(variantIds[2] ?? '');

  if (!coverVariant || !contentVariant) {
    return '';
  }

  return [
    `.page__theme-layer.theme-${normalizedTheme}::after {`,
    `  right: 9.5%;`,
    `  top: 0;`,
    `  width: 4.8%;`,
    `  height: 17.5%;`,
    `  background: var(--slide-theme-tab, var(--slide-accent));`,
    `  border-radius: 0 0 2px 2px;`,
    `  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);`,
    `}`,
    `.page__theme-layer.theme-${normalizedTheme}.variant-${coverVariant}::before {`,
    `  left: 4%;`,
    `  right: 4%;`,
    `  top: 0;`,
    `  height: 42%;`,
    `  border-radius: 0 0 46% 46% / 0 0 30% 30%;`,
    `  background: var(--slide-theme-overlay-soft);`,
    `}`,
    `.page__theme-layer.theme-${normalizedTheme}.variant-${contentVariant}::before {`,
    `  left: 0;`,
    `  right: 0;`,
    `  top: 0;`,
    `  height: 34%;`,
    `  border-radius: 0 0 55% 55% / 0 0 26% 26%;`,
    `  background: var(--slide-theme-overlay-strong);`,
    `}`,
    blankVariant
      ? `.page__theme-layer.theme-${normalizedTheme}.variant-${blankVariant}::before { display: none; }`
      : '',
  ].filter(Boolean).join('\n');
}

function sanitizeCssToken(input: string): string {
  return input.trim().toLowerCase().replace(/_/g, '-').replace(/[^a-z0-9-]/g, '-');
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


