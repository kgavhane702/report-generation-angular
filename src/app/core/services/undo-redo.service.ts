import { Injectable, signal, computed } from '@angular/core';
import { DocumentModel } from '../../models/document.model';

export interface Command {
  execute(): void;
  undo(): void;
  description?: string;
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

