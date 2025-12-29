import {
  ChangeDetectionStrategy,
  Component,
  inject,
  HostListener,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { UndoRedoService } from '../../../../../core/services/undo-redo.service';
import { UIStateService } from '../../../../../core/services/ui-state.service';
import { PendingChangesRegistry } from '../../../../../core/services/pending-changes-registry.service';
import { TableToolbarService } from '../../../../../core/services/table-toolbar.service';
import { RichTextToolbarService } from '../../../../../core/services/rich-text-editor/rich-text-toolbar.service';

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
export class UndoRedoControlsComponent implements OnInit, OnDestroy {
  private readonly undoRedoService = inject(UndoRedoService);
  private readonly uiState = inject(UIStateService);
  private readonly pendingChanges = inject(PendingChangesRegistry);
  private readonly tableToolbar = inject(TableToolbarService);
  private readonly richTextToolbar = inject(RichTextToolbarService);

  // Capture-phase handler to override native contenteditable undo/redo for table cells.
  // This prevents the browser's per-element undo stack from desyncing the document-level history.
  private readonly handleUndoRedoCapture = (event: KeyboardEvent): void => {
    const key = event.key?.toLowerCase?.() ?? '';
    if (!(event.ctrlKey || event.metaKey)) return;
    if (event.altKey) return;
    if (key !== 'z' && key !== 'y') return;

    const editingWidgetId = this.uiState.editingWidgetId();
    // Only handle table-cell editing here.
    if (!editingWidgetId || this.tableToolbar.activeTableWidgetId !== editingWidgetId || !this.tableToolbar.activeCell) {
      return;
    }

    const target = event.target as HTMLElement | null;
    if (!target) return;
    const inCellEditor = !!target.closest('.table-widget__cell-editor');
    const containerId = (target.closest('.widget-container[data-widget-id]') as HTMLElement | null)?.getAttribute('data-widget-id') ?? null;

    // Only intercept when the keypress originates inside the active table widget container.
    // (When focus is elsewhere, allow the normal/global handler to run.)
    if (containerId !== editingWidgetId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const isRedo = key === 'y' || (key === 'z' && event.shiftKey);
    if (isRedo) {
      if (!this.documentCanRedo()) return;
      document.dispatchEvent(new CustomEvent('tw-table-pre-doc-redo', { detail: { widgetId: editingWidgetId } }));
      this.undoRedoService.redoDocument();
      return;
    }

    if (!this.documentCanUndo()) return;
    document.dispatchEvent(new CustomEvent('tw-table-pre-doc-undo', { detail: { widgetId: editingWidgetId } }));
    this.undoRedoService.undoDocument();
  };

  ngOnInit(): void {
    window.addEventListener('keydown', this.handleUndoRedoCapture, { capture: true });
  }

  ngOnDestroy(): void {
    window.removeEventListener('keydown', this.handleUndoRedoCapture, true);
  }

  // Signals automatically trigger change detection when used in templates
  readonly documentCanUndo = this.undoRedoService.documentCanUndo;
  readonly documentCanRedo = this.undoRedoService.documentCanRedo;

  @HostListener('window:keydown', ['$event'])
  handleKeyboard(event: KeyboardEvent): void {
    const normalizedKey = event.key?.toLowerCase?.() ?? '';
    const isShortcutKey = normalizedKey === 'z' || normalizedKey === 'y';
    const shouldHandle = this.shouldHandleGlobalShortcut(event);

    // Don't steal Ctrl+Z / Ctrl+Y from inline editors (CKEditor, contenteditable table cells, inputs, etc).
    // Those editors usually have their own internal undo stacks that should be used while focused.
    if (!shouldHandle) {
      return;
    }

    if (event.ctrlKey || event.metaKey) {
      if (normalizedKey === 'z' && !event.shiftKey) {
        event.preventDefault();
        void this.undo();
      } else if (normalizedKey === 'y' || (normalizedKey === 'z' && event.shiftKey)) {
        event.preventDefault();
        void this.redo();
      }
    }
  }

  async undo(): Promise<void> {
    const editingWidgetId = this.uiState.editingWidgetId();

    // While editing a table cell, use DOCUMENT undo (so it can undo across multiple cells)
    // but keep edit mode by telling the table widget to allow a one-off store sync while focused.
    if (editingWidgetId && this.tableToolbar.activeTableWidgetId === editingWidgetId && this.tableToolbar.activeCell) {
      if (this.documentCanUndo()) {
        document.dispatchEvent(new CustomEvent('tw-table-pre-doc-undo', { detail: { widgetId: editingWidgetId } }));
        this.undoRedoService.undoDocument();
      }
      return;
    }

    // While editing a text widget (CKEditor), do document undo but allow the widget to temporarily
    // apply the store update even though it's actively editing (focus-preserving sync).
    if (editingWidgetId && this.richTextToolbar.activeEditor) {
      if (this.documentCanUndo()) {
        document.dispatchEvent(new CustomEvent('tw-text-pre-doc-undo', { detail: { widgetId: editingWidgetId } }));
        this.undoRedoService.undoDocument();
      }
      return;
    }

    // Ensure delayed-edit widgets (table/text) commit their changes before we snapshot/undo.
    await this.pendingChanges.flushAll();

    if (this.documentCanUndo()) {
      this.undoRedoService.undoDocument();
    }
  }

  async redo(): Promise<void> {
    const editingWidgetId = this.uiState.editingWidgetId();
    if (editingWidgetId && this.tableToolbar.activeTableWidgetId === editingWidgetId && this.tableToolbar.activeCell) {
      if (this.documentCanRedo()) {
        document.dispatchEvent(new CustomEvent('tw-table-pre-doc-redo', { detail: { widgetId: editingWidgetId } }));
        this.undoRedoService.redoDocument();
      }
      return;
    }

    if (editingWidgetId && this.richTextToolbar.activeEditor) {
      if (this.documentCanRedo()) {
        document.dispatchEvent(new CustomEvent('tw-text-pre-doc-redo', { detail: { widgetId: editingWidgetId } }));
        this.undoRedoService.redoDocument();
      }
      return;
    }

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
