import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';
import { EditorStateService } from '../../../../../core/services/editor-state.service';
import { UndoRedoService } from '../../../../../core/services/undo-redo.service';
import { DocumentService } from '../../../../../core/services/document.service';
import { getOrientedPageSizeMm, mmToPx } from '../../../../../core/utils/page-dimensions.util';

/**
 * ZoomControlsComponent
 * 
 * REFACTORED: Removed effect() + markForCheck() pattern.
 * Signals automatically trigger change detection when used in templates.
 */
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

  // Signals automatically trigger change detection
  readonly zoom = this.editorState.zoom;
  readonly canUndo = this.undoRedoService.zoomCanUndo;
  readonly canRedo = this.undoRedoService.zoomCanRedo;

  private skipRecording = false;

  onZoomChange(value: number): void {
    if (this.skipRecording) {
      return;
    }
    const oldZoom = this.zoom();
    this.editorState.setZoom(value);
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
    const canvasElement = window.document.querySelector('.editor-shell__canvas') as HTMLElement;
    if (!canvasElement) {
      this.editorState.setZoom(100);
      return;
    }

    const viewportWidth = canvasElement.clientWidth;
    const viewportHeight = canvasElement.clientHeight;

    if (viewportWidth === 0 || viewportHeight === 0) {
      this.editorState.setZoom(100);
      return;
    }

    const activePage = this.editorState.activePage();
    if (!activePage) {
      this.editorState.setZoom(100);
      return;
    }

    const pageSize = this.editorState.pageSize();
    const orientation = activePage.orientation || 'landscape';
    const { widthMm: pageWidthMm, heightMm: pageHeightMm } = getOrientedPageSizeMm(pageSize, orientation);

    const dpi = pageSize.dpi ?? 96;
    const pageWidthPx = mmToPx(pageWidthMm, dpi);
    const pageHeightPx = mmToPx(pageHeightMm, dpi);

    if (pageWidthPx === 0 || pageHeightPx === 0) {
      this.editorState.setZoom(100);
      return;
    }

    const totalPadding = {
      top: 32 + 32,
      right: 48 + 40,
      bottom: 32 + 32,
      left: 48 + 40,
    };

    const availableWidth = viewportWidth - totalPadding.left - totalPadding.right;
    const availableHeight = viewportHeight - totalPadding.top - totalPadding.bottom;

    if (availableWidth <= 0 || availableHeight <= 0) {
      this.editorState.setZoom(100);
      return;
    }

    const widthRatio = (availableWidth / pageWidthPx) * 100;
    const heightRatio = (availableHeight / pageHeightPx) * 100;

    const fitZoom = Math.min(widthRatio, heightRatio);
    const clampedZoom = Math.max(10, Math.min(400, Math.round(fitZoom)));
    this.editorState.setZoom(clampedZoom);
  }
}
