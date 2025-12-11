import { ChangeDetectionStrategy, Component, inject, ApplicationRef, NgZone } from '@angular/core';

import { WidgetFactoryService } from '../widgets/widget-factory.service';
import { DocumentService } from '../../../core/services/document.service';
import { EditorStateService } from '../../../core/services/editor-state.service';
import { ExportService } from '../../../core/services/export.service';
import { ImportService } from '../../../core/services/import.service';
import { PdfService } from '../../../core/services/pdf.service';
import { WidgetType } from '../../../models/widget.model';
@Component({
  selector: 'app-editor-toolbar',
  templateUrl: './editor-toolbar.component.html',
  styleUrls: ['./editor-toolbar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorToolbarComponent {
  private readonly widgetFactory = inject(WidgetFactoryService);
  protected readonly documentService = inject(DocumentService);
  private readonly editorState = inject(EditorStateService);
  private readonly exportService = inject(ExportService);
  private readonly importService = inject(ImportService);
  private readonly pdfService = inject(PdfService);
  private readonly appRef = inject(ApplicationRef);
  private readonly ngZone = inject(NgZone);

  readonly document$ = this.documentService.document$;
  
  // File input reference for import
  private fileInput?: HTMLInputElement;

  addWidget(type: WidgetType): void {
    const subsectionId = this.editorState.activeSubsectionId();
    const pageId = this.editorState.activePageId();

    if (!subsectionId || !pageId) {
      return;
    }

    const widget = this.widgetFactory.createWidget(type);
    this.documentService.addWidget(subsectionId, pageId, widget);
    
    // Set the newly added widget as active
    this.editorState.setActiveWidget(widget.id);
  }

  /**
   * Export document to JSON file
   */
  exportDocument(): void {
    const document = this.documentService.document;
    this.exportService.exportToFile(document).catch(error => {
      console.error('Failed to export file:', error);
    });
  }

  /**
   * Export document to clipboard
   */
  async exportToClipboard(): Promise<void> {
    const document = this.documentService.document;
    const success = await this.exportService.exportToClipboard(document);
    if (success) {
      alert('Document exported to clipboard!');
    } else {
      alert('Failed to copy to clipboard. Please try exporting as file instead.');
    }
  }

  /**
   * Trigger file input for import
   */
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

  /**
   * Force all chart components to re-render
   * This is needed after import to ensure charts are properly initialized
   */
  private async forceChartsReRender(): Promise<void> {
    // Wait for Angular to process the document change
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Trigger change detection
    this.ngZone.run(() => {
      this.appRef.tick();
    });
    
    // Find all chart widget containers and trigger re-render
    const chartContainers = document.querySelectorAll('.chart-widget__container');
    console.log(`Found ${chartContainers.length} chart containers to re-render`);
    
    // Wait a bit more for components to initialize
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Trigger another change detection cycle
    this.ngZone.run(() => {
      this.appRef.tick();
    });
    
    // Additional wait for Highcharts to initialize
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  /**
   * Import document from file
   */
  async importDocument(file: File): Promise<void> {
    const result = await this.importService.importFromFile(file);
    
    if (result.success && result.document) {
      // Confirm before replacing current document
      const confirmed = confirm(
        'This will replace your current document. Are you sure you want to continue?'
      );
      
      if (confirmed) {
        // Replace the document
        this.documentService.replaceDocument(result.document);
        
        // Set active subsection to first one to ensure pages are rendered
        const firstSection = result.document.sections[0];
        const firstSubsection = firstSection?.subsections[0];
        if (firstSubsection) {
          this.ngZone.run(() => {
            this.editorState.setActiveSubsection(firstSubsection.id);
            this.appRef.tick();
          });
        }
        
        // Wait for Angular to render the new document
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Force all charts to re-render
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

  /**
   * Download document as PDF
   */
  async downloadPDF(): Promise<void> {
    const document = this.documentService.document;
    
    if (!document) {
      alert('No document to export');
      return;
    }

    try {
      // Show loading message
      const loadingMessage = 'Generating PDF... This may take a moment.';
      console.log(loadingMessage);
      
      // Generate and download PDF
      await this.pdfService.downloadPDF(document);
      
      console.log('PDF downloaded successfully');
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}\n\nMake sure the PDF backend server is running on http://localhost:3000`);
    }
  }

}

