import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { DocumentModel } from '../../models/document.model';
import type { WidgetModel } from '../../models/widget.model';
import type { TableWidgetProps, EditastraWidgetProps } from '../../models/widget.model';
import type { TableHttpDataSourceConfig } from '../../shared/http-request/models/http-data-source.model';
import { TableImportService } from './table-import.service';
import { EditastraImportService } from './editastra-import.service';
import { LoggerService } from './logger.service';

/**
 * Preloads URL-based widgets (table/chart/editastra) into a cloned document model.
 *
 * Why this exists:
 * - The editor renders only the active page, so widgets on non-active pages may never mount.
 * - URL widgets auto-load only when mounted, so their data may be missing at export time.
 * - PDF export must be complete even if the user never opened every page.
 */
@Injectable({ providedIn: 'root' })
export class RemoteWidgetPreloadService {
  private readonly tableImport = inject(TableImportService);
  private readonly editastraImport = inject(EditastraImportService);
  private readonly logger = inject(LoggerService);

  // Keep modest to avoid spiking backend/CPU, but enough to hide latency.
  private readonly CONCURRENCY = 4;

  // Session cache so repeated exports don't refetch identical URL widgets.
  private readonly tableCache = new Map<string, { rows: any[]; columnFractions: number[]; rowFractions: number[] }>();
  private readonly textCache = new Map<string, { contentHtml: string }>();
  private readonly tableInFlight = new Map<string, Promise<void>>();
  private readonly textInFlight = new Map<string, Promise<void>>();

  async preloadUrlWidgets(documentModel: DocumentModel): Promise<DocumentModel> {
    // Fast path: avoid deep cloning if there are no URL widgets at all.
    if (!hasAnyUrlWidgets(documentModel)) {
      return documentModel;
    }

    const doc = this.deepClone(documentModel);
    const targets = this.collectUrlWidgetTargets(doc);
    if (targets.length === 0) return doc;

    this.logger.debug('[UrlPreload] Found URL widgets:', targets.length);

    await runWithConcurrencyLimit(this.CONCURRENCY, targets, async (t) => {
      await this.loadOne(t.widget);
    });

    return doc;
  }

  private async loadOne(widget: WidgetModel): Promise<void> {
    const type = widget.type;
    const props: any = widget.props || {};
    const ds: any = props.dataSource;
    if (!ds || ds.kind !== 'http' || !ds.request) return;

    if (type === 'table') {
      const tableProps = widget.props as TableWidgetProps;
      if (!needsTableLoad(tableProps)) return;
      await this.loadTable(tableProps, ds as TableHttpDataSourceConfig);
    } else if (type === 'editastra') {
      const textProps = widget.props as EditastraWidgetProps;
      if (!needsTextLoad(textProps)) return;
      await this.loadEditastra(textProps, ds as TableHttpDataSourceConfig);
    }
  }

  private async loadTable(props: TableWidgetProps, ds: TableHttpDataSourceConfig): Promise<void> {
    const cacheKey = makeKey('table', ds);
    const cached = this.tableCache.get(cacheKey);
    if (cached) {
      props.rows = cached.rows as any;
      props.columnFractions = cached.columnFractions as any;
      props.rowFractions = cached.rowFractions as any;
      props.loading = false;
      props.loadingMessage = undefined;
      return;
    }

    // Deduplicate concurrent requests for identical data sources (common during export).
    const inFlight = this.tableInFlight.get(cacheKey);
    if (inFlight) {
      await inFlight;
      const done = this.tableCache.get(cacheKey);
      if (done) {
        props.rows = done.rows as any;
        props.columnFractions = done.columnFractions as any;
        props.rowFractions = done.rowFractions as any;
        props.loading = false;
        props.loadingMessage = undefined;
      }
      return;
    }

    const promise = (async () => {
      const resp = await firstValueFrom(this.tableImport.importFromUrl({
        request: ds.request,
        format: ds.format,
        sheetIndex: ds.sheetIndex,
        delimiter: ds.delimiter,
      }));

      if (!resp?.success || !resp.data) {
        const msg = resp?.error?.message || 'URL table load failed';
        this.logger.warn('[UrlPreload] ' + msg);
        return;
      }

      this.tableCache.set(cacheKey, {
        rows: resp.data.rows as any,
        columnFractions: resp.data.columnFractions as any,
        rowFractions: resp.data.rowFractions as any,
      });
    })().finally(() => {
      this.tableInFlight.delete(cacheKey);
    });

    this.tableInFlight.set(cacheKey, promise);
    await promise;

    const now = this.tableCache.get(cacheKey);
    if (!now) return;

    props.rows = now.rows as any;
    props.columnFractions = now.columnFractions as any;
    props.rowFractions = now.rowFractions as any;
    props.loading = false;
    props.loadingMessage = undefined;
  }

  private async loadEditastra(props: EditastraWidgetProps, ds: TableHttpDataSourceConfig): Promise<void> {
    const cacheKey = makeKey('editastra', ds);
    const cached = this.textCache.get(cacheKey);
    if (cached) {
      props.contentHtml = cached.contentHtml ?? '';
      props.loading = false;
      props.loadingMessage = undefined;
      return;
    }

    const inFlight = this.textInFlight.get(cacheKey);
    if (inFlight) {
      await inFlight;
      const done = this.textCache.get(cacheKey);
      if (done) {
        props.contentHtml = done.contentHtml ?? '';
        props.loading = false;
        props.loadingMessage = undefined;
      }
      return;
    }

    const promise = (async () => {
      const resp = await firstValueFrom(this.editastraImport.importFromUrl({
        request: ds.request,
        format: ds.format,
        sheetIndex: ds.sheetIndex,
        delimiter: ds.delimiter,
      }));

      if (!resp?.success || !resp.data) {
        const msg = resp?.error?.message || 'URL text load failed';
        this.logger.warn('[UrlPreload] ' + msg);
        return;
      }

      this.textCache.set(cacheKey, { contentHtml: resp.data.contentHtml ?? '' });
    })().finally(() => {
      this.textInFlight.delete(cacheKey);
    });

    this.textInFlight.set(cacheKey, promise);
    await promise;

    const now = this.textCache.get(cacheKey);
    if (!now) return;

    props.contentHtml = now.contentHtml ?? '';
    props.loading = false;
    props.loadingMessage = undefined;
  }

  private collectUrlWidgetTargets(document: DocumentModel): Array<{ widget: WidgetModel }> {
    const out: Array<{ widget: WidgetModel }> = [];
    for (const section of document.sections || []) {
      for (const subsection of section.subsections || []) {
        for (const page of subsection.pages || []) {
          for (const widget of (page.widgets || []) as any as WidgetModel[]) {
            const ds: any = (widget as any)?.props?.dataSource;
            if (ds && ds.kind === 'http' && ds.request) {
              out.push({ widget });
            }
          }
        }
      }
    }
    return out;
  }

  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }
}

function needsTableLoad(props: TableWidgetProps): boolean {
  if (!props) return false;
  if ((props as any).loading === true) return true;
  const rows: any[] = Array.isArray((props as any).rows) ? ((props as any).rows as any[]) : [];
  if (rows.length === 0) return true;

  // Sample a small number of cells for speed (tables can be huge).
  let checked = 0;
  for (let r = 0; r < rows.length; r++) {
    const cells: any[] = Array.isArray(rows[r]?.cells) ? rows[r].cells : [];
    for (let c = 0; c < cells.length; c++) {
      const html = (cells[c]?.contentHtml ?? '').toString().trim();
      if (html.length > 0) return false;
      checked++;
      if (checked >= 24) {
        // If the first ~24 cells are empty, assume it's not loaded.
        return true;
      }
    }
  }
  return true;
}

function needsTextLoad(props: EditastraWidgetProps): boolean {
  if (!props) return false;
  if ((props as any).loading === true) return true;
  const html = (props.contentHtml ?? '').toString().trim();
  return html.length === 0;
}

function makeKey(kind: 'table' | 'editastra', ds: TableHttpDataSourceConfig): string {
  return `${kind}::${stableStringify({
    request: ds.request,
    format: ds.format,
    sheetIndex: ds.sheetIndex,
    delimiter: ds.delimiter,
  })}`;
}

function stableStringify(value: any): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',')}}`;
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

function hasAnyUrlWidgets(document: DocumentModel): boolean {
  for (const section of document.sections || []) {
    for (const subsection of section.subsections || []) {
      for (const page of subsection.pages || []) {
        for (const widget of (page.widgets || []) as any[]) {
          const ds: any = widget?.props?.dataSource;
          if (ds && ds.kind === 'http' && ds.request) return true;
        }
      }
    }
  }
  return false;
}


