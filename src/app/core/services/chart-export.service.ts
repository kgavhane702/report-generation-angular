import { Injectable, inject, ApplicationRef, NgZone } from '@angular/core';
import { ChartWidgetProps, WidgetModel } from '../../models/widget.model';
import { DocumentModel } from '../../models/document.model';
import { EditorStateService } from './editor-state.service';
import { ChartRenderRegistry } from './chart-render-registry.service';
import { ExportUiStateService } from './export-ui-state.service';

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

  /**
   * Export a single chart widget to base64 image
   */
  async exportChartToBase64(widget: WidgetModel): Promise<string | null> {
    try {
      return await this.captureChartImage(widget);
    } catch (error) {
      console.error(`Failed to export chart ${widget.id}:`, error);
      return null;
    }
  }

  /**
   * Capture chart as base64 image from DOM
   */
  private async captureChartImage(widget: WidgetModel): Promise<string | null> {
    const widgetElement = document.querySelector(`[data-widget-id="${widget.id}"]`);
    if (!widgetElement) {
      console.warn(`Widget element not found for ${widget.id}`);
      return null;
    }

    const chartContainer = widgetElement.querySelector('.chart-widget__container') as HTMLElement;
    if (!chartContainer) {
      console.warn(`Chart container not found for ${widget.id}`);
      return null;
    }

    // Try SVG first (ECharts renders to SVG by default for better quality)
    const svgElement = chartContainer.querySelector('svg');
    if (svgElement) {
      const svgString = new XMLSerializer().serializeToString(svgElement);
      return await this.svgToBase64(svgString, widget.size.width, widget.size.height);
    }

    // Fallback to canvas (Chart.js)
    const canvas = chartContainer.querySelector('canvas');
    if (canvas) {
      return canvas.toDataURL('image/png');
    }

    console.warn(`No SVG or canvas found for chart ${widget.id}`);
    return null;
  }

  /**
   * Convert SVG string to base64 PNG
   */
  private async svgToBase64(svgString: string, width: number, height: number): Promise<string> {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      const img = new Image();
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      return new Promise<string>((resolve, reject) => {
        img.onload = () => {
          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL('image/png'));
        };

        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('Failed to load SVG image'));
        };

        img.src = url;
      }).catch(() => {
        // Fallback: return SVG as data URL directly
        const base64Svg = btoa(unescape(encodeURIComponent(svgString)));
        return `data:image/svg+xml;base64,${base64Svg}`;
      });
    } catch (error) {
      console.error('Error converting SVG to base64:', error);
      // Fallback: return SVG as data URL directly
      const base64Svg = btoa(unescape(encodeURIComponent(svgString)));
      return `data:image/svg+xml;base64,${base64Svg}`;
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
    
    console.log('[ChartExport] Starting export. Current subsection:', currentSubsectionId);
    
    // Collect all chart widgets with their locations
    const chartLocations = this.collectChartLocations(updatedDocument);
    
    console.log('[ChartExport] Found charts:', chartLocations.length, chartLocations.map(c => ({
      widgetId: c.widget.id,
      subsectionId: c.subsectionId,
      pageId: c.pageId
    })));
    
    if (chartLocations.length === 0) {
      console.log('[ChartExport] No charts found, returning');
      return updatedDocument;
    }

    // Group charts by subsection
    const chartsBySubsection = this.groupBySubsection(chartLocations);
    console.log('[ChartExport] Charts by subsection:', Array.from(chartsBySubsection.keys()));

    // Enter export mode - signals charts to force render
    this.renderRegistry.enterExportMode();
    console.log('[ChartExport] Entered export mode');

    try {
      this.exportUi.start('Exporting charts…');

      // Process each subsection
      const entries = Array.from(chartsBySubsection.entries());
      for (let i = 0; i < entries.length; i++) {
        const [subsectionId, charts] = entries[i];
        console.log('[ChartExport] Processing subsection:', subsectionId, 'with', charts.length, 'charts');
        this.exportUi.updateMessage(`Exporting charts… (${i + 1}/${entries.length})`);
        
        // Navigate to subsection to make charts visible
        await this.navigateToSubsection(subsectionId);
        console.log('[ChartExport] Navigated to subsection:', subsectionId);
        
        // Check registry state
        console.log('[ChartExport] Registry state after navigation:', 
          this.renderRegistry.registeredWidgetIds(),
          'Pending:', this.renderRegistry.pendingCount()
        );
        
        // Wait for all charts in this subsection to render
        const chartWidgetIds = charts.map(c => c.widget.id);
        console.log('[ChartExport] Waiting for charts to render:', chartWidgetIds);
        
        await this.waitForChartsToRender(chartWidgetIds);
        console.log('[ChartExport] Charts rendered for subsection:', subsectionId);
        
        // Capture each chart
        for (const chartLocation of charts) {
          console.log('[ChartExport] Capturing chart:', chartLocation.widget.id);
          const base64Image = await this.captureChartImage(chartLocation.widget);
          
          if (base64Image) {
            console.log('[ChartExport] Chart captured successfully:', chartLocation.widget.id, 'length:', base64Image.length);
            // Update the document model with the captured image
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
        }
      }
    } finally {
      // Exit export mode
      this.renderRegistry.exitExportMode();
      this.exportUi.stop();
      console.log('[ChartExport] Exited export mode');
      
      // Restore original navigation state
      if (currentSubsectionId) {
        await this.navigateToSubsection(currentSubsectionId);
        console.log('[ChartExport] Restored to subsection:', currentSubsectionId);
      }
    }

    console.log('[ChartExport] Export complete');
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
   * Navigate to a subsection and wait for Angular to update
   * Uses multiple stabilization techniques to ensure DOM is ready
   */
  private navigateToSubsection(subsectionId: string): Promise<void> {
    console.log('[ChartExport] navigateToSubsection:', subsectionId);
    console.log('[ChartExport] Current activeSubsectionId before:', this.editorState.activeSubsectionId());
    console.log('[ChartExport] Current activeSubsectionPageIds before:', this.editorState.activeSubsectionPageIds());
    
    return new Promise(resolve => {
      this.ngZone.run(() => {
        this.editorState.setActiveSubsection(subsectionId);
        console.log('[ChartExport] Called setActiveSubsection, now:', this.editorState.activeSubsectionId());
        console.log('[ChartExport] New activeSubsectionPageIds:', this.editorState.activeSubsectionPageIds());
        
        // Force multiple change detection cycles to ensure all nested components are created
        // This is needed because:
        // 1. First tick creates page components
        // 2. Pages subscribe to widget IDs (async)
        // 3. Second tick processes widget ID updates
        // 4. Widget containers are created
        // 5. Third tick creates chart widgets
        
        // First change detection cycle
        this.appRef.tick();
        console.log('[ChartExport] After first tick');
        
        // Use multiple microtasks and RAFs to allow Angular to fully stabilize
        queueMicrotask(() => {
          this.appRef.tick();
          console.log('[ChartExport] After second tick');
          
          requestAnimationFrame(() => {
            this.appRef.tick();
            console.log('[ChartExport] After third tick (RAF 1)');
            
            requestAnimationFrame(() => {
              this.appRef.tick();
              console.log('[ChartExport] After fourth tick (RAF 2)');
              
              // One more microtask to ensure any final updates
              queueMicrotask(() => {
                this.appRef.tick();
                console.log('[ChartExport] After fifth tick - navigation complete');
                console.log('[ChartExport] Registry state:', this.renderRegistry.registeredWidgetIds());
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
    console.log('[ChartExport] waitForChartsToRender:', widgetIds);
    
    if (widgetIds.length === 0) {
      console.log('[ChartExport] No widgets to wait for');
      return;
    }

    // First, ensure all charts are registered
    console.log('[ChartExport] Waiting for charts to register...');
    await this.waitForChartsToRegister(widgetIds);
    console.log('[ChartExport] All charts registered, now waiting for render...');

    // Now wait for all charts to be rendered
    const states = await this.renderRegistry.waitForCharts(widgetIds);
    console.log('[ChartExport] All charts rendered. States:', Array.from(states.entries()).map(([id, s]) => ({ id, status: s.status })));
  }

  /**
   * Wait for charts to register with the registry
   * Charts register themselves in ngOnInit when the component is created
   */
  private waitForChartsToRegister(widgetIds: string[]): Promise<void> {
    console.log('[ChartExport] waitForChartsToRegister:', widgetIds);
    
    return new Promise(resolve => {
      const timeoutMs = 15_000;
      const checkRegistration = () => {
        const registered = widgetIds.filter(id => 
          this.renderRegistry.getState(id) !== undefined
        );
        const missing = widgetIds.filter(id => 
          this.renderRegistry.getState(id) === undefined
        );
        
        console.log('[ChartExport] Registration check - registered:', registered.length, 'missing:', missing);
        
        if (missing.length === 0) {
          return true;
        }
        return false;
      };

      // Check immediately
      if (checkRegistration()) {
        console.log('[ChartExport] All charts already registered');
        resolve();
        return;
      }

      console.log('[ChartExport] Subscribing to state changes to wait for registration...');
      
      // Subscribe to state changes and wait for all charts to register
      const subscription = this.renderRegistry.stateChange$.subscribe((change) => {
        console.log('[ChartExport] State change received:', change.widgetId, change.state.status);
        if (checkRegistration()) {
          console.log('[ChartExport] All charts now registered');
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
}
