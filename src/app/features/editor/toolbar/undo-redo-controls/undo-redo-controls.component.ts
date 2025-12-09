import {
  ChangeDetectionStrategy,
  Component,
  inject,
  ChangeDetectorRef,
  effect,
  HostListener,
} from '@angular/core';
import { UndoRedoService } from '../../../../core/services/undo-redo.service';
import { DocumentService } from '../../../../core/services/document.service';

@Component({
  selector: 'app-undo-redo-controls',
  templateUrl: './undo-redo-controls.component.html',
  styleUrls: ['./undo-redo-controls.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UndoRedoControlsComponent {
  private readonly undoRedoService = inject(UndoRedoService);
  private readonly documentService = inject(DocumentService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly documentCanUndo = this.undoRedoService.documentCanUndo;
  readonly documentCanRedo = this.undoRedoService.documentCanRedo;

  constructor() {
    // Trigger change detection when undo/redo state changes
    effect(() => {
      this.undoRedoService.documentCanUndo();
      this.undoRedoService.documentCanRedo();
      this.cdr.markForCheck();
    });
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboard(event: KeyboardEvent): void {
    // Handle Ctrl+Z (undo) and Ctrl+Y or Ctrl+Shift+Z (redo)
    if (event.ctrlKey || event.metaKey) {
      if (event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        this.undo();
      } else if (event.key === 'y' || (event.key === 'z' && event.shiftKey)) {
        event.preventDefault();
        this.redo();
      }
    }
  }

  undo(): void {
    if (this.documentCanUndo()) {
      this.undoRedoService.undoDocument();
    }
  }

  redo(): void {
    if (this.documentCanRedo()) {
      this.undoRedoService.redoDocument();
    }
  }
}

