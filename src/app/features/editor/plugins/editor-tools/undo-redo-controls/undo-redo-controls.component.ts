import {
  ChangeDetectionStrategy,
  Component,
  inject,
  HostListener,
} from '@angular/core';
import { UndoRedoService } from '../../../../../core/services/undo-redo.service';
import { UIStateService } from '../../../../../core/services/ui-state.service';
import { PendingChangesRegistry } from '../../../../../core/services/pending-changes-registry.service';

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
  private readonly uiState = inject(UIStateService);
  private readonly pendingChanges = inject(PendingChangesRegistry);

  // Signals automatically trigger change detection when used in templates
  readonly documentCanUndo = this.undoRedoService.documentCanUndo;
  readonly documentCanRedo = this.undoRedoService.documentCanRedo;

  @HostListener('window:keydown', ['$event'])
  handleKeyboard(event: KeyboardEvent): void {
    // Don't steal Ctrl+Z / Ctrl+Y from inline editors (CKEditor, contenteditable table cells, inputs, etc).
    // Those editors usually have their own internal undo stacks that should be used while focused.
    if (!this.shouldHandleGlobalShortcut(event)) {
      return;
    }

    if (event.ctrlKey || event.metaKey) {
      if (event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        void this.undo();
      } else if (event.key === 'y' || (event.key === 'z' && event.shiftKey)) {
        event.preventDefault();
        void this.redo();
      }
    }
  }

  async undo(): Promise<void> {
    // Ensure delayed-edit widgets (table/text) commit their changes before we snapshot/undo.
    await this.pendingChanges.flushAll();
    if (this.documentCanUndo()) {
      this.undoRedoService.undoDocument();
    }
  }

  async redo(): Promise<void> {
    await this.pendingChanges.flushAll();
    if (this.documentCanRedo()) {
      this.undoRedoService.redoDocument();
    }
  }

  private shouldHandleGlobalShortcut(event: KeyboardEvent): boolean {
    // If the editor UI state says we're editing a widget, let that widget handle shortcuts.
    if (this.uiState.editingWidgetId() !== null) {
      return false;
    }

    const target = event.target as HTMLElement | null;
    if (!target) return true;

    // Standard form controls should keep native undo/redo semantics.
    const tag = target.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      return false;
    }

    // Any contenteditable region (CKEditor, table cells, etc.) should own its own undo stack.
    if (target.isContentEditable || target.closest('[contenteditable="true"]')) {
      return false;
    }

    return true;
  }
}
