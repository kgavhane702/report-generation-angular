import { Injectable, inject } from '@angular/core';
import { take } from 'rxjs';

import { WidgetFactoryService } from '../../../features/editor/widget-host/widget-factory.service';
import { DocumentService } from '../../services/document.service';
import { EditorStateService } from '../../services/editor-state.service';
import { TableImportService } from '../../services/table-import.service';
import { TableToolbarService } from '../../services/table-toolbar.service';

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

    this.tableImport
      .importExcel(file)
      .pipe(take(1))
      .subscribe({
        next: (resp) => {
          if (!resp?.success || !resp.data) {
            alert(resp?.error?.message || 'Excel import failed');
            return;
          }
          const data = resp.data;
          // Create the widget immediately so user sees the table, then run the same AutoFit import pipeline
          // inside `TableWidgetComponent` for perfect fitting.
          const widget = this.widgetFactory.createWidget('table', {
            rows: data.rows,
            columnFractions: data.columnFractions,
            rowFractions: data.rowFractions,
          } as any);

          this.documentService.addWidget(pageId, widget);
          this.editorState.setActiveWidget(widget.id);
          // Mark this new table as the active target for table-toolbar actions (split/merge/etc),
          // even before a cell is focused (important for freshly imported tables).
          this.tableToolbar.setActiveTableWidget(widget.id);

          const req = {
            widgetId: widget.id,
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
          alert(msg);
        },
      });
  }

  importCsv(file: File): void {
    const pageId = this.editorState.activePageId();
    if (!pageId) return;

    this.tableImport
      .importCsv(file)
      .pipe(take(1))
      .subscribe({
        next: (resp) => {
          if (!resp?.success || !resp.data) {
            alert(resp?.error?.message || 'CSV import failed');
            return;
          }
          const data = resp.data;

          const widget = this.widgetFactory.createWidget('table', {
            rows: data.rows,
            columnFractions: data.columnFractions,
            rowFractions: data.rowFractions,
          } as any);

          this.documentService.addWidget(pageId, widget);
          this.editorState.setActiveWidget(widget.id);
          // Mark this new table as the active target for table-toolbar actions (split/merge/etc)
          // even before a cell is focused (important for freshly imported tables).
          this.tableToolbar.setActiveTableWidget(widget.id);

          const req = {
            widgetId: widget.id,
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
          alert(msg);
        },
      });
  }

  importJson(file: File): void {
    const pageId = this.editorState.activePageId();
    if (!pageId) return;

    this.tableImport
      .importJson(file)
      .pipe(take(1))
      .subscribe({
        next: (resp) => {
          if (!resp?.success || !resp.data) {
            alert(resp?.error?.message || 'JSON import failed');
            return;
          }
          const data = resp.data;

          const widget = this.widgetFactory.createWidget('table', {
            rows: data.rows,
            columnFractions: data.columnFractions,
            rowFractions: data.rowFractions,
          } as any);

          this.documentService.addWidget(pageId, widget);
          this.editorState.setActiveWidget(widget.id);
          this.tableToolbar.setActiveTableWidget(widget.id);

          const req = {
            widgetId: widget.id,
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
          alert(msg);
        },
      });
  }

  importXml(file: File): void {
    const pageId = this.editorState.activePageId();
    if (!pageId) return;

    this.tableImport
      .importXml(file)
      .pipe(take(1))
      .subscribe({
        next: (resp) => {
          if (!resp?.success || !resp.data) {
            alert(resp?.error?.message || 'XML import failed');
            return;
          }
          const data = resp.data;

          const widget = this.widgetFactory.createWidget('table', {
            rows: data.rows,
            columnFractions: data.columnFractions,
            rowFractions: data.rowFractions,
          } as any);

          this.documentService.addWidget(pageId, widget);
          this.editorState.setActiveWidget(widget.id);
          this.tableToolbar.setActiveTableWidget(widget.id);

          const req = {
            widgetId: widget.id,
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
          alert(msg);
        },
      });
  }
}


