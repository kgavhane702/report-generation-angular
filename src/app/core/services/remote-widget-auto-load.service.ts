import { Injectable, inject } from '@angular/core';
import { finalize, take } from 'rxjs';

import type { WidgetEntity } from '../../store/document/document.state';
import type { ChartWidgetProps, TableWidgetProps } from '../../models/widget.model';
import type { ChartHttpDataSourceConfig, TableHttpDataSourceConfig } from '../../shared/http-request/models/http-data-source.model';
import { TableImportService } from './table-import.service';
import { ChartImportApi } from '../chart-import/api/chart-import.api';
import { TableToolbarService } from './table-toolbar.service';
import { DocumentService } from './document.service';
import { RemoteWidgetLoadRegistryService } from './remote-widget-load-registry.service';

/**
 * Auto-loads URL-based widgets (chart/table) when they appear in the UI (e.g. after importing a document).
 */
@Injectable({ providedIn: 'root' })
export class RemoteWidgetAutoLoadService {
  private readonly tableImport = inject(TableImportService);
  private readonly chartImport = inject(ChartImportApi);
  private readonly tableToolbar = inject(TableToolbarService);
  private readonly documentService = inject(DocumentService);
  private readonly registry = inject(RemoteWidgetLoadRegistryService);

  /**
   * Track which widget+dataSource combos were already loaded in this session,
   * to avoid repeated loads on store updates.
   */
  private readonly startedKeys = new Set<string>();

  maybeAutoLoad(widget: WidgetEntity | null, pageId: string): void {
    if (!widget || !pageId) return;

    const type = widget.type;
    const props: any = widget.props || {};
    const dataSource: any = props.dataSource;

    if (!dataSource || dataSource.kind !== 'http') return;
    if (props.loading === true) return; // already loading (e.g. user-triggered import placeholder)

    const key = `${widget.id}::${safeStableStringify(dataSource)}`;
    if (this.startedKeys.has(key)) return;
    this.startedKeys.add(key);

    if (type === 'table') {
      this.loadTable(widget.id, pageId, props as TableWidgetProps, dataSource as TableHttpDataSourceConfig);
    } else if (type === 'chart') {
      this.loadChart(widget.id, pageId, props as ChartWidgetProps, dataSource as ChartHttpDataSourceConfig);
    }
  }

  private loadTable(widgetId: string, pageId: string, props: TableWidgetProps, dataSource: TableHttpDataSourceConfig): void {
    this.registry.start(widgetId);

    // Show placeholder overlay on the existing widget frame.
    this.documentService.updateWidget(pageId, widgetId, {
      props: {
        ...(props as any),
        loading: true,
        loadingMessage: 'Loading table…',
      } as any,
    });

    this.tableImport
      .importFromUrl({
        request: dataSource.request,
        format: dataSource.format,
        sheetIndex: dataSource.sheetIndex,
        delimiter: dataSource.delimiter,
      })
      .pipe(
        take(1),
        finalize(() => this.registry.stop(widgetId))
      )
      .subscribe({
        next: (resp) => {
          if (!resp?.success || !resp.data) {
            const msg = resp?.error?.message || 'URL table load failed';
            alert(msg);
            this.documentService.updateWidget(pageId, widgetId, {
              props: { ...(props as any), loading: false, loadingMessage: undefined } as any,
            });
            return;
          }

          const data = resp.data;
          const importReq = {
            widgetId,
            rows: data.rows,
            columnFractions: data.columnFractions,
            rowFractions: data.rowFractions,
            // Preserve the widget's saved frame (width/height) when auto-loading a URL table
            // after document import/open. This prevents unexpected growth on load.
            preserveWidgetFrame: true,
          };

          // Ensure the table widget component is mounted before emitting (Subject is not replayed).
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              this.tableToolbar.requestImportTableFromExcel(importReq);
            });
          });
        },
        error: (err) => {
          // eslint-disable-next-line no-console
          console.error('URL table load failed', err);
          const msg =
            err?.error?.error?.message ||
            err?.error?.message ||
            err?.message ||
            'URL table load failed. Please verify the backend is running and the URL is accessible.';
          alert(msg);
          this.documentService.updateWidget(pageId, widgetId, {
            props: { ...(props as any), loading: false, loadingMessage: undefined } as any,
          });
        },
      });
  }

  private loadChart(widgetId: string, pageId: string, props: ChartWidgetProps, dataSource: ChartHttpDataSourceConfig): void {
    this.registry.start(widgetId);

    this.documentService.updateWidget(pageId, widgetId, {
      props: {
        ...(props as any),
        loading: true,
        loadingMessage: 'Loading chart…',
      } as any,
    });

    this.chartImport
      .importChartFromUrl({
        request: dataSource.request,
        format: dataSource.format,
        sheetIndex: dataSource.sheetIndex,
        delimiter: dataSource.delimiter,
        chartType: dataSource.chartType,
        hasHeader: dataSource.hasHeader,
        headerRowIndex: dataSource.headerRowIndex,
        categoryColumnIndex: dataSource.categoryColumnIndex,
        seriesColumnIndexes: dataSource.seriesColumnIndexes,
        aggregation: dataSource.aggregation,
      } as any)
      .pipe(
        take(1),
        finalize(() => this.registry.stop(widgetId))
      )
      .subscribe({
        next: (resp) => {
          if (!resp?.success || !resp.data) {
            const msg = resp?.error?.message || 'URL chart load failed';
            alert(msg);
            this.documentService.updateWidget(pageId, widgetId, {
              props: { ...(props as any), loading: false, loadingMessage: undefined } as any,
            });
            return;
          }

          this.documentService.updateWidget(pageId, widgetId, {
            props: {
              ...(props as any),
              chartType: resp.data.chartData.chartType,
              data: resp.data.chartData,
              loading: false,
              loadingMessage: undefined,
            } as any,
          });
        },
        error: (err) => {
          // eslint-disable-next-line no-console
          console.error('URL chart load failed', err);
          const msg =
            err?.error?.error?.message ||
            err?.error?.message ||
            err?.message ||
            'URL chart load failed. Please verify the backend is running and the URL is accessible.';
          alert(msg);
          this.documentService.updateWidget(pageId, widgetId, {
            props: { ...(props as any), loading: false, loadingMessage: undefined } as any,
          });
        },
      });
  }
}

function safeStableStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}



