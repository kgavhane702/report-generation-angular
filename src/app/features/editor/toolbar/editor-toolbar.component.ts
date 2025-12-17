import { ChangeDetectionStrategy, Component, inject, ApplicationRef, NgZone, ViewChild, ElementRef, AfterViewInit, HostListener } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';

import { WidgetFactoryService } from '../widgets/widget-factory.service';
import { DocumentService } from '../../../core/services/document.service';
import { EditorStateService } from '../../../core/services/editor-state.service';
import { ExportService } from '../../../core/services/export.service';
import { ImportService } from '../../../core/services/import.service';
import { PdfService } from '../../../core/services/pdf.service';
import { PendingChangesRegistry } from '../../../core/services/pending-changes-registry.service';
import { WidgetType } from '../../../models/widget.model';
import { AppState } from '../../../store/app.state';
import { DocumentSelectors } from '../../../store/document/document.selectors';

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
  private readonly appRef = inject(ApplicationRef);
  private readonly ngZone = inject(NgZone);
  private readonly store = inject(Store<AppState>);

  /** Document title from store */
  readonly documentTitle = toSignal(
    this.store.select(DocumentSelectors.selectDocumentTitle),
    { initialValue: 'Untitled Document' }
  );
  
  /** Denormalized document for export */
  readonly document$ = this.store.select(DocumentSelectors.selectDenormalizedDocument);
  
  // File input reference for import
  private fileInput?: HTMLInputElement;

  // Document name editing
  isEditingDocumentName = false;
  documentNameValue = '';
  @ViewChild('documentNameInputRef') documentNameInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('tableDropdownContainer') tableDropdownContainer?: ElementRef<HTMLElement>;

  // Table dropdown (for advanced table grid selection)
  showTableDropdown = false;

  addWidget(type: WidgetType, options?: { rows?: number; columns?: number }): void {
    const pageId = this.editorState.activePageId();

    if (!pageId) {
      return;
    }

    const widget = this.widgetFactory.createWidget(type, options);
    this.documentService.addWidget(pageId, widget);
    
    // Set the newly added widget as active
    this.editorState.setActiveWidget(widget.id);
  }

  toggleTableDropdown(): void {
    this.showTableDropdown = !this.showTableDropdown;
  }

  closeTableDropdown(): void {
    this.showTableDropdown = false;
  }


  onTableGridSelected(result: { rows: number; columns: number }): void {
    this.closeTableDropdown();
    if (result.rows > 0 && result.columns > 0) {
      this.addWidget('advanced-table', {
        rows: result.rows,
        columns: result.columns,
      });
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.tableDropdownContainer?.nativeElement && 
        !this.tableDropdownContainer.nativeElement.contains(event.target as Node)) {
      this.closeTableDropdown();
    }
  }

  async exportDocument(): Promise<void> {
    // Flush any pending changes from active editors before export
    await this.pendingChangesRegistry.flushAll();
    
    const document = this.documentService.document;
    this.exportService.exportToFile(document).catch(() => {
      // Error handling is done in export service
    });
  }

  async exportToClipboard(): Promise<void> {
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
        const file = (event.target as HTMLInputElement).files?.[0];
        if (file) {
          this.importDocument(file);
        }
      });
      document.body.appendChild(this.fileInput);
    }
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
