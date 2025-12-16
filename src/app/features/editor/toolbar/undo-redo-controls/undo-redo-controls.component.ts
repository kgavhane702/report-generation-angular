import {
  ChangeDetectionStrategy,
  Component,
  inject,
  HostListener,
} from '@angular/core';
import { UndoRedoService } from '../../../../core/services/undo-redo.service';

/**
 * UndoRedoControlsComponent
 * 
 * REFACTORED: Removed effect() + markForCheck() pattern.
 * Signals automatically trigger change detection when used in templates.
 */
@Component({
  selector: 'app-undo-redo-controls',
  templateUrl: './undo-redo-controls.component.html',
  styleUrls: ['./undo-redo-controls.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UndoRedoControlsComponent {
  private readonly undoRedoService = inject(UndoRedoService);

  // Signals automatically trigger change detection when used in templates
  readonly documentCanUndo = this.undoRedoService.documentCanUndo;
  readonly documentCanRedo = this.undoRedoService.documentCanRedo;

  @HostListener('window:keydown', ['$event'])
  handleKeyboard(event: KeyboardEvent): void {
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
