import { Injectable, inject } from '@angular/core';
import type { ChartInstance } from '../engine/contracts';
import { ChartRenderRegistry } from '../../../../../core/services/chart-render-registry.service';
import { LoggerService } from '../../../../../core/services/logger.service';

/**
 * ChartExportRenderCoordinatorService
 *
 * Single responsibility: in export mode, ensure we mark charts as "rendered"
 * only when the underlying chart engine has finished drawing.
 *
 * This keeps ChartWidgetComponent simpler and makes export stability reusable.
 */
@Injectable({
  providedIn: 'root',
})
export class ChartExportRenderCoordinatorService {
  private readonly renderRegistry = inject(ChartRenderRegistry);
  private readonly logger = inject(LoggerService);

  markRenderedWhenStable(widgetId: string, instance: ChartInstance | undefined): void {
    const exporting = this.renderRegistry.exportMode();

    if (!exporting) {
      queueMicrotask(() => {
        this.renderRegistry.markRendered(widgetId);
      });
      return;
    }

    const chartInstance: any = (instance as any)?.chartInstance;
    let done = false;

    const markDone = () => {
      if (done) return;
      done = true;
      this.renderRegistry.markRendered(widgetId);
      this.logger.debug('[ChartExportCoordinator] Marked rendered (stable):', widgetId);
    };

    const exportTimeoutMs = 20_000;

    // ECharts: wait for "finished"
    if (chartInstance?.on && chartInstance?.off) {
      const handler = () => {
        chartInstance.off('finished', handler);
        requestAnimationFrame(() => markDone());
      };
      chartInstance.on('finished', handler);

      // Fail-safe: do NOT mark rendered early (can cause partial captures).
      // Instead, mark as error so export can continue and the registry can unblock.
      window.setTimeout(() => {
        try {
          chartInstance.off('finished', handler);
        } catch {
          // ignore
        }
        if (done) return;
        done = true;
        this.renderRegistry.markError(widgetId, `Export render timeout after ${exportTimeoutMs}ms`);
        this.logger.warn('[ChartExportCoordinator] Export render timeout:', widgetId);
      }, exportTimeoutMs);
      return;
    }

    // Chart.js or unknown: animations are disabled during export; wait a couple frames.
    requestAnimationFrame(() => requestAnimationFrame(() => markDone()));
  }
}


