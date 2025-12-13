import { ChangeDetectionStrategy, Component, inject, ApplicationRef, NgZone, ViewChild, ElementRef, AfterViewInit, HostListener, OnDestroy } from '@angular/core';
import { Subject, from, Subscription, firstValueFrom } from 'rxjs';
import { switchMap, delay, debounceTime, catchError, skip, take, timeout } from 'rxjs/operators';

import { WidgetFactoryService } from '../widgets/widget-factory.service';
import { DocumentService } from '../../../core/services/document.service';
import { EditorStateService } from '../../../core/services/editor-state.service';
import { ExportService } from '../../../core/services/export.service';
import { ImportService } from '../../../core/services/import.service';
import { PdfService } from '../../../core/services/pdf.service';
import { WidgetSaveService } from '../../../core/services/widget-save.service';
import { WidgetType } from '../../../models/widget.model';
@Component({
  selector: 'app-editor-toolbar',
  templateUrl: './editor-toolbar.component.html',
  styleUrls: ['./editor-toolbar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorToolbarComponent implements AfterViewInit, OnDestroy {
  private readonly widgetFactory = inject(WidgetFactoryService);
  protected readonly documentService = inject(DocumentService);
  private readonly editorState = inject(EditorStateService);
  private readonly exportService = inject(ExportService);
  private readonly importService = inject(ImportService);
  private readonly pdfService = inject(PdfService);
  private readonly appRef = inject(ApplicationRef);
  private readonly ngZone = inject(NgZone);
  private readonly widgetSaveService = inject(WidgetSaveService);

  readonly document$ = this.documentService.document$;
  
  // RxJS Subject for add widget requests
  private addWidgetSubject = new Subject<{ type: WidgetType; options?: { rows?: number; columns?: number } }>();
  private subscriptions = new Subscription();
  
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
    // Emit to RxJS pipeline which handles: save pending → add widget
    this.addWidgetSubject.next({ type, options });
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
    // Save active page widgets before exporting
    const activePageId = this.editorState.activePageId();
    await this.widgetSaveService.saveActivePageWidgets(activePageId);
    // Small delay to ensure saves are processed
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const document = this.documentService.document;
    this.exportService.exportToFile(document).catch(() => {
      // Error handling is done in export service
    });
  }

  async exportToClipboard(): Promise<void> {
    // Save active page widgets before exporting
    const activePageId = this.editorState.activePageId();
    try {
      await this.widgetSaveService.saveActivePageWidgets(activePageId);
      // Small delay to ensure saves are processed
      await new Promise(resolve => setTimeout(resolve, 50));
    } catch (error) {
      console.error('Error saving widgets before clipboard export:', error);
      // Continue with export anyway - user should be aware of potential data loss
      const proceed = confirm(
        `Some changes could not be saved before export. Do you want to continue anyway?\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      if (!proceed) {
        return;
      }
    }
    
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
        // replaceDocument already clears widget save status, but ensure it's done
        this.documentService.replaceDocument(result.document);

        const firstSection = result.document.sections[0];
        const firstSubsection = firstSection?.subsections[0];
        if (firstSubsection) {
          this.ngZone.run(() => {
            this.editorState.setActiveSubsection(firstSubsection.id);
            this.appRef.tick();
          });
        }

        await new Promise(resolve => setTimeout(resolve, 200));
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
    // Save active page widgets before generating PDF
    const activePageId = this.editorState.activePageId();
    try {
      // Save active page widgets
      await this.widgetSaveService.saveActivePageWidgets(activePageId);
      
      // Wait for the document observable to emit a new value (document updated)
      // This is more efficient than JSON.stringify polling and guarantees the update
      try {
        await firstValueFrom(
          this.documentService.document$.pipe(
            skip(1), // Skip the current value
            take(1), // Take the next value (updated document)
            timeout(1000) // Max 1 second wait
          )
        );
        // Small delay to ensure all updates are fully propagated
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (timeoutError) {
        // If timeout, document may not have changed or already updated
        // Proceed anyway - saves should be done
        console.warn('Document update timeout, proceeding with PDF generation');
      }
    } catch (error) {
      console.error('Error saving widgets before PDF generation:', error);
      // Ask user if they want to proceed with potentially stale data
      const proceed = confirm(
        `Some changes could not be saved before PDF generation. The PDF may not include your latest changes. Do you want to continue anyway?\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      if (!proceed) {
        return;
      }
    }

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
    // Setup RxJS pipeline for add widget: save pending → add widget
    this.subscriptions.add(
      this.addWidgetSubject.pipe(
        debounceTime(100), // Small debounce to prevent rapid duplicate clicks
        switchMap(({ type, options }) => {
          // Save active page widgets first, then add widget
          const activePageId = this.editorState.activePageId();
          return from(this.widgetSaveService.saveActivePageWidgets(activePageId)).pipe(
            delay(50), // Small delay to ensure saves are processed
            switchMap(() => from(this.addWidgetInternal(type, options))),
            catchError((error) => {
              console.error('Error saving widgets before adding widget:', error);
              // Still proceed to add widget - user can manually save later
              return from(this.addWidgetInternal(type, options));
            })
          );
        })
      ).subscribe({
        error: (err) => {
          console.error('Error in add widget flow:', err);
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.addWidgetSubject.complete();
  }

  private addWidgetInternal(type: WidgetType, options?: { rows?: number; columns?: number }): Promise<void> {
    return new Promise<void>((resolve) => {
      const subsectionId = this.editorState.activeSubsectionId();
      const pageId = this.editorState.activePageId();

      if (!subsectionId || !pageId) {
        resolve();
        return;
      }

      const widget = this.widgetFactory.createWidget(type, options);
      this.documentService.addWidget(subsectionId, pageId, widget);
      this.editorState.setActiveWidget(widget.id);
      
      resolve();
    });
  }

  startEditingDocumentName(): void {
    const doc = this.documentService.document;
    this.documentNameValue = doc.title || '';
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

