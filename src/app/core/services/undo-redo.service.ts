import { Injectable, signal, computed } from '@angular/core';
import { DocumentModel } from '../../models/document.model';

/**
 * Command interface for undo/redo operations
 */
export interface Command {
  execute(): void;
  undo(): void;
  description?: string;
}

/**
 * Undo/Redo service using command pattern
 * Maintains separate history stacks for document and zoom operations
 */
@Injectable({
  providedIn: 'root',
})
export class UndoRedoService {
  // Document history stacks
  private readonly documentUndoStack: Command[] = [];
  private readonly documentRedoStack: Command[] = [];
  private readonly maxHistorySize = 50;

  // Zoom history stacks
  private readonly zoomUndoStack: number[] = [];
  private readonly zoomRedoStack: number[] = [];
  private currentZoom: number = 100;

  // Signals for UI state
  private readonly canUndoDocument = signal<boolean>(false);
  private readonly canRedoDocument = signal<boolean>(false);
  private readonly canUndoZoom = signal<boolean>(false);
  private readonly canRedoZoom = signal<boolean>(false);

  readonly documentCanUndo = this.canUndoDocument.asReadonly();
  readonly documentCanRedo = this.canRedoDocument.asReadonly();
  readonly zoomCanUndo = this.canUndoZoom.asReadonly();
  readonly zoomCanRedo = this.canRedoZoom.asReadonly();

  /**
   * Execute a document command and add it to undo stack
   */
  executeDocumentCommand(command: Command): void {
    command.execute();
    this.documentUndoStack.push(command);
    this.documentRedoStack.length = 0; // Clear redo stack when new action is performed
    this.updateDocumentState();
  }

  /**
   * Undo last document command
   */
  undoDocument(): void {
    const command = this.documentUndoStack.pop();
    if (command) {
      command.undo();
      this.documentRedoStack.push(command);
      this.updateDocumentState();
    }
  }

  /**
   * Redo last undone document command
   */
  redoDocument(): void {
    const command = this.documentRedoStack.pop();
    if (command) {
      command.execute();
      this.documentUndoStack.push(command);
      this.updateDocumentState();
    }
  }

  /**
   * Record zoom change for undo/redo
   */
  recordZoomChange(oldZoom: number, newZoom: number, setZoomFn: (zoom: number) => void): void {
    // Only record if zoom actually changed
    if (oldZoom === newZoom) {
      return;
    }

    // Simple approach: just store the previous zoom value
    this.zoomUndoStack.push(oldZoom);
    this.zoomRedoStack.length = 0; // Clear redo stack
    this.currentZoom = newZoom;
    this.updateZoomState();
  }

  /**
   * Undo last zoom change
   */
  undoZoom(setZoomFn: (zoom: number) => void): void {
    const previousZoom = this.zoomUndoStack.pop();
    if (previousZoom !== undefined) {
      this.zoomRedoStack.push(this.currentZoom);
      this.currentZoom = previousZoom;
      setZoomFn(previousZoom);
      this.updateZoomState();
    }
  }

  /**
   * Redo last undone zoom change
   */
  redoZoom(setZoomFn: (zoom: number) => void): void {
    const nextZoom = this.zoomRedoStack.pop();
    if (nextZoom !== undefined) {
      this.zoomUndoStack.push(this.currentZoom);
      this.currentZoom = nextZoom;
      setZoomFn(nextZoom);
      this.updateZoomState();
    }
  }

  /**
   * Clear all history
   */
  clearHistory(): void {
    this.documentUndoStack.length = 0;
    this.documentRedoStack.length = 0;
    this.zoomUndoStack.length = 0;
    this.zoomRedoStack.length = 0;
    this.updateDocumentState();
    this.updateZoomState();
  }

  /**
   * Get current zoom for history tracking
   */
  getCurrentZoom(): number {
    return this.currentZoom;
  }

  private updateDocumentState(): void {
    // Limit history size
    if (this.documentUndoStack.length > this.maxHistorySize) {
      this.documentUndoStack.shift();
    }

    this.canUndoDocument.set(this.documentUndoStack.length > 0);
    this.canRedoDocument.set(this.documentRedoStack.length > 0);
  }

  private updateZoomState(): void {
    // Limit zoom history size
    if (this.zoomUndoStack.length > 20) {
      this.zoomUndoStack.shift();
    }

    this.canUndoZoom.set(this.zoomUndoStack.length > 0);
    this.canRedoZoom.set(this.zoomRedoStack.length > 0);
  }
}

