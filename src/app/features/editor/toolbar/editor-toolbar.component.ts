import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { WidgetFactoryService } from '../widgets/widget-factory.service';
import { DocumentService } from '../../../core/services/document.service';
import { EditorStateService } from '../../../core/services/editor-state.service';
import { ExportService } from '../../../core/services/export.service';
import { ImportService } from '../../../core/services/import.service';
import { WidgetType } from '../../../models/widget.model';
import { PageSize } from '../../../models/document.model';

interface PagePreset {
  id: string;
  label: string;
  widthMm: number;
  heightMm: number;
}

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

  readonly document$ = this.documentService.document$;
  
  // File input reference for import
  private fileInput?: HTMLInputElement;

  readonly pageSizePresets: PagePreset[] = [
    { id: 'ppt-wide', label: 'PPT Widescreen 16:9 (13.33" × 7.5")', widthMm: 338.67, heightMm: 190.5 },
    { id: 'ppt-standard', label: 'PPT Standard 4:3 (10" × 7.5")', widthMm: 254, heightMm: 190.5 },
    { id: 'a4', label: 'A4 (297 × 210 mm)', widthMm: 297, heightMm: 210 },
  ];

  addWidget(type: WidgetType): void {
    const subsectionId = this.editorState.activeSubsectionId();
    const pageId = this.editorState.activePageId();

    if (!subsectionId || !pageId) {
      return;
    }

    const widget = this.widgetFactory.createWidget(type);
    this.documentService.addWidget(subsectionId, pageId, widget);
  }

  applyPreset(presetId: string): void {
    const preset = this.pageSizePresets.find((p) => p.id === presetId);
    if (!preset) {
      return;
    }
    // Apply preset dimensions (orientation is now per-page)
    this.documentService.updatePageSize({
      widthMm: preset.widthMm,
      heightMm: preset.heightMm,
    });
  }

  getPresetId(pageSize: PageSize): string {
    const current = [pageSize.widthMm, pageSize.heightMm].sort();
    const match = this.pageSizePresets.find((preset) => {
      const presetDims = [preset.widthMm, preset.heightMm].sort();
      return (
        Math.abs(presetDims[0] - current[0]) < 0.5 &&
        Math.abs(presetDims[1] - current[1]) < 0.5
      );
    });
    return match?.id ?? 'custom';
  }

  /**
   * Export document to JSON file
   */
  exportDocument(): void {
    const document = this.documentService.document;
    this.exportService.exportToFile(document);
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
        this.documentService.replaceDocument(result.document);
        
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
}

