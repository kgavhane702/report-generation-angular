import { Injectable, signal, computed } from '@angular/core';
import { DocumentModel } from '../../models/document.model';
import type { WidgetModel } from '../../models/widget.model';

export interface Command {
  execute(): void;
  undo(): void;
  description?: string;
}

export interface MergeableCommand extends Command {
  canMerge(next: Command): boolean;
  merge(next: Command): void;
}

@Injectable({
  providedIn: 'root',
})
export class UndoRedoService {
  private readonly documentUndoStack: Command[] = [];
  private readonly documentRedoStack: Command[] = [];
  private readonly maxHistorySize = 50;
  private readonly zoomUndoStack: number[] = [];
  private readonly zoomRedoStack: number[] = [];
  private currentZoom: number = 100;
  private readonly canUndoDocument = signal<boolean>(false);
  private readonly canRedoDocument = signal<boolean>(false);
  private readonly canUndoZoom = signal<boolean>(false);
  private readonly canRedoZoom = signal<boolean>(false);

  readonly documentCanUndo = this.canUndoDocument.asReadonly();
  readonly documentCanRedo = this.canRedoDocument.asReadonly();
  readonly zoomCanUndo = this.canUndoZoom.asReadonly();
  readonly zoomCanRedo = this.canRedoZoom.asReadonly();

  executeDocumentCommand(command: Command): void {
    const last = this.documentUndoStack[this.documentUndoStack.length - 1];
    const isMergeable = (c: Command): c is MergeableCommand =>
      typeof (c as MergeableCommand).canMerge === 'function' &&
      typeof (c as MergeableCommand).merge === 'function';

    if (last && isMergeable(last) && last.canMerge(command)) {
      // Coalesce rapid successive commands into a single undo step (e.g., typing bursts).
      last.merge(command);
      last.execute();
      this.documentRedoStack.length = 0;
      this.updateDocumentState();
      return;
    }

    command.execute();
    this.documentUndoStack.push(command);
    this.documentRedoStack.length = 0;
    this.updateDocumentState();
  }

  undoDocument(): void {
    const command = this.documentUndoStack.pop();
    if (command) {
      command.undo();
      this.documentRedoStack.push(command);
      this.updateDocumentState();
    }
  }

  redoDocument(): void {
    const command = this.documentRedoStack.pop();
    if (command) {
      command.execute();
      this.documentUndoStack.push(command);
      this.updateDocumentState();
    }
  }

  recordZoomChange(oldZoom: number, newZoom: number, setZoomFn: (zoom: number) => void): void {
    if (oldZoom === newZoom) {
      return;
    }

    this.zoomUndoStack.push(oldZoom);
    this.zoomRedoStack.length = 0;
    this.currentZoom = newZoom;
    this.updateZoomState();
  }

  undoZoom(setZoomFn: (zoom: number) => void): void {
    const previousZoom = this.zoomUndoStack.pop();
    if (previousZoom !== undefined) {
      this.zoomRedoStack.push(this.currentZoom);
      this.currentZoom = previousZoom;
      setZoomFn(previousZoom);
      this.updateZoomState();
    }
  }

  redoZoom(setZoomFn: (zoom: number) => void): void {
    const nextZoom = this.zoomRedoStack.pop();
    if (nextZoom !== undefined) {
      this.zoomUndoStack.push(this.currentZoom);
      this.currentZoom = nextZoom;
      setZoomFn(nextZoom);
      this.updateZoomState();
    }
  }

  clearHistory(): void {
    this.documentUndoStack.length = 0;
    this.documentRedoStack.length = 0;
    this.zoomUndoStack.length = 0;
    this.zoomRedoStack.length = 0;
    this.updateDocumentState();
    this.updateZoomState();
  }

  /**
   * Update the stored redo snapshot for the most recent "add widget" command for the given widget.
   *
   * Why:
   * - Some widget flows (table import / URL auto-load) are async and apply their final props after the widget
   *   is created. We want undo/redo to treat that as a single atomic operation: undo removes the widget,
   *   redo re-adds the FINAL widget (not a stale loading placeholder).
   *
   * This does NOT create a new history entry; it mutates the existing command snapshot only.
   */
  updateLastAddWidgetSnapshot(widgetId: string, widgetSnapshot: WidgetModel): boolean {
    if (!widgetId) return false;

    const tryUpdate = (stack: Command[]): boolean => {
      for (let i = stack.length - 1; i >= 0; i--) {
        const cmd = stack[i] as any;
        if (!cmd) continue;
        if (cmd.kind !== 'add-widget') continue;
        if (cmd.widgetId !== widgetId) continue;
        if (typeof cmd.updateWidgetSnapshot !== 'function') continue;
        cmd.updateWidgetSnapshot(widgetSnapshot);
        return true;
      }
      return false;
    };

    const updatedUndo = tryUpdate(this.documentUndoStack);
    const updatedRedo = tryUpdate(this.documentRedoStack);
    return updatedUndo || updatedRedo;
  }

  /**
   * Remove the most recent "add widget" command for a widget.
   *
   * Used to rollback failed async widget insert flows (e.g. table import placeholder) so we don't leave
   * a dangling undo step for an action that effectively didn't complete.
   */
  dropLastAddWidgetCommand(widgetId: string): boolean {
    const last = this.documentUndoStack[this.documentUndoStack.length - 1] as any;
    if (!last) return false;
    if (last.kind !== 'add-widget') return false;
    if (last.widgetId !== widgetId) return false;

    this.documentUndoStack.pop();
    this.updateDocumentState();
    return true;
  }

  getCurrentZoom(): number {
    return this.currentZoom;
  }

  private updateDocumentState(): void {
    if (this.documentUndoStack.length > this.maxHistorySize) {
      this.documentUndoStack.shift();
    }

    this.canUndoDocument.set(this.documentUndoStack.length > 0);
    this.canRedoDocument.set(this.documentRedoStack.length > 0);
  }

  private updateZoomState(): void {
    if (this.zoomUndoStack.length > 20) {
      this.zoomUndoStack.shift();
    }

    this.canUndoZoom.set(this.zoomUndoStack.length > 0);
    this.canRedoZoom.set(this.zoomRedoStack.length > 0);
  }
}

