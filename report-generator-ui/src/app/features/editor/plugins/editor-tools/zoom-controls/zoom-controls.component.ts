import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';
import { EditorStateService } from '../../../../../core/services/editor-state.service';
import { UndoRedoService } from '../../../../../core/services/undo-redo.service';
import { DocumentService } from '../../../../../core/services/document.service';

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
    this.editorState.fitToWindow();
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

}
