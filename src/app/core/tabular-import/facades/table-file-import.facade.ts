import { Injectable, inject, signal } from '@angular/core';
import { finalize, take } from 'rxjs';

import { WidgetFactoryService } from '../../../features/editor/widget-host/widget-factory.service';
import { DocumentService } from '../../services/document.service';
import { EditorStateService } from '../../services/editor-state.service';
import { TableImportService } from '../../services/table-import.service';
import { TableToolbarService } from '../../services/table-toolbar.service';
import type { TableWidgetProps, WidgetModel } from '../../../models/widget.model';

/**
 * Facade for importing a file and inserting it into a Table widget.
 *
 * Today: XLSX -> TABLE via legacy endpoint (/api/table/import/excel).
 * Later: can switch to the generic tabular pipeline (/api/import/tabular) without touching UI components.
 */
@Injectable({ providedIn: 'root' })
export class TableFileImportFacade {
  private readonly widgetFactory = inject(WidgetFactoryService);
  private readonly documentService = inject(DocumentService);
  private readonly editorState = inject(EditorStateService);
  private readonly tableImport = inject(TableImportService);
  private readonly tableToolbar = inject(TableToolbarService);

  private readonly _importInProgress = signal<boolean>(false);
  readonly importInProgress = this._importInProgress.asReadonly();

  private readonly _importError = signal<string | null>(null);
  readonly importError = this._importError.asReadonly();

  private insertLoadingPlaceholder(pageId: string, message: string): WidgetModel {
    const widget = this.widgetFactory.createWidget('table');
    const props = widget.props as TableWidgetProps;
    props.loading = true;
    props.loadingMessage = message;

    this.documentService.addWidget(pageId, widget);
    this.editorState.setActiveWidget(widget.id);
    // Mark this new table as the active target for table-toolbar actions (split/merge/etc),
    // even before a cell is focused (important for freshly inserted/imported tables).
    this.tableToolbar.setActiveTableWidget(widget.id);
    return widget;
  }

  private rollbackPlaceholder(pageId: string, widgetId: string, previousActiveWidgetId: string | null): void {
    this.documentService.deleteWidget(pageId, widgetId);
    this.editorState.setActiveWidget(previousActiveWidgetId ?? null);
    if (this.tableToolbar.activeTableWidgetId === widgetId) {
      this.tableToolbar.setActiveTableWidget(null);
    }
  }

  importFile(file: File): void {
    const name = (file?.name ?? '').toLowerCase();
    if (name.endsWith('.json')) {
      this.importJson(file);
      return;
    }
    if (name.endsWith('.xml')) {
      this.importXml(file);
      return;
    }
    if (name.endsWith('.csv')) {
      this.importCsv(file);
      return;
    }
    // default to XLSX
    this.importExcel(file);
  }

  importExcel(file: File): void {
    const pageId = this.editorState.activePageId();
    if (!pageId) return;

    const previousActiveWidgetId = this.editorState.activeWidgetId();
    const placeholder = this.insertLoadingPlaceholder(pageId, 'Importing table…');

    this._importInProgress.set(true);
    this._importError.set(null);

    this.tableImport
      .importExcel(file)
      .pipe(
        take(1),
        finalize(() => this._importInProgress.set(false))
      )
      .subscribe({
        next: (resp) => {
          if (!resp?.success || !resp.data) {
            const msg = resp?.error?.message || 'Excel import failed';
            this._importError.set(msg);
            alert(msg);
            this.rollbackPlaceholder(pageId, placeholder.id, previousActiveWidgetId);
            return;
          }
          const data = resp.data;

          const req = {
            widgetId: placeholder.id,
            rows: data.rows,
            columnFractions: data.columnFractions,
            rowFractions: data.rowFractions,
          };

          // Ensure the table widget component is mounted before emitting (Subject is not replayed).
          // Two RAFs is a cheap, robust way to wait for the next paint.
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              this.tableToolbar.requestImportTableFromExcel(req);
            });
          });
        },
        error: (err) => {
          // eslint-disable-next-line no-console
          console.error('Excel import failed', err);
          const msg =
            err?.error?.error?.message ||
            err?.error?.message ||
            'Excel import failed. Please verify the backend is running and the file is a valid .xlsx.';
          this._importError.set(msg);
          alert(msg);
          this.rollbackPlaceholder(pageId, placeholder.id, previousActiveWidgetId);
        },
      });
  }

  importCsv(file: File): void {
    const pageId = this.editorState.activePageId();
    if (!pageId) return;

    const previousActiveWidgetId = this.editorState.activeWidgetId();
    const placeholder = this.insertLoadingPlaceholder(pageId, 'Importing table…');

    this._importInProgress.set(true);
    this._importError.set(null);

    this.tableImport
      .importCsv(file)
      .pipe(
        take(1),
        finalize(() => this._importInProgress.set(false))
      )
      .subscribe({
        next: (resp) => {
          if (!resp?.success || !resp.data) {
            const msg = resp?.error?.message || 'CSV import failed';
            this._importError.set(msg);
            alert(msg);
            this.rollbackPlaceholder(pageId, placeholder.id, previousActiveWidgetId);
            return;
          }
          const data = resp.data;

          const req = {
            widgetId: placeholder.id,
            rows: data.rows,
            columnFractions: data.columnFractions,
            rowFractions: data.rowFractions,
          };

          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              this.tableToolbar.requestImportTableFromExcel(req);
            });
          });
        },
        error: (err) => {
          // eslint-disable-next-line no-console
          console.error('CSV import failed', err);
          const msg =
            err?.error?.error?.message ||
            err?.error?.message ||
            'CSV import failed. Please verify the backend is running and the file is a valid .csv.';
          this._importError.set(msg);
          alert(msg);
          this.rollbackPlaceholder(pageId, placeholder.id, previousActiveWidgetId);
        },
      });
  }

  importJson(file: File): void {
    const pageId = this.editorState.activePageId();
    if (!pageId) return;

    const previousActiveWidgetId = this.editorState.activeWidgetId();
    const placeholder = this.insertLoadingPlaceholder(pageId, 'Importing table…');

    this._importInProgress.set(true);
    this._importError.set(null);

    this.tableImport
      .importJson(file)
      .pipe(
        take(1),
        finalize(() => this._importInProgress.set(false))
      )
      .subscribe({
        next: (resp) => {
          if (!resp?.success || !resp.data) {
            const msg = resp?.error?.message || 'JSON import failed';
            this._importError.set(msg);
            alert(msg);
            this.rollbackPlaceholder(pageId, placeholder.id, previousActiveWidgetId);
            return;
          }
          const data = resp.data;

          const req = {
            widgetId: placeholder.id,
            rows: data.rows,
            columnFractions: data.columnFractions,
            rowFractions: data.rowFractions,
          };

          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              this.tableToolbar.requestImportTableFromExcel(req);
            });
          });
        },
        error: (err) => {
          // eslint-disable-next-line no-console
          console.error('JSON import failed', err);
          const msg =
            err?.error?.error?.message ||
            err?.error?.message ||
            'JSON import failed. Please verify the file is valid JSON.';
          this._importError.set(msg);
          alert(msg);
          this.rollbackPlaceholder(pageId, placeholder.id, previousActiveWidgetId);
        },
      });
  }

  importXml(file: File): void {
    const pageId = this.editorState.activePageId();
    if (!pageId) return;

    const previousActiveWidgetId = this.editorState.activeWidgetId();
    const placeholder = this.insertLoadingPlaceholder(pageId, 'Importing table…');

    this._importInProgress.set(true);
    this._importError.set(null);

    this.tableImport
      .importXml(file)
      .pipe(
        take(1),
        finalize(() => this._importInProgress.set(false))
      )
      .subscribe({
        next: (resp) => {
          if (!resp?.success || !resp.data) {
            const msg = resp?.error?.message || 'XML import failed';
            this._importError.set(msg);
            alert(msg);
            this.rollbackPlaceholder(pageId, placeholder.id, previousActiveWidgetId);
            return;
          }
          const data = resp.data;

          const req = {
            widgetId: placeholder.id,
            rows: data.rows,
            columnFractions: data.columnFractions,
            rowFractions: data.rowFractions,
          };

          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              this.tableToolbar.requestImportTableFromExcel(req);
            });
          });
        },
        error: (err) => {
          // eslint-disable-next-line no-console
          console.error('XML import failed', err);
          const msg =
            err?.error?.error?.message ||
            err?.error?.message ||
            'XML import failed. Please verify the file is valid XML.';
          this._importError.set(msg);
          alert(msg);
          this.rollbackPlaceholder(pageId, placeholder.id, previousActiveWidgetId);
        },
      });
  }
}


