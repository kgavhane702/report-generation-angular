import { Injectable, signal } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface TableFormattingState {
  isBold: boolean;
  isItalic: boolean;
  textAlign: 'left' | 'center' | 'right';
  verticalAlign: 'top' | 'middle' | 'bottom';
}

/**
 * Service to manage the active table cell and formatting state for table widgets.
 * Similar to RichTextToolbarService but for table cells with contenteditable.
 */
@Injectable({
  providedIn: 'root',
})
export class TableToolbarService {
  private readonly activeCellSubject = new BehaviorSubject<HTMLElement | null>(null);
  private readonly activeTableWidgetIdSubject = new BehaviorSubject<string | null>(null);
  private readonly selectedCellsSubject = new BehaviorSubject<Set<string>>(new Set());
  
  public readonly activeCell$: Observable<HTMLElement | null> = this.activeCellSubject.asObservable();
  public readonly activeTableWidgetId$: Observable<string | null> = this.activeTableWidgetIdSubject.asObservable();
  
  /** Signal for current formatting state */
  readonly formattingState = signal<TableFormattingState>({
    isBold: false,
    isItalic: false,
    textAlign: 'left',
    verticalAlign: 'top',
  });

  /** Callback to get selected cell elements */
  private getSelectedCellElements: (() => HTMLElement[]) | null = null;

  get activeCell(): HTMLElement | null {
    return this.activeCellSubject.value;
  }

  get activeTableWidgetId(): string | null {
    return this.activeTableWidgetIdSubject.value;
  }

  get selectedCells(): Set<string> {
    return this.selectedCellsSubject.value;
  }

  /**
   * Register callback to get selected cell elements
   */
  setSelectedCellsGetter(getter: (() => HTMLElement[]) | null): void {
    this.getSelectedCellElements = getter;
  }

  /**
   * Update selected cells
   */
  setSelectedCells(cells: Set<string>): void {
    this.selectedCellsSubject.next(cells);
  }

  /**
   * Register a cell as the active one for formatting
   */
  setActiveCell(cell: HTMLElement | null, widgetId: string | null): void {
    this.activeCellSubject.next(cell);
    this.activeTableWidgetIdSubject.next(widgetId);
    
    if (cell) {
      this.updateFormattingState();
    }
  }

  /**
   * Apply bold formatting to current selection
   */
  applyBold(): void {
    if (!this.activeCell) return;
    document.execCommand('bold', false);
    this.updateFormattingState();
  }

  /**
   * Apply italic formatting to current selection
   */
  applyItalic(): void {
    if (!this.activeCell) return;
    document.execCommand('italic', false);
    this.updateFormattingState();
  }

  /**
   * Apply text alignment to selected cells or active cell
   */
  applyTextAlign(align: 'left' | 'center' | 'right'): void {
    const cells = this.getSelectedCellElements?.() ?? [];
    if (cells.length > 0) {
      cells.forEach(cell => {
        cell.style.textAlign = align;
      });
    } else if (this.activeCell) {
      this.activeCell.style.textAlign = align;
    }
    this.formattingState.update(state => ({ ...state, textAlign: align }));
  }

  /**
   * Apply vertical alignment to selected cells or active cell
   */
  applyVerticalAlign(align: 'top' | 'middle' | 'bottom'): void {
    const cells = this.getSelectedCellElements?.() ?? [];
    if (cells.length > 0) {
      cells.forEach(cell => {
        cell.style.verticalAlign = align;
      });
    } else if (this.activeCell) {
      this.activeCell.style.verticalAlign = align;
    }
    this.formattingState.update(state => ({ ...state, verticalAlign: align }));
  }

  /**
   * Update formatting state based on current selection
   */
  updateFormattingState(): void {
    const cell = this.activeCell;
    if (!cell) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const isBold = document.queryCommandState('bold');
    const isItalic = document.queryCommandState('italic');
    
    const computedStyle = window.getComputedStyle(cell);
    const textAlign = (computedStyle.textAlign || 'left') as 'left' | 'center' | 'right';
    const verticalAlign = (computedStyle.verticalAlign || 'top') as 'top' | 'middle' | 'bottom';

    this.formattingState.set({
      isBold,
      isItalic,
      textAlign,
      verticalAlign,
    });
  }

  /**
   * Clear active cell when table widget loses focus
   */
  clearActiveCell(): void {
    this.activeCellSubject.next(null);
    this.activeTableWidgetIdSubject.next(null);
  }
}

