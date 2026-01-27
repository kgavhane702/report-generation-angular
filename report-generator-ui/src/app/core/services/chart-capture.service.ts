import { Injectable } from '@angular/core';
import { WidgetModel } from '../../models/widget.model';

/**
 * ChartCaptureService
 *
 * Single responsibility: capture an already-rendered chart widget from the DOM
 * and return a data URL (png or svg).
 *
 * This keeps ChartExportService focused on navigation/waiting and makes
 * capture reusable for other export targets (PDF, PPTX, images).
 */
@Injectable({
  providedIn: 'root',
})
export class ChartCaptureService {
  // Cap raster chart exports (Chart.js canvas) to reduce payload size and speed up PDF printing.
  // SVG charts stay vector and are not affected by this.
  private readonly MAX_RASTER_PX = 1200;

  async captureChartForWidget(widget: WidgetModel): Promise<string | null> {
    return this.captureChart(widget.id, widget.size.width, widget.size.height);
  }

  async captureChart(widgetId: string, width: number, height: number): Promise<string | null> {
    const widgetElement = document.querySelector(`[data-widget-id="${widgetId}"]`);
    if (!widgetElement) {
      console.warn(`[ChartCapture] Widget element not found for ${widgetId}`);
      return null;
    }

    const chartContainer = widgetElement.querySelector('.chart-widget__container') as HTMLElement | null;
    if (!chartContainer) {
      console.warn(`[ChartCapture] Chart container not found for ${widgetId}`);
      return null;
    }

    // Prefer SVG if present (ECharts export mode forces SVG)
    const svgElement = chartContainer.querySelector('svg');
    if (svgElement) {
      const svgString = new XMLSerializer().serializeToString(svgElement);
      // Faster path: keep SVG as SVG data URL (no SVG->PNG rasterization step).
      // This is typically faster and smaller than PNG for complex charts, and prints crisply.
      return this.svgToSvgDataUrl(svgString);
    }

    // Fallback: canvas (Chart.js)
    const canvas = chartContainer.querySelector('canvas') as HTMLCanvasElement | null;
    if (canvas) {
      return this.canvasToPngDataUrlCapped(canvas);
    }

    console.warn(`[ChartCapture] No SVG or canvas found for chart ${widgetId}`);
    return null;
  }

  private async svgToPngDataUrl(svgString: string, width: number, height: number): Promise<string> {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(width));
      canvas.height = Math.max(1, Math.floor(height));

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      const img = new Image();
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      return await new Promise<string>((resolve, reject) => {
        img.onload = () => {
          try {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/png'));
          } catch (e) {
            reject(e);
          } finally {
            URL.revokeObjectURL(url);
          }
        };

        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('Failed to load SVG image'));
        };

        img.src = url;
      });
    } catch (error) {
      console.error('[ChartCapture] Error converting SVG to PNG:', error);
      // Fallback: return SVG as data URL directly
      const base64Svg = btoa(unescape(encodeURIComponent(svgString)));
      return `data:image/svg+xml;base64,${base64Svg}`;
    }
  }

  private svgToSvgDataUrl(svgString: string): string {
    // Encode as URI component to keep payload compact and safe for <img src="...">.
    // Note: using utf-8 comma format avoids base64 bloat.
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
  }

  private canvasToPngDataUrlCapped(canvas: HTMLCanvasElement): string {
    const w = canvas.width || canvas.clientWidth || 0;
    const h = canvas.height || canvas.clientHeight || 0;
    if (!(w > 0 && h > 0)) {
      return canvas.toDataURL('image/png');
    }

    const maxDim = Math.max(w, h);
    if (maxDim <= this.MAX_RASTER_PX) {
      return canvas.toDataURL('image/png');
    }

    const scale = this.MAX_RASTER_PX / maxDim;
    const outW = Math.max(1, Math.round(w * scale));
    const outH = Math.max(1, Math.round(h * scale));

    const out = document.createElement('canvas');
    out.width = outW;
    out.height = outH;
    const ctx = out.getContext('2d');
    if (!ctx) {
      return canvas.toDataURL('image/png');
    }

    // Better downscale quality for charts (text/lines).
    (ctx as any).imageSmoothingEnabled = true;
    (ctx as any).imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, 0, 0, outW, outH);
    return out.toDataURL('image/png');
  }
}


