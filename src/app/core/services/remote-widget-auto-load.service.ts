import { Injectable, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import type { Dictionary } from '@ngrx/entity';
import { finalize, take } from 'rxjs';

import type { WidgetEntity } from '../../store/document/document.state';
import type { ChartWidgetProps, EditastraWidgetProps, TableWidgetProps } from '../../models/widget.model';
import type { ChartHttpDataSourceConfig, TableHttpDataSourceConfig } from '../../shared/http-request/models/http-data-source.model';
import type { AppState } from '../../store/app.state';
import { DocumentSelectors } from '../../store/document/document.selectors';
import { TableImportService } from './table-import.service';
import { ChartImportApi } from '../chart-import/api/chart-import.api';
import { TableToolbarService } from './table-toolbar.service';
import { DocumentService } from './document.service';
import { RemoteWidgetLoadRegistryService } from './remote-widget-load-registry.service';
import { EditastraImportService } from './editastra-import.service';
import { NotificationService } from './notification.service';

/**
 * Auto-loads URL-based widgets (chart/table) when they appear in the UI (e.g. after importing a document).
 */
@Injectable({ providedIn: 'root' })
export class RemoteWidgetAutoLoadService {
  private readonly store = inject(Store<AppState>);
  private readonly tableImport = inject(TableImportService);
  private readonly chartImport = inject(ChartImportApi);
  private readonly editastraImport = inject(EditastraImportService);
  private readonly tableToolbar = inject(TableToolbarService);
  private readonly documentService = inject(DocumentService);
  private readonly registry = inject(RemoteWidgetLoadRegistryService);
  private readonly notify = inject(NotificationService);
  private readonly widgetEntities = toSignal(
    this.store.select(DocumentSelectors.selectWidgetEntities),
    { initialValue: {} as Dictionary<WidgetEntity> }
  );

  /**
   * Track which widget+dataSource combos were already loaded in this session,
   * to avoid repeated loads on store updates.
   */
  private readonly startedKeys = new Set<string>();

  /**
   * Reset session-only auto-load memory.
   *
   * Needed when the entire document is replaced (e.g. import document JSON).
   * Imported documents can reuse the same widget IDs, so without clearing this,
   * URL-based widgets may not re-fetch on subsequent imports in the same app session.
   */
  resetSession(): void {
    this.startedKeys.clear();
  }

  /**
   * IMPORTANT:
   * These auto-load requests are async. While they're in-flight, the user might edit the widget.
   * We must always merge updates against the latest widget props from the store, otherwise we can
   * overwrite newer edits with stale `props` captured at request start.
   */
  private updateWidgetProps<T extends object>(
    pageId: string,
    widgetId: string,
    fallbackProps: T,
    patch: Partial<T>
  ): void {
    const latest = this.widgetEntities()?.[widgetId]?.props as T | undefined;
    const base = (latest ?? fallbackProps) as T;
    const next = { ...(base as any), ...(patch as any) } as T;
    this.documentService.updateWidget(pageId, widgetId, { props: next as any });
  }

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
    } else if (type === 'editastra') {
      this.loadEditastra(widget.id, pageId, props as EditastraWidgetProps, dataSource as TableHttpDataSourceConfig);
    }
  }

  private loadTable(widgetId: string, pageId: string, props: TableWidgetProps, dataSource: TableHttpDataSourceConfig): void {
    this.registry.start(widgetId);

    // Show placeholder overlay on the existing widget frame.
    this.updateWidgetProps(pageId, widgetId, props, {
      loading: true,
      loadingMessage: 'Loading table…',
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
            this.notify.error(msg, 'Auto-load failed');
            this.updateWidgetProps(pageId, widgetId, props, {
              loading: false,
              loadingMessage: undefined,
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
          this.notify.error(msg, 'Auto-load failed');
          this.updateWidgetProps(pageId, widgetId, props, {
            loading: false,
            loadingMessage: undefined,
          });
        },
      });
  }

  private loadChart(widgetId: string, pageId: string, props: ChartWidgetProps, dataSource: ChartHttpDataSourceConfig): void {
    this.registry.start(widgetId);

    this.updateWidgetProps(pageId, widgetId, props, {
      loading: true,
      loadingMessage: 'Loading chart…',
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
            this.notify.error(msg, 'Auto-load failed');
            this.updateWidgetProps(pageId, widgetId, props, {
              loading: false,
              loadingMessage: undefined,
            });
            return;
          }

          this.updateWidgetProps(pageId, widgetId, props, {
            chartType: resp.data.chartData.chartType,
            data: resp.data.chartData,
            loading: false,
            loadingMessage: undefined,
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
          this.notify.error(msg, 'Auto-load failed');
          this.updateWidgetProps(pageId, widgetId, props, {
            loading: false,
            loadingMessage: undefined,
          });
        },
      });
  }

  private loadEditastra(
    widgetId: string,
    pageId: string,
    props: EditastraWidgetProps,
    dataSource: TableHttpDataSourceConfig
  ): void {
    this.registry.start(widgetId);

    this.updateWidgetProps(pageId, widgetId, props, {
      loading: true,
      loadingMessage: 'Loading text…',
    });

    this.editastraImport
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
            const msg = resp?.error?.message || 'URL text load failed';
            this.notify.error(msg, 'Auto-load failed');
            this.updateWidgetProps(pageId, widgetId, props, {
              loading: false,
              loadingMessage: undefined,
            });
            return;
          }

          this.updateWidgetProps(pageId, widgetId, props, {
            contentHtml: resp.data.contentHtml ?? '',
            loading: false,
            loadingMessage: undefined,
          });
        },
        error: (err) => {
          // eslint-disable-next-line no-console
          console.error('URL text load failed', err);
          const msg =
            err?.error?.error?.message ||
            err?.error?.message ||
            err?.message ||
            'URL text load failed. Please verify the backend is running and the URL is accessible.';
          this.notify.error(msg, 'Auto-load failed');
          this.updateWidgetProps(pageId, widgetId, props, {
            loading: false,
            loadingMessage: undefined,
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



