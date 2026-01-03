import { Injectable, inject, ApplicationRef, NgZone } from '@angular/core';
import { ChartWidgetProps, WidgetModel } from '../../models/widget.model';
import { DocumentModel } from '../../models/document.model';
import { EditorStateService } from './editor-state.service';
import { ChartRenderRegistry } from './chart-render-registry.service';
import { ExportUiStateService } from './export-ui-state.service';
import { LoggerService } from './logger.service';
import { ChartCaptureService } from './chart-capture.service';

/**
 * Chart location info for export
 */
interface ChartLocation {
  sectionId: string;
  subsectionId: string;
  pageId: string;
  widget: WidgetModel;
}

/**
 * ChartExportService
 * 
 * Handles exporting charts to base64 images for PDF generation.
 * 
 * Architecture:
 * - Uses ChartRenderRegistry for reliable render detection (no timeouts)
 * - Navigates through subsections to force chart visibility
 * - Waits for each chart to signal 'rendered' before capturing
 * - Captures charts as base64 images from SVG or Canvas
 */
@Injectable({
  providedIn: 'root',
})
export class ChartExportService {
  private readonly editorState = inject(EditorStateService);
  private readonly renderRegistry = inject(ChartRenderRegistry);
  private readonly appRef = inject(ApplicationRef);
  private readonly ngZone = inject(NgZone);
  private readonly exportUi = inject(ExportUiStateService);
  private readonly logger = inject(LoggerService);
  private readonly chartCapture = inject(ChartCaptureService);

  /**
   * In-memory cache for exported chart images (session-only).
   *
   * Keyed by a stable signature of the chart's props + size so we can reuse images
   * when the chart didn't change between exports.
   */
  private readonly exportedImageCache = new Map<string, string>();
  private readonly MAX_CACHE_ENTRIES = 100;
  private readonly CAPTURE_CONCURRENCY = 2;

  /**
   * Export a single chart widget to base64 image
   */
  async exportChartToBase64(widget: WidgetModel): Promise<string | null> {
    try {
      return await this.chartCapture.captureChartForWidget(widget);
    } catch (error) {
      console.error(`Failed to export chart ${widget.id}:`, error);
      return null;
    }
  }

  /**
   * Export all charts in a document to base64 images
   * 
   * This method:
   * 1. Collects all chart widgets from the document
   * 2. Groups them by subsection
   * 3. Navigates to each subsection to force chart rendering
   * 4. Waits for charts to signal 'rendered' via registry
   * 5. Captures each chart as base64 image
   * 6. Restores original navigation state
   */
  async exportAllCharts(document: DocumentModel): Promise<DocumentModel> {
    const updatedDocument = this.deepClone(document);
    const currentSubsectionId = this.editorState.activeSubsectionId();
    const currentPageId = this.editorState.activePageId();

    this.logger.debug('[ChartExport] Starting export. Current subsection:', currentSubsectionId);
    
    // Collect all chart widgets with their locations
    const chartLocations = this.collectChartLocations(updatedDocument);
    
    this.logger.debug('[ChartExport] Found charts:', chartLocations.length, chartLocations.map(c => ({
      widgetId: c.widget.id,
      subsectionId: c.subsectionId,
      pageId: c.pageId
    })));
    
    if (chartLocations.length === 0) {
      this.logger.debug('[ChartExport] No charts found, returning');
      return updatedDocument;
    }

    // Group charts by subsection
    const chartsBySubsection = this.groupBySubsection(chartLocations);
    this.logger.debug('[ChartExport] Charts by subsection:', Array.from(chartsBySubsection.keys()));

    // Enter export mode - signals charts to force render
    this.renderRegistry.enterExportMode();
    this.logger.debug('[ChartExport] Entered export mode');

    try {
      this.exportUi.start('Exporting charts…');

      // Process each subsection
      const entries = Array.from(chartsBySubsection.entries());
      for (let i = 0; i < entries.length; i++) {
        const [subsectionId, charts] = entries[i];
        this.logger.debug('[ChartExport] Processing subsection:', subsectionId, 'with', charts.length, 'charts');
        this.exportUi.updateMessage(`Exporting charts… (${i + 1}/${entries.length})`);
        
        // Navigate to subsection to make charts visible
        await this.navigateToSubsection(subsectionId);
        this.logger.debug('[ChartExport] Navigated to subsection:', subsectionId);

        // IMPORTANT:
        // The editor now renders ONLY the active page at a time.
        // So charts on non-active pages will not exist in the DOM unless we navigate to that page.
        const chartsByPage = this.groupByPage(charts);
        const pageEntries = Array.from(chartsByPage.entries());

        for (let p = 0; p < pageEntries.length; p++) {
          const [pageId, pageCharts] = pageEntries[p];
          this.logger.debug('[ChartExport] Processing page:', pageId, 'charts:', pageCharts.map(c => c.widget.id));

          this.exportUi.updateMessage(`Exporting charts… (${i + 1}/${entries.length})`);

          // Navigate to the specific page so its chart widgets are created + registered
          await this.navigateToPage(pageId);

          // Check registry state
          this.logger.debug('[ChartExport] Registry state after page nav:', 
            this.renderRegistry.registeredWidgetIds(),
            'Pending:', this.renderRegistry.pendingCount()
          );

          // Wait for charts on THIS page to render
          const chartWidgetIds = pageCharts.map(c => c.widget.id);
          this.logger.debug('[ChartExport] Waiting for charts to render (page):', chartWidgetIds);
          await this.waitForChartsToRender(chartWidgetIds);
          this.logger.debug('[ChartExport] Charts rendered for page:', pageId);

          // Capture charts on this page in parallel (bounded) to improve export time without freezing UI.
          // NOTE: We still navigate page-by-page (only active page is rendered), but within a page we can overlap captures.
          await runWithConcurrencyLimit(this.CAPTURE_CONCURRENCY, pageCharts, async (chartLocation) => {
            this.logger.debug('[ChartExport] Capturing chart:', chartLocation.widget.id);

            const cacheKey = this.getChartCacheKey(chartLocation.widget);
            const cached = cacheKey ? this.exportedImageCache.get(cacheKey) : undefined;
            const base64Image = cached ?? (await this.chartCapture.captureChartForWidget(chartLocation.widget));

            if (!cached && base64Image && cacheKey) {
              this.setCache(cacheKey, base64Image);
              this.logger.debug('[ChartExport] Cached exported image for:', chartLocation.widget.id);
            } else if (cached) {
              this.logger.debug('[ChartExport] Reused cached exported image for:', chartLocation.widget.id);
            }

            if (base64Image) {
              this.logger.debug('[ChartExport] Chart captured successfully:', chartLocation.widget.id, 'length:', base64Image.length);
              this.updateChartInDocument(
                updatedDocument,
                chartLocation.sectionId,
                chartLocation.subsectionId,
                chartLocation.pageId,
                chartLocation.widget.id,
                base64Image
              );
            } else {
              console.warn('[ChartExport] Failed to capture chart:', chartLocation.widget.id);
            }
          });
        }
      }
    } finally {
      // Exit export mode
      this.renderRegistry.exitExportMode();
      this.exportUi.stop();
      this.logger.debug('[ChartExport] Exited export mode');
      
      // Restore original navigation state
      if (currentSubsectionId) {
        await this.navigateToSubsection(currentSubsectionId);
        this.logger.debug('[ChartExport] Restored to subsection:', currentSubsectionId);
      }
      if (currentPageId) {
        // Ensure we restore the exact page too
        await this.navigateToPage(currentPageId);
        this.logger.debug('[ChartExport] Restored to page:', currentPageId);
      }
    }

    this.logger.debug('[ChartExport] Export complete');
    return updatedDocument;
  }

  /**
   * Collect all chart widgets from the document with their locations
   */
  private collectChartLocations(document: DocumentModel): ChartLocation[] {
    const locations: ChartLocation[] = [];

    if (!document.sections) {
      return locations;
    }

    for (const section of document.sections) {
      if (!section.subsections) continue;

      for (const subsection of section.subsections) {
        if (!subsection.pages) continue;

        for (const page of subsection.pages) {
          if (!page.widgets) continue;

          for (const widget of page.widgets) {
            if (widget.type === 'chart') {
              locations.push({
                sectionId: section.id,
                subsectionId: subsection.id,
                pageId: page.id,
                widget,
              });
            }
          }
        }
      }
    }

    return locations;
  }

  /**
   * Group chart locations by subsection ID
   */
  private groupBySubsection(locations: ChartLocation[]): Map<string, ChartLocation[]> {
    const grouped = new Map<string, ChartLocation[]>();

    for (const location of locations) {
      const existing = grouped.get(location.subsectionId) || [];
      existing.push(location);
      grouped.set(location.subsectionId, existing);
    }

    return grouped;
  }

  /**
   * Group chart locations by page ID (within a subsection)
   */
  private groupByPage(locations: ChartLocation[]): Map<string, ChartLocation[]> {
    const grouped = new Map<string, ChartLocation[]>();

    for (const location of locations) {
      const existing = grouped.get(location.pageId) || [];
      existing.push(location);
      grouped.set(location.pageId, existing);
    }

    return grouped;
  }

  /**
   * Navigate to a subsection and wait for Angular to update
   * Uses multiple stabilization techniques to ensure DOM is ready
   */
  private navigateToSubsection(subsectionId: string): Promise<void> {
    this.logger.debug('[ChartExport] navigateToSubsection:', subsectionId);
    this.logger.debug('[ChartExport] Current activeSubsectionId before:', this.editorState.activeSubsectionId());
    this.logger.debug('[ChartExport] Current activeSubsectionPageIds before:', this.editorState.activeSubsectionPageIds());
    
    return new Promise(resolve => {
      this.ngZone.run(() => {
        this.editorState.setActiveSubsection(subsectionId);
        this.logger.debug('[ChartExport] Called setActiveSubsection, now:', this.editorState.activeSubsectionId());
        this.logger.debug('[ChartExport] New activeSubsectionPageIds:', this.editorState.activeSubsectionPageIds());
        
        // Force multiple change detection cycles to ensure all nested components are created
        // This is needed because:
        // 1. First tick creates page components
        // 2. Pages subscribe to widget IDs (async)
        // 3. Second tick processes widget ID updates
        // 4. Widget containers are created
        // 5. Third tick creates chart widgets
        
        // First change detection cycle
        this.appRef.tick();
        this.logger.debug('[ChartExport] After first tick');
        
        // Use multiple microtasks and RAFs to allow Angular to fully stabilize
        queueMicrotask(() => {
          this.appRef.tick();
          this.logger.debug('[ChartExport] After second tick');
          
          requestAnimationFrame(() => {
            this.appRef.tick();
            this.logger.debug('[ChartExport] After third tick (RAF 1)');
            
            requestAnimationFrame(() => {
              this.appRef.tick();
              this.logger.debug('[ChartExport] After fourth tick (RAF 2)');
              
              // One more microtask to ensure any final updates
              queueMicrotask(() => {
                this.appRef.tick();
                this.logger.debug('[ChartExport] After fifth tick - navigation complete');
                this.logger.debug('[ChartExport] Registry state:', this.renderRegistry.registeredWidgetIds());
                resolve();
              });
            });
          });
        });
      });
    });
  }

  /**
   * Navigate to a page (required now that only active page is rendered)
   */
  private navigateToPage(pageId: string): Promise<void> {
    this.logger.debug('[ChartExport] navigateToPage:', pageId);
    this.logger.debug('[ChartExport] Current activePageId before:', this.editorState.activePageId());

    return new Promise(resolve => {
      this.ngZone.run(() => {
        this.editorState.setActivePage(pageId);
        this.logger.debug('[ChartExport] Called setActivePage, now:', this.editorState.activePageId());

        // Similar stabilization strategy as subsection navigation
        this.appRef.tick();
        queueMicrotask(() => {
          this.appRef.tick();

          requestAnimationFrame(() => {
            this.appRef.tick();

            requestAnimationFrame(() => {
              this.appRef.tick();

              // IMPORTANT:
              // Do NOT scroll/jump the UI during export. Charts only need to exist in the DOM with a real size;
              // they do not need to be visible in the viewport.
              queueMicrotask(() => {
                this.appRef.tick();
                resolve();
              });
            });
          });
        });
      });
    });
  }

  /**
   * Wait for specific charts to render using the registry
   * This replaces the unreliable timeout approach
   */
  private async waitForChartsToRender(widgetIds: string[]): Promise<void> {
    this.logger.debug('[ChartExport] waitForChartsToRender:', widgetIds);
    
    if (widgetIds.length === 0) {
      this.logger.debug('[ChartExport] No widgets to wait for');
      return;
    }

    // First, ensure all charts are registered
    this.logger.debug('[ChartExport] Waiting for charts to register...');
    await this.waitForChartsToRegister(widgetIds);
    this.logger.debug('[ChartExport] All charts registered, now waiting for render...');

    // Now wait for all charts to be rendered
    const states = await this.renderRegistry.waitForCharts(widgetIds);
    this.logger.debug('[ChartExport] All charts rendered. States:', Array.from(states.entries()).map(([id, s]) => ({ id, status: s.status })));
  }

  /**
   * Wait for charts to register with the registry
   * Charts register themselves in ngOnInit when the component is created
   */
  private waitForChartsToRegister(widgetIds: string[]): Promise<void> {
    this.logger.debug('[ChartExport] waitForChartsToRegister:', widgetIds);
    
    return new Promise(resolve => {
      const timeoutMs = 15_000;
      const checkRegistration = () => {
        const registered = widgetIds.filter(id => 
          this.renderRegistry.getState(id) !== undefined
        );
        const missing = widgetIds.filter(id => 
          this.renderRegistry.getState(id) === undefined
        );
        
        this.logger.debug('[ChartExport] Registration check - registered:', registered.length, 'missing:', missing);
        
        if (missing.length === 0) {
          return true;
        }
        return false;
      };

      // Check immediately
      if (checkRegistration()) {
        this.logger.debug('[ChartExport] All charts already registered');
        resolve();
        return;
      }

      this.logger.debug('[ChartExport] Subscribing to state changes to wait for registration...');
      
      // Subscribe to state changes and wait for all charts to register
      const subscription = this.renderRegistry.stateChange$.subscribe((change) => {
        this.logger.debug('[ChartExport] State change received:', change.widgetId, change.state.status);
        if (checkRegistration()) {
          this.logger.debug('[ChartExport] All charts now registered');
          subscription.unsubscribe();
          resolve();
        }
      });

      // Fail-safe: don't hang export forever if a chart never registers.
      window.setTimeout(() => {
        if (!subscription.closed) {
          const missing = widgetIds.filter(id => this.renderRegistry.getState(id) === undefined);
          console.warn('[ChartExport] Registration timeout. Continuing export with missing charts:', missing);
          subscription.unsubscribe();
          resolve();
        }
      }, timeoutMs);
    });
  }

  /**
   * Update the chart widget in the document with the exported image
   */
  private updateChartInDocument(
    document: DocumentModel,
    sectionId: string,
    subsectionId: string,
    pageId: string,
    widgetId: string,
    base64Image: string
  ): void {
    const section = document.sections?.find(s => s.id === sectionId);
    const subsection = section?.subsections?.find(sub => sub.id === subsectionId);
    const page = subsection?.pages?.find(p => p.id === pageId);
    const widget = page?.widgets?.find(w => w.id === widgetId);

    if (widget && widget.type === 'chart') {
      const props = widget.props as ChartWidgetProps;
      widget.props = {
        ...props,
        exportedImage: base64Image,
      } as ChartWidgetProps;
    }
  }

  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  private setCache(key: string, value: string): void {
    // Simple FIFO eviction (Map preserves insertion order).
    if (this.exportedImageCache.size >= this.MAX_CACHE_ENTRIES) {
      const oldestKey = this.exportedImageCache.keys().next().value as string | undefined;
      if (oldestKey) this.exportedImageCache.delete(oldestKey);
    }
    this.exportedImageCache.set(key, value);
  }

  /**
   * Build a stable cache key for a chart widget based on its data/props and target export size.
   * We explicitly exclude `exportedImage` to avoid self-referential cache churn.
   */
  private getChartCacheKey(widget: WidgetModel): string | null {
    try {
      const props: any = widget.props || {};
      const { exportedImage, loading, loadingMessage, ...rest } = props;
      const signature = {
        type: widget.type,
        width: widget.size?.width,
        height: widget.size?.height,
        props: rest,
      };
      return stableHash(stableStringify(signature));
    } catch {
      return null;
    }
  }
}

function stableStringify(value: any): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',')}}`;
}

function stableHash(input: string): string {
  // Fast non-crypto hash (FNV-1a 32-bit), returned as hex string.
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

async function runWithConcurrencyLimit<T>(
  concurrency: number,
  items: readonly T[],
  worker: (item: T) => Promise<void>
): Promise<void> {
  const limit = Math.max(1, Math.floor(concurrency || 1));
  let idx = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const current = idx++;
      if (current >= items.length) return;
      await worker(items[current]);
    }
  });

  await Promise.all(runners);
}
