import { ChangeDetectionStrategy, Component, inject, ApplicationRef, NgZone, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';

import { WidgetFactoryService } from '../../widget-host/widget-factory.service';
import { DocumentService } from '../../../../core/services/document.service';
import { EditorStateService } from '../../../../core/services/editor-state.service';
import { ExportService } from '../../../../core/services/export.service';
import { ImportService } from '../../../../core/services/import.service';
import { PdfService } from '../../../../core/services/pdf.service';
import { PendingChangesRegistry } from '../../../../core/services/pending-changes-registry.service';
import { SaveIndicatorService } from '../../../../core/services/save-indicator.service';
import { WidgetType, TableRow, TableCell } from '../../../../models/widget.model';
import { TableDimensions } from '../../plugins/table/ui/table-grid-selector/table-grid-selector.component';
import { TableFileImportFacade } from '../../../../core/tabular-import/facades/table-file-import.facade';
import type { TableHttpDataSourceConfig } from '../../../../shared/http-request/models/http-data-source.model';
import { ChartToolbarService } from '../../../../core/services/chart-toolbar.service';
import { createDefaultChartData, createEmptyChartData } from '../../../../models/chart-data.model';
import type { ChartWidgetProps } from '../../../../models/widget.model';
import type { ChartType } from '../../../../models/chart-data.model';
import type { ChartWidgetInsertAction } from '../../plugins/chart/ui/chart-widget-selector/chart-widget-selector.component';
import { AppState } from '../../../../store/app.state';
import { DocumentSelectors } from '../../../../store/document/document.selectors';
import { RemoteWidgetLoadRegistryService } from '../../../../core/services/remote-widget-load-registry.service';
import { RemoteWidgetAutoLoadService } from '../../../../core/services/remote-widget-auto-load.service';

@Component({
  selector: 'app-editor-toolbar',
  templateUrl: './editor-toolbar.component.html',
  styleUrls: ['./editor-toolbar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorToolbarComponent implements AfterViewInit {
  private readonly widgetFactory = inject(WidgetFactoryService);
  protected readonly documentService = inject(DocumentService);
  private readonly editorState = inject(EditorStateService);
  private readonly exportService = inject(ExportService);
  private readonly importService = inject(ImportService);
  private readonly pdfService = inject(PdfService);
  private readonly pendingChangesRegistry = inject(PendingChangesRegistry);
  private readonly saveIndicator = inject(SaveIndicatorService);
  private readonly tableFileImport = inject(TableFileImportFacade);
  private readonly chartToolbar = inject(ChartToolbarService);
  private readonly appRef = inject(ApplicationRef);
  private readonly ngZone = inject(NgZone);
  private readonly store = inject(Store<AppState>);
  private readonly remoteLoads = inject(RemoteWidgetLoadRegistryService);
  private readonly remoteAutoLoad = inject(RemoteWidgetAutoLoadService);

  /** Document title from store */
  readonly documentTitle = toSignal(
    this.store.select(DocumentSelectors.selectDocumentTitle),
    { initialValue: 'Untitled Document' }
  );
  
  /** Denormalized document for export */
  readonly document$ = this.store.select(DocumentSelectors.selectDenormalizedDocument);

  /** Table import UI state (backend request in progress + last error) */
  readonly tableImportInProgress = this.tableFileImport.importInProgress;
  readonly tableImportError = this.tableFileImport.importError;

  /** URL-based widgets loading state (auto-fetch after import/open) */
  readonly remoteLoadCount = this.remoteLoads.pendingCount;

  /** Saving indicator state (UI-only) */
  readonly saveState = this.saveIndicator.state;
  
  // File input reference for import
  private fileInput?: HTMLInputElement;

  // Document name editing
  isEditingDocumentName = false;
  documentNameValue = '';
  @ViewChild('documentNameInputRef') documentNameInputRef?: ElementRef<HTMLInputElement>;

  addWidget(type: WidgetType): void {
    const pageId = this.editorState.activePageId();

    if (!pageId) {
      return;
    }

    const widget = this.widgetFactory.createWidget(type);
    this.documentService.addWidget(pageId, widget);
    
    // Set the newly added widget as active
    this.editorState.setActiveWidget(widget.id);
  }

  onChartWidgetAction(action: ChartWidgetInsertAction): void {
    const pageId = this.editorState.activePageId();
    if (!pageId) return;

    // Create a new chart widget and seed its dataset depending on the selection.
    const widget = this.widgetFactory.createWidget('chart') as any;
    const props = widget.props as ChartWidgetProps;

    const defaultType: ChartType = 'column';

    if (action === 'sample') {
      const data = createDefaultChartData(defaultType);
      props.chartType = data.chartType;
      props.data = data;
    } else if (action === 'placeholder') {
      const data = createEmptyChartData(defaultType);
      props.chartType = data.chartType;
      props.data = data;
    } else {
      // import: keep placeholder dataset, but open import dialog after insertion
      const data = createEmptyChartData(defaultType);
      props.chartType = data.chartType;
      props.data = data;
    }

    this.documentService.addWidget(pageId, widget);
    this.editorState.setActiveWidget(widget.id);

    if (action === 'import') {
      // Ensure chart widget is mounted before requesting dialog open (Subject is not replayed).
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this.chartToolbar.requestOpenImport(widget.id);
        });
      });
    }
  }

  onTableInsert(dimensions: TableDimensions): void {
    const pageId = this.editorState.activePageId();

    if (!pageId) {
      return;
    }

    const rows = this.createTableRows(dimensions.rows, dimensions.columns);
    const widget = this.widgetFactory.createWidget('table', { rows });
    this.documentService.addWidget(pageId, widget);
    this.editorState.setActiveWidget(widget.id);
  }

  onTableImportExcel(file: File): void {
    this.tableFileImport.importFile(file);
  }

  onTableImportUrl(config: TableHttpDataSourceConfig): void {
    this.tableFileImport.importFromUrl(config);
  }

  private createTableRows(rowCount: number, colCount: number): TableRow[] {
    const rows: TableRow[] = [];
    for (let r = 0; r < rowCount; r++) {
      const cells: TableCell[] = [];
      for (let c = 0; c < colCount; c++) {
        cells.push({
          id: `cell-${r}-${c}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          contentHtml: '',
        });
      }
      rows.push({
        id: `row-${r}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        cells,
      });
    }
    return rows;
  }

  async exportDocument(): Promise<void> {
    if (this.remoteLoadCount() > 0) {
      alert('Please wait: remote (URL-based) widgets are still loading. Export is disabled until loading completes.');
      return;
    }
    // Flush any pending changes from active editors before export
    await this.pendingChangesRegistry.flushAll();
    
    const document = this.documentService.document;
    this.exportService.exportToFile(document).catch(() => {
      // Error handling is done in export service
    });
  }

  async exportToClipboard(): Promise<void> {
    if (this.remoteLoadCount() > 0) {
      alert('Please wait: remote (URL-based) widgets are still loading. Export is disabled until loading completes.');
      return;
    }
    // Flush any pending changes from active editors before export
    await this.pendingChangesRegistry.flushAll();
    
    const document = this.documentService.document;
    const success = await this.exportService.exportToClipboard(document);
    if (success) {
      alert('Document exported to clipboard!');
    } else {
      alert('Failed to copy to clipboard. Please try exporting as file instead.');
    }
  }

  triggerImport(): void {
    if (!this.fileInput) {
      this.fileInput = document.createElement('input');
      this.fileInput.type = 'file';
      this.fileInput.accept = '.json,application/json';
      this.fileInput.style.display = 'none';
      this.fileInput.addEventListener('change', (event) => {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        // Important: reset the input so selecting the SAME file again triggers a change event.
        input.value = '';
        if (file) {
          this.importDocument(file);
        }
      });
      document.body.appendChild(this.fileInput);
    }
    // Also clear before opening picker (some browsers keep last selection until cleared).
    this.fileInput.value = '';
    this.fileInput.click();
  }

  private async forceChartsReRender(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 100));
    this.ngZone.run(() => {
      this.appRef.tick();
    });
    await new Promise(resolve => setTimeout(resolve, 300));
    this.ngZone.run(() => {
      this.appRef.tick();
    });
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  async importDocument(file: File): Promise<void> {
    const result = await this.importService.importFromFile(file);
    
    if (result.success && result.document) {
      const confirmed = confirm(
        'This will replace your current document. Are you sure you want to continue?'
      );

      if (confirmed) {
        // Reset URL auto-load memory so URL-based widgets will re-fetch after replacing the document.
        // This is important when importing the same JSON multiple times in one session (widget IDs repeat).
        this.remoteAutoLoad.resetSession();
        this.remoteLoads.clear();

        // Replace document in store
        this.documentService.replaceDocument(result.document);

        // Reset navigation to first section/subsection/page
        // Use setTimeout to allow store to update first
        setTimeout(() => {
          this.ngZone.run(() => {
            this.editorState.resetNavigation();
            this.appRef.tick();
          });
        }, 100);

        await this.forceChartsReRender();
        
        let message = 'Document imported successfully!';
        if (result.warnings && result.warnings.length > 0) {
          message += '\n\nWarnings:\n' + result.warnings.join('\n');
        }
        if (result.metadata) {
          message += `\n\nImported from: ${result.metadata.exportedAt}`;
          if (result.metadata.description) {
            message += `\nDescription: ${result.metadata.description}`;
          }
        }
        alert(message);
      }
    } else {
      alert(`Import failed: ${result.error || 'Unknown error'}`);
    }
  }

  async downloadPDF(): Promise<void> {
    if (this.remoteLoadCount() > 0) {
      alert('Please wait: remote (URL-based) widgets are still loading. PDF download is disabled until loading completes.');
      return;
    }
    // Flush any pending changes from active editors before export
    await this.pendingChangesRegistry.flushAll();
    
    const document = this.documentService.document;

    if (!document) {
      alert('No document to export');
      return;
    }

    try {
      await this.pdfService.downloadPDF(document);
    } catch (error) {
      alert(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}\n\nMake sure the PDF backend server is running on http://localhost:3000`);
    }
  }

  ngAfterViewInit(): void {
  }

  startEditingDocumentName(): void {
    this.documentNameValue = this.documentTitle() || '';
    this.isEditingDocumentName = true;
    
    // Focus the input after Angular updates
    setTimeout(() => {
      if (this.documentNameInputRef?.nativeElement) {
        this.documentNameInputRef.nativeElement.focus();
        this.documentNameInputRef.nativeElement.select();
      }
    }, 0);
  }

  saveDocumentName(): void {
    if (this.isEditingDocumentName) {
      const trimmedValue = this.documentNameValue.trim();
      this.documentService.updateDocumentTitle(trimmedValue || 'Untitled Document');
      this.isEditingDocumentName = false;
      this.documentNameValue = '';
    }
  }

  cancelEditingDocumentName(): void {
    this.isEditingDocumentName = false;
    this.documentNameValue = '';
  }

}
