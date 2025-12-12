import { Injectable } from '@angular/core';

export interface TableState {
  rows: number;
  columns: number;
  cellData: string[][];
  cellStyles: Record<string, any>;
  mergedCells?: Record<string, { rowspan: number; colspan: number }>;
}

@Injectable({
  providedIn: 'root',
})
export class TableHistoryService {
  private history: TableState[] = [];
  private currentIndex = -1;
  private maxHistorySize = 50;

  saveState(state: TableState): void {
    // Remove any states after current index (when undoing and then making a new change)
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }

    // Deep clone the state
    const clonedState: TableState = {
      rows: state.rows,
      columns: state.columns,
      cellData: state.cellData.map(row => [...row]),
      cellStyles: { ...state.cellStyles },
      mergedCells: state.mergedCells ? { ...state.mergedCells } : undefined,
    };

    this.history.push(clonedState);

    // Limit history size
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    } else {
      this.currentIndex++;
    }
  }

  canUndo(): boolean {
    return this.currentIndex > 0;
  }

  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  undo(): TableState | null {
    if (!this.canUndo()) {
      return null;
    }

    this.currentIndex--;
    return this.getCurrentState();
  }

  redo(): TableState | null {
    if (!this.canRedo()) {
      return null;
    }

    this.currentIndex++;
    return this.getCurrentState();
  }

  getCurrentState(): TableState | null {
    if (this.currentIndex < 0 || this.currentIndex >= this.history.length) {
      return null;
    }

    const state = this.history[this.currentIndex];
    // Return a deep clone
    return {
      rows: state.rows,
      columns: state.columns,
      cellData: state.cellData.map(row => [...row]),
      cellStyles: { ...state.cellStyles },
      mergedCells: state.mergedCells ? { ...state.mergedCells } : undefined,
    };
  }

  clear(): void {
    this.history = [];
    this.currentIndex = -1;
  }
}

