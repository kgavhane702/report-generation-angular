import {
  ChangeDetectionStrategy,
  Component,
  inject,
  ChangeDetectorRef,
  effect,
} from '@angular/core';
import { EditorStateService } from '../../../../core/services/editor-state.service';
import { UndoRedoService } from '../../../../core/services/undo-redo.service';
import { DocumentService } from '../../../../core/services/document.service';

@Component({
  selector: 'app-zoom-controls',
  templateUrl: './zoom-controls.component.html',
  styleUrls: ['./zoom-controls.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ZoomControlsComponent {
  protected readonly editorState = inject(EditorStateService);
  private readonly undoRedoService = inject(UndoRedoService);
  private readonly documentService = inject(DocumentService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly zoom = this.editorState.zoom;
  readonly canUndo = this.undoRedoService.zoomCanUndo;
  readonly canRedo = this.undoRedoService.zoomCanRedo;

  private skipRecording: boolean = false;

  constructor() {
    // Track zoom changes for change detection
    effect(() => {
      this.editorState.zoom();
      this.cdr.markForCheck();
    });
  }

  onZoomChange(value: number): void {
    if (this.skipRecording) {
      return;
    }
    const oldZoom = this.zoom();
    this.editorState.setZoom(value);
    // Record zoom change for undo/redo
    if (oldZoom !== value) {
      this.undoRedoService.recordZoomChange(
        oldZoom,
        value,
        (zoom) => {
          this.skipRecording = true;
          this.editorState.setZoom(zoom);
          setTimeout(() => {
            this.skipRecording = false;
          }, 0);
        }
      );
    }
  }

  zoomIn(): void {
    if (this.skipRecording) {
      return;
    }
    const oldZoom = this.zoom();
    this.editorState.zoomIn();
    const newZoom = this.zoom();
    if (oldZoom !== newZoom) {
      this.undoRedoService.recordZoomChange(
        oldZoom,
        newZoom,
        (zoom) => {
          this.skipRecording = true;
          this.editorState.setZoom(zoom);
          setTimeout(() => {
            this.skipRecording = false;
          }, 0);
        }
      );
    }
  }

  zoomOut(): void {
    if (this.skipRecording) {
      return;
    }
    const oldZoom = this.zoom();
    this.editorState.zoomOut();
    const newZoom = this.zoom();
    if (oldZoom !== newZoom) {
      this.undoRedoService.recordZoomChange(
        oldZoom,
        newZoom,
        (zoom) => {
          this.skipRecording = true;
          this.editorState.setZoom(zoom);
          setTimeout(() => {
            this.skipRecording = false;
          }, 0);
        }
      );
    }
  }

  resetZoom(): void {
    if (this.skipRecording) {
      return;
    }
    const oldZoom = this.zoom();
    this.calculateAndSetFitZoom();
    const newZoom = this.zoom();
    if (oldZoom !== newZoom) {
      this.undoRedoService.recordZoomChange(
        oldZoom,
        newZoom,
        (zoom) => {
          this.skipRecording = true;
          this.editorState.setZoom(zoom);
          setTimeout(() => {
            this.skipRecording = false;
          }, 0);
        }
      );
    }
  }

  undoZoom(): void {
    this.skipRecording = true;
    this.undoRedoService.undoZoom((zoom) => this.editorState.setZoom(zoom));
    setTimeout(() => {
      this.skipRecording = false;
    }, 0);
  }

  redoZoom(): void {
    this.skipRecording = true;
    this.undoRedoService.redoZoom((zoom) => this.editorState.setZoom(zoom));
    setTimeout(() => {
      this.skipRecording = false;
    }, 0);
  }

  private calculateAndSetFitZoom(): void {
    // Get the canvas element
    const canvasElement = window.document.querySelector('.editor-shell__canvas') as HTMLElement;
    if (!canvasElement) {
      this.editorState.setZoom(100);
      return;
    }

    // Get viewport dimensions
    const viewportWidth = canvasElement.clientWidth;
    const viewportHeight = canvasElement.clientHeight;

    if (viewportWidth === 0 || viewportHeight === 0) {
      this.editorState.setZoom(100);
      return;
    }

    // Get active page dimensions
    const subsection = this.editorState.activeSubsection();
    if (!subsection || subsection.pages.length === 0) {
      this.editorState.setZoom(100);
      return;
    }

    const activePage = subsection.pages.find(
      (p) => p.id === this.editorState.activePageId()
    ) || subsection.pages[0];

    if (!activePage) {
      this.editorState.setZoom(100);
      return;
    }

    const doc = this.documentService.document;
    const pageSize = doc.pageSize;
    const orientation = activePage.orientation || 'landscape';
    const { widthMm, heightMm } = pageSize;

    // Get oriented dimensions
    let pageWidthMm = widthMm;
    let pageHeightMm = heightMm;
    if (orientation === 'portrait' && widthMm > heightMm) {
      pageWidthMm = heightMm;
      pageHeightMm = widthMm;
    } else if (orientation === 'landscape' && heightMm > widthMm) {
      pageWidthMm = heightMm;
      pageHeightMm = widthMm;
    }

    // Convert to pixels
    const dpi = pageSize.dpi ?? 96;
    const pageWidthPx = Math.round((pageWidthMm / 25.4) * dpi);
    const pageHeightPx = Math.round((pageHeightMm / 25.4) * dpi);

    if (pageWidthPx === 0 || pageHeightPx === 0) {
      this.editorState.setZoom(100);
      return;
    }

    // Account for padding
    const totalPadding = {
      top: 32 + 32,
      right: 48 + 40,
      bottom: 32 + 32,
      left: 48 + 40,
    };

    // Calculate available space
    const availableWidth = viewportWidth - totalPadding.left - totalPadding.right;
    const availableHeight = viewportHeight - totalPadding.top - totalPadding.bottom;

    if (availableWidth <= 0 || availableHeight <= 0) {
      this.editorState.setZoom(100);
      return;
    }

    // Calculate zoom ratios
    const widthRatio = (availableWidth / pageWidthPx) * 100;
    const heightRatio = (availableHeight / pageHeightPx) * 100;

    // Use the smaller ratio to ensure page fits completely
    const fitZoom = Math.min(widthRatio, heightRatio);

    // Clamp and set zoom
    const clampedZoom = Math.max(10, Math.min(400, Math.round(fitZoom)));
    this.editorState.setZoom(clampedZoom);
  }
}

