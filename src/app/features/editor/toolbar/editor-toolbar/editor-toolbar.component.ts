import { ChangeDetectionStrategy, Component, inject, ApplicationRef, NgZone, ViewChild, ElementRef, AfterViewInit, computed, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';

import { WidgetFactoryService } from '../../widget-host/widget-factory.service';
import { DocumentService } from '../../../../core/services/document.service';
import { EditorStateService } from '../../../../core/services/editor-state.service';
import { ExportService } from '../../../../core/services/export.service';
import { DocumentDownloadService } from '../../../../core/services/document-download.service';
import { ImportService } from '../../../../core/services/import.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { PendingChangesRegistry } from '../../../../core/services/pending-changes-registry.service';
import { SaveIndicatorService } from '../../../../core/services/save-indicator.service';
import { UndoRedoService } from '../../../../core/services/undo-redo.service';
import { DraftStateService } from '../../../../core/services/draft-state.service';
import { UIStateService } from '../../../../core/services/ui-state.service';
import { ChartRenderRegistry } from '../../../../core/services/chart-render-registry.service';
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
import { HeaderFooterEditDialogComponent } from '../header-footer-edit-dialog/header-footer-edit-dialog.component';

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
  private readonly documentDownload = inject(DocumentDownloadService);
  private readonly importService = inject(ImportService);
  private readonly notify = inject(NotificationService);
  private readonly pendingChangesRegistry = inject(PendingChangesRegistry);
  private readonly saveIndicator = inject(SaveIndicatorService);
  private readonly undoRedo = inject(UndoRedoService);
  private readonly draftState = inject(DraftStateService);
  private readonly uiState = inject(UIStateService);
  private readonly chartRenderRegistry = inject(ChartRenderRegistry);
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
  private readonly manualSaveInProgress = signal(false);
  readonly displaySaveState = computed(() => (this.manualSaveInProgress() ? 'saving' : this.saveState()));
  
  // File input reference for import
  private fileInput?: HTMLInputElement;

  /** Image insert dialog (UI-only, similar to table import style) */
  readonly imageInsertDialogOpen = signal(false);
  readonly imageInsertFile = signal<File | null>(null);
  readonly imageInsertFileName = signal<string | null>(null);
  readonly imageInsertInProgress = signal(false);
  readonly imageInsertError = signal<string | null>(null);

  // Image constraints
  private readonly IMAGE_MAX_FILE_SIZE = 10 * 1024 * 1024;
  private readonly IMAGE_ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

  // Document name editing
  isEditingDocumentName = false;
  documentNameValue = '';
  @ViewChild('documentNameInputRef') documentNameInputRef?: ElementRef<HTMLInputElement>;

  // Header/Footer dialog
  @ViewChild(HeaderFooterEditDialogComponent) headerFooterDialog?: HeaderFooterEditDialogComponent;

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

  openImageInsertDialog(): void {
    if (this.imageInsertInProgress()) return;
    this.imageInsertDialogOpen.set(true);
    this.imageInsertFile.set(null);
    this.imageInsertFileName.set(null);
    this.imageInsertError.set(null);
  }

  cancelImageInsert(): void {
    if (this.imageInsertInProgress()) return;
    this.imageInsertDialogOpen.set(false);
    this.imageInsertFile.set(null);
    this.imageInsertFileName.set(null);
    this.imageInsertError.set(null);
  }

  onImageInsertFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    // reset immediately so selecting same file again triggers change
    input.value = '';

    if (this.imageInsertInProgress()) return;
    if (!file) return;

    this.imageInsertFile.set(file);
    this.imageInsertFileName.set(file.name);
    this.imageInsertError.set(null);
  }

  async confirmImageInsert(): Promise<void> {
    const file = this.imageInsertFile();
    if (!file || this.imageInsertInProgress()) return;

    const validationError = this.validateImageFile(file);
    if (validationError) {
      this.imageInsertError.set(validationError);
      return;
    }

    this.imageInsertInProgress.set(true);
    this.imageInsertError.set(null);

    let success = false;
    try {
      const src = await this.convertFileToBase64(file);
      this.insertImageWidget({ src, alt: file.name });
      // Reset state and close dialog after successful insertion
      this.imageInsertFile.set(null);
      this.imageInsertFileName.set(null);
      this.imageInsertError.set(null);
      success = true;
    } catch {
      this.imageInsertError.set('Failed to read image. Please try another file.');
    } finally {
      // Always stop spinner; close dialog only on success.
      this.imageInsertInProgress.set(false);
      if (success) {
        this.imageInsertDialogOpen.set(false);
      }
    }
  }

  private insertImageWidget(payload: { src: string; alt: string }): void {
    const pageId = this.editorState.activePageId();
    if (!pageId) return;

    const widget = this.widgetFactory.createWidget('image') as any;
    widget.props = {
      ...(widget.props ?? {}),
      src: payload.src,
      alt: payload.alt,
      fit: widget.props?.fit ?? 'contain',
    };

    this.documentService.addWidget(pageId, widget);
    this.editorState.setActiveWidget(widget.id);
  }

  private validateImageFile(file: File): string | null {
    if (!this.IMAGE_ACCEPTED_TYPES.includes(file.type)) {
      return 'Please select a valid image file (JPEG, PNG, GIF, WebP, or SVG).';
    }
    if (file.size > this.IMAGE_MAX_FILE_SIZE) {
      return `Image size must be less than ${this.IMAGE_MAX_FILE_SIZE / (1024 * 1024)}MB.`;
    }
    return null;
  }

  private convertFileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      // Ensure callbacks run inside Angular zone so OnPush views update without manual CD APIs.
      reader.onloadend = () => {
        this.ngZone.run(() => resolve(reader.result as string));
      };
      reader.onerror = () => {
        this.ngZone.run(() => reject(new Error('Failed to read file')));
      };
      reader.readAsDataURL(file);
    });
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
      this.notify.warning(
        'Please wait: remote (URL-based) widgets are still loading.',
        'Export disabled'
      );
      return;
    }
    // Flush any pending changes from active editors before export
    await this.pendingChangesRegistry.flushAll();
    
    const document = this.documentService.document;
    try {
      await this.exportService.exportToFile(document);
      this.notify.success('Document exported successfully!', 'Exported');
    } catch (error) {
      const details = error instanceof Error ? error.message : 'Unknown error';
      this.notify.error(`Export failed: ${details}`, 'Export failed');
    }
  }

  async exportToClipboard(): Promise<void> {
    if (this.remoteLoadCount() > 0) {
      this.notify.warning(
        'Please wait: remote (URL-based) widgets are still loading.',
        'Export disabled'
      );
      return;
    }
    // Flush any pending changes from active editors before export
    await this.pendingChangesRegistry.flushAll();
    
    const document = this.documentService.document;
    const success = await this.exportService.exportToClipboard(document);
    if (success) {
      this.notify.success('Document exported to clipboard!', 'Exported');
    } else {
      this.notify.error('Failed to copy to clipboard. Please try exporting as file instead.', 'Export failed');
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

        // Reset transient UI/app state tied to the previous document so we can't "undo into" the old doc.
        this.pendingChangesRegistry.clear();
        this.draftState.discardAllDrafts();
        this.undoRedo.clearHistory();
        this.uiState.clearSelection();
        this.chartRenderRegistry.resetAllToPending();

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
        
        this.notify.success('Document imported successfully!', 'Imported');

        if (result.warnings && result.warnings.length > 0) {
          const warnings = result.warnings.slice(0, 3).join(' • ');
          const suffix = result.warnings.length > 3 ? ` (+${result.warnings.length - 3} more)` : '';
          this.notify.warning(`${warnings}${suffix}`, 'Import warnings', { timeOut: 6000 });
        }

        if (result.metadata?.description) {
          this.notify.info(result.metadata.description, 'Import notes');
        }
      }
    } else {
      this.notify.error(result.error || 'Unknown error', 'Import failed');
    }
  }

  openHeaderFooterDialog(): void {
    this.headerFooterDialog?.openDialog();
  }

  async downloadPDF(): Promise<void> {
    if (this.remoteLoadCount() > 0) {
      this.notify.warning(
        'Please wait: remote (URL-based) widgets are still loading.',
        'PDF download disabled'
      );
      return;
    }
    // Flush any pending changes from active editors before export
    await this.pendingChangesRegistry.flushAll();
    
    const document = this.documentService.document;

    if (!document) {
      this.notify.info('No document to export', 'PDF');
      return;
    }

    try {
      await this.documentDownload.download(document, 'pdf');
      this.notify.success('PDF generated successfully!', 'PDF ready');
    } catch (error) {
      const details = error instanceof Error ? error.message : 'Unknown error';
      this.notify.error(
        `Failed to generate PDF: ${details}. Make sure the backend is running (default via proxy: http://localhost:8080).`,
        'PDF failed'
      );
    }
  }

  ngAfterViewInit(): void {
  }

  onSaveIndicatorKeydown(event: KeyboardEvent): void {
    // Make the save indicator (a span) keyboard-accessible.
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      void this.saveNow();
    }
  }

  async saveNow(): Promise<void> {
    if (this.manualSaveInProgress()) return;
    this.manualSaveInProgress.set(true);
    // Always show the same saving/saved animation as normal edits (even if nothing to flush).
    this.saveIndicator.pulse();
    try {
      // Force any delayed-edit widgets (text/table) to commit before considering the document "saved".
      await this.pendingChangesRegistry.flushAll();
    } finally {
      this.manualSaveInProgress.set(false);
    }
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
