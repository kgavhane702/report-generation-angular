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

  importExcel(file: File): void {
    const pageId = this.editorState.activePageId();
    if (!pageId) return;

    this.tableImport
      .importExcel(file)
      .pipe(take(1))
      .subscribe({
        next: (resp) => {
          // Create the widget immediately so user sees the table, then run the same AutoFit import pipeline
          // inside `TableWidgetComponent` for perfect fitting.
          const widget = this.widgetFactory.createWidget('table', {
            rows: resp.rows,
            columnFractions: resp.columnFractions,
            rowFractions: resp.rowFractions,
          } as any);

          this.documentService.addWidget(pageId, widget);
          this.editorState.setActiveWidget(widget.id);

          const req = {
            widgetId: widget.id,
            rows: resp.rows,
            columnFractions: resp.columnFractions,
            rowFractions: resp.rowFractions,
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
          alert('Excel import failed. Please verify the backend is running and the file is a valid .xlsx.');
        },
      });
  }
}


