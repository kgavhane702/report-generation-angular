import {
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { firstValueFrom, filter, take } from 'rxjs';

import { DocumentModel } from '../../../models/document.model';
import { DocumentService } from '../../../core/services/document.service';
import { EditorStateService } from '../../../core/services/editor-state.service';
import { ChartRenderRegistry } from '../../../core/services/chart-render-registry.service';
import { getOrientedPageSizeMm } from '../../../core/utils/page-dimensions.util';

type ExportPageRef = {
  pageId: string;
  subsectionId: string;
  pageName: string;
  orientation: 'portrait' | 'landscape';
};

@Component({
  selector: 'app-export-shell',
  templateUrl: './export-shell.component.html',
  styleUrls: ['./export-shell.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExportShellComponent implements OnInit, OnDestroy {
  private readonly documentService = inject(DocumentService);
  protected readonly editorState = inject(EditorStateService);
  private readonly chartRenderRegistry = inject(ChartRenderRegistry);
  private readonly appRef = inject(ApplicationRef);

  private destroyed = false;

  protected pages: ExportPageRef[] = [];
  protected pageCss = '';

  async ngOnInit(): Promise<void> {
    try {
      this.prepareForExport();

      const doc = this.readDocumentFromWindow();
      if (!doc) {
        // Signal error to Playwright instead of hanging forever.
        (window as any).__RG_EXPORT_READY__ = false;
        (window as any).__RG_EXPORT_ERROR__ = 'No document provided for export';
        return;
      }

      // Lock the document so no selection/resize handles show.
      this.documentService.replaceDocument(doc);
      this.documentService.setDocumentLocked(true);

      this.pages = this.flattenPages(doc);
      this.pageCss = this.buildPagedMediaCss(doc, this.pages) + this.extractManifestThemeCss(doc);

      await this.waitForExportReady();

      (window as any).__RG_EXPORT_READY__ = true;
    } catch (e: any) {
      (window as any).__RG_EXPORT_READY__ = false;
      (window as any).__RG_EXPORT_ERROR__ = e?.message ?? String(e);
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    // Best effort cleanup: exit export mode.
    this.chartRenderRegistry.exitExportMode();
  }

  trackByPageId(_: number, p: ExportPageRef): string {
    return p.pageId;
  }

  private prepareForExport(): void {
    document.body.classList.add('rg-export-mode');
    (window as any).__RG_EXPORT_READY__ = false;
    delete (window as any).__RG_EXPORT_ERROR__;

    // Ensure deterministic layout.
    this.editorState.setZoom(100);
    this.editorState.setActiveWidget(null);

    // Charts should render even if offscreen.
    this.chartRenderRegistry.enterExportMode();
  }

  private readDocumentFromWindow(): DocumentModel | null {
    const w = window as any;
    const doc = w.__RG_EXPORT_DOC__;
    if (!doc) return null;
    return doc as DocumentModel;
  }

  private flattenPages(doc: DocumentModel): ExportPageRef[] {
    const result: ExportPageRef[] = [];
    const sections = doc.sections ?? [];

    for (const section of sections) {
      const subsections = section.subsections ?? [];
      for (const subsection of subsections) {
        const pages = subsection.pages ?? [];
        for (const page of pages) {
          const orientation = (page.orientation ?? 'landscape') as 'portrait' | 'landscape';
          const pageId = page.id;
          if (!pageId) continue;
          result.push({
            pageId,
            subsectionId: subsection.id,
            pageName: `page-${pageId}`,
            orientation,
          });
        }
      }
    }

    return result;
  }

  private buildPagedMediaCss(doc: DocumentModel, pages: ExportPageRef[]): string {
    const base = doc.pageSize ?? { widthMm: 254, heightMm: 190.5, dpi: 96 };
    const widthMm = base.widthMm ?? 254;
    const heightMm = base.heightMm ?? 190.5;

    let css = '';

    // Global print settings.
    css += `@media print {\n`;
    css += `  @page { margin: 0; }\n`;
    css += `  .page__surface { box-shadow: none !important; border: none !important; }\n`;
    css += `}\n`;

    // Named @page rules per page to support mixed orientations.
    for (const p of pages) {
      const oriented = getOrientedPageSizeMm({ widthMm, heightMm }, p.orientation);
      css += `@page ${p.pageName} { size: ${oriented.widthMm}mm ${oriented.heightMm}mm; margin: 0; }\n`;
    }

    return css;
  }

  private extractManifestThemeCss(doc: DocumentModel): string {
    const metadata = (doc.metadata ?? {}) as Record<string, unknown>;
    const renderManifest = metadata['renderManifest'];
    if (!renderManifest || typeof renderManifest !== 'object') {
      return '';
    }

    const themeCss = (renderManifest as Record<string, unknown>)['themeCss'];
    if (typeof themeCss !== 'string' || !themeCss.trim()) {
      return '';
    }

    return `\n${themeCss.trim()}\n`;
  }

  private async waitForExportReady(): Promise<void> {
    // Wait for Angular to finish initial rendering.
    await firstValueFrom(this.appRef.isStable.pipe(filter(Boolean), take(1)));

    // Wait for charts (export mode adds timeouts per chart).
    await this.chartRenderRegistry.waitForAllCharts();

    // Wait for fonts (text metrics).
    const anyDoc = document as any;
    if (anyDoc.fonts?.ready) {
      await anyDoc.fonts.ready;
    }

    // Wait for images (logos/header/footer/widget images).
    await this.waitForImages();

    // One extra frame for layout flush.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    if (this.destroyed) {
      throw new Error('Export aborted');
    }
  }

  private waitForImages(): Promise<void> {
    const images = Array.from(document.images ?? []);
    const pending = images.filter((img) => !img.complete);
    if (pending.length === 0) {
      return Promise.resolve();
    }

    return Promise.all(
      pending.map(
        (img) =>
          new Promise<void>((resolve) => {
            const cleanup = () => {
              img.removeEventListener('load', onLoad);
              img.removeEventListener('error', onLoad);
            };
            const onLoad = () => {
              cleanup();
              resolve();
            };
            img.addEventListener('load', onLoad);
            img.addEventListener('error', onLoad);
          })
      )
    ).then(() => undefined);
  }
}
