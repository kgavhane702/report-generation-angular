import {
  ChangeDetectionStrategy,
  Component,
  inject,
  HostListener,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { UndoRedoService } from '../../../../../core/services/undo-redo.service';
import { UIStateService } from '../../../../../core/services/ui-state.service';
import { PendingChangesRegistry } from '../../../../../core/services/pending-changes-registry.service';
import { TableToolbarService } from '../../../../../core/services/table-toolbar.service';
import { RichTextToolbarService } from '../../../../../core/services/rich-text-editor/rich-text-toolbar.service';
import { EditorStateService } from '../../../../../core/services/editor-state.service';
import { AppState } from '../../../../../store/app.state';
import { DocumentSelectors } from '../../../../../store/document/document.selectors';

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
  private readonly store = inject(Store<AppState>);
  private readonly undoRedoService = inject(UndoRedoService);
  private readonly uiState = inject(UIStateService);
  private readonly pendingChanges = inject(PendingChangesRegistry);
  private readonly tableToolbar = inject(TableToolbarService);
  private readonly richTextToolbar = inject(RichTextToolbarService);
  private readonly editorState = inject(EditorStateService);

  readonly documentLocked = toSignal(
    this.store.select(DocumentSelectors.selectDocumentLocked),
    { initialValue: false }
  );

  // Capture-phase handler to override native contenteditable undo/redo for table cells.
  // This prevents the browser's per-element undo stack from desyncing the document-level history.
  private readonly handleUndoRedoCapture = (event: KeyboardEvent): void => {
    if (this.documentLocked()) return;
    const key = event.key?.toLowerCase?.() ?? '';
    if (!(event.ctrlKey || event.metaKey)) return;
    if (event.altKey) return;
    if (key !== 'z' && key !== 'y') return;

    const editingWidgetId = this.uiState.editingWidgetId();
    const target = event.target as HTMLElement | null;
    const containerId =
      (target?.closest('.widget-container[data-widget-id]') as HTMLElement | null)?.getAttribute('data-widget-id') ?? null;

    const activeCkEditableEl = this.richTextToolbar.activeEditor?.ui.getEditableElement() as HTMLElement | null;
    const inActiveCkEditable = !!(activeCkEditableEl && target && activeCkEditableEl.contains(target));
    const inCkToolbar = !!(this.richTextToolbar.activeToolbar && target && this.richTextToolbar.activeToolbar.contains(target));

    // CKEditor: override native editor undo/redo and route to DOCUMENT undo/redo to keep global history synced.
    // Scope: only when the keypress originates in the active editor's editable/toolbar AND the widget container matches UIState's editing widget.
    if (
      editingWidgetId &&
      containerId === editingWidgetId &&
      this.richTextToolbar.activeEditor &&
      (inActiveCkEditable || inCkToolbar)
    ) {
      event.preventDefault();
      event.stopPropagation();

      const isRedo = key === 'y' || (key === 'z' && event.shiftKey);
      if (isRedo) {
        if (!this.documentCanRedo()) return;
        document.dispatchEvent(new CustomEvent('tw-text-pre-doc-redo', { detail: { widgetId: editingWidgetId } }));
        const affectedPageId = this.undoRedoService.redoDocument();
        this.navigateToAffectedPage(affectedPageId);

        return;
      }

      if (!this.documentCanUndo()) return;
      document.dispatchEvent(new CustomEvent('tw-text-pre-doc-undo', { detail: { widgetId: editingWidgetId } }));
      const affectedPageId = this.undoRedoService.undoDocument();
      this.navigateToAffectedPage(affectedPageId);

      return;
    }

    // Only handle table-cell editing here.
    if (!editingWidgetId || this.tableToolbar.activeTableWidgetId !== editingWidgetId || !this.tableToolbar.activeCell) {
      return;
    }
    if (!target) return;

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
      const affectedPageId = this.undoRedoService.redoDocument();
      this.navigateToAffectedPage(affectedPageId);
      return;
    }

    if (!this.documentCanUndo()) return;
    document.dispatchEvent(new CustomEvent('tw-table-pre-doc-undo', { detail: { widgetId: editingWidgetId } }));
    const affectedPageId = this.undoRedoService.undoDocument();
    this.navigateToAffectedPage(affectedPageId);
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
    if (this.documentLocked()) return;
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
    if (this.documentLocked()) return;
    const editingWidgetId = this.uiState.editingWidgetId();

    // While editing a table cell, use DOCUMENT undo (so it can undo across multiple cells)
    // but keep edit mode by telling the table widget to allow a one-off store sync while focused.
    if (editingWidgetId && this.tableToolbar.activeTableWidgetId === editingWidgetId && this.tableToolbar.activeCell) {
      if (this.documentCanUndo()) {
        document.dispatchEvent(new CustomEvent('tw-table-pre-doc-undo', { detail: { widgetId: editingWidgetId } }));
        const affectedPageId = this.undoRedoService.undoDocument();
        this.navigateToAffectedPage(affectedPageId);
      }
      return;
    }

    // While editing a text widget (CKEditor), do document undo but allow the widget to temporarily
    // apply the store update even though it's actively editing (focus-preserving sync).
    if (editingWidgetId && this.richTextToolbar.activeEditor) {
      if (this.documentCanUndo()) {
        document.dispatchEvent(new CustomEvent('tw-text-pre-doc-undo', { detail: { widgetId: editingWidgetId } }));
        const affectedPageId = this.undoRedoService.undoDocument();
        this.navigateToAffectedPage(affectedPageId);
      }
      return;
    }

    // Ensure delayed-edit widgets (table/text) commit their changes before we snapshot/undo.
    await this.pendingChanges.flushAll();

    if (this.documentCanUndo()) {
      const affectedPageId = this.undoRedoService.undoDocument();
      this.navigateToAffectedPage(affectedPageId);
    }
  }

  async redo(): Promise<void> {
    if (this.documentLocked()) return;
    const editingWidgetId = this.uiState.editingWidgetId();
    if (editingWidgetId && this.tableToolbar.activeTableWidgetId === editingWidgetId && this.tableToolbar.activeCell) {
      if (this.documentCanRedo()) {
        document.dispatchEvent(new CustomEvent('tw-table-pre-doc-redo', { detail: { widgetId: editingWidgetId } }));
        const affectedPageId = this.undoRedoService.redoDocument();
        this.navigateToAffectedPage(affectedPageId);
      }
      return;
    }

    if (editingWidgetId && this.richTextToolbar.activeEditor) {
      if (this.documentCanRedo()) {
        document.dispatchEvent(new CustomEvent('tw-text-pre-doc-redo', { detail: { widgetId: editingWidgetId } }));
        const affectedPageId = this.undoRedoService.redoDocument();
        this.navigateToAffectedPage(affectedPageId);
      }
      return;
    }

    await this.pendingChanges.flushAll();
    if (this.documentCanRedo()) {
      const affectedPageId = this.undoRedoService.redoDocument();
      this.navigateToAffectedPage(affectedPageId);
    }
  }

  /**
   * Navigate to the page affected by an undo/redo operation.
   * Only navigates if the affected page is different from the current page.
   */
  private navigateToAffectedPage(pageId: string | null): void {
    if (!pageId) return;
    const currentPageId = this.editorState.activePageId();
    if (pageId !== currentPageId) {
      this.editorState.setActivePage(pageId);
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
