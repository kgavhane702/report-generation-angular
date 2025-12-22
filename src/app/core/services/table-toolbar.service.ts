import { Injectable, signal } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Subject } from 'rxjs';
import { TableCellStyle } from '../../models/widget.model';

export interface TableFormattingState {
  isBold: boolean;
  isItalic: boolean;
  textAlign: 'left' | 'center' | 'right';
  verticalAlign: 'top' | 'middle' | 'bottom';
  fontFamily: string;
  fontSizePx: number | null;
}

export interface SplitCellRequest {
  rows: number;
  cols: number;
}

export interface CellBorderRequest {
  color: string | null;
  width: number | null;
  style: 'solid' | 'dashed' | 'dotted' | 'none' | null;
}

export interface TableInsertRequest {
  axis: 'row' | 'col';
  placement: 'before' | 'after';
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
  private readonly splitCellRequestedSubject = new Subject<SplitCellRequest>();
  private readonly mergeCellsRequestedSubject = new Subject<void>();
  private readonly unmergeRequestedSubject = new Subject<void>();
  private readonly textAlignRequestedSubject = new Subject<'left' | 'center' | 'right'>();
  private readonly verticalAlignRequestedSubject = new Subject<'top' | 'middle' | 'bottom'>();
  private readonly cellBackgroundColorRequestedSubject = new Subject<string>();
  private readonly cellBorderRequestedSubject = new Subject<CellBorderRequest>();
  private readonly fontFamilyRequestedSubject = new Subject<string>();
  private readonly fontSizeRequestedSubject = new Subject<number | null>();
  private readonly insertRequestedSubject = new Subject<TableInsertRequest>();
  private readonly formatPainterRequestedSubject = new Subject<boolean>();
  
  public readonly activeCell$: Observable<HTMLElement | null> = this.activeCellSubject.asObservable();
  public readonly activeTableWidgetId$: Observable<string | null> = this.activeTableWidgetIdSubject.asObservable();
  public readonly splitCellRequested$: Observable<SplitCellRequest> = this.splitCellRequestedSubject.asObservable();
  public readonly mergeCellsRequested$: Observable<void> = this.mergeCellsRequestedSubject.asObservable();
  public readonly unmergeRequested$: Observable<void> = this.unmergeRequestedSubject.asObservable();
  public readonly textAlignRequested$: Observable<'left' | 'center' | 'right'> = this.textAlignRequestedSubject.asObservable();
  public readonly verticalAlignRequested$: Observable<'top' | 'middle' | 'bottom'> = this.verticalAlignRequestedSubject.asObservable();
  public readonly cellBackgroundColorRequested$: Observable<string> = this.cellBackgroundColorRequestedSubject.asObservable();
  public readonly cellBorderRequested$: Observable<CellBorderRequest> = this.cellBorderRequestedSubject.asObservable();
  public readonly fontFamilyRequested$: Observable<string> = this.fontFamilyRequestedSubject.asObservable();
  public readonly fontSizeRequested$: Observable<number | null> = this.fontSizeRequestedSubject.asObservable();
  public readonly insertRequested$: Observable<TableInsertRequest> = this.insertRequestedSubject.asObservable();
  public readonly formatPainterRequested$: Observable<boolean> = this.formatPainterRequestedSubject.asObservable();
  
  /** Signal for current formatting state */
  readonly formattingState = signal<TableFormattingState>({
    isBold: false,
    isItalic: false,
    textAlign: 'left',
    verticalAlign: 'top',
    fontFamily: '',
    fontSizePx: null,
  });

  /** One-shot format painter state (cell-level only) */
  readonly formatPainterActive = signal(false);
  private formatPainterStyle: Partial<TableCellStyle> | null = null;

  /** Callback to get selected cell elements */
  private getSelectedCellElements: (() => HTMLElement[]) | null = null;

  /** Cache the last selection range inside the active cell so toolbar interactions can restore it. */
  private lastSelectionRange: Range | null = null;

  constructor() {
    document.addEventListener('selectionchange', this.handleSelectionChange, true);
  }

  get activeCell(): HTMLElement | null {
    return this.activeCellSubject.value;
  }

  get activeTableWidgetId(): string | null {
    return this.activeTableWidgetIdSubject.value;
  }

  get selectedCells(): Set<string> {
    return this.selectedCellsSubject.value;
  }

  requestSplitCell(request: SplitCellRequest): void {
    this.splitCellRequestedSubject.next(request);
  }

  requestMergeCells(): void {
    this.mergeCellsRequestedSubject.next();
  }

  requestUnmerge(): void {
    this.unmergeRequestedSubject.next();
  }

  requestInsert(request: TableInsertRequest): void {
    this.insertRequestedSubject.next(request);
  }

  requestFormatPainterToggle(): void {
    const next = !this.formatPainterActive();
    this.formatPainterActive.set(next);
    if (!next) {
      this.formatPainterStyle = null;
    }
    this.formatPainterRequestedSubject.next(next);
  }

  clearFormatPainter(): void {
    if (!this.formatPainterActive()) return;
    this.formatPainterActive.set(false);
    this.formatPainterStyle = null;
    this.formatPainterRequestedSubject.next(false);
  }

  setFormatPainterStyle(style: Partial<TableCellStyle> | null): void {
    this.formatPainterStyle = style;
  }

  getFormatPainterStyle(): Partial<TableCellStyle> | null {
    return this.formatPainterStyle;
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
   * Apply text color to the current text selection (inside the active cell).
   */
  applyTextColor(color: string): void {
    if (!this.activeCell) return;
    this.restoreSelectionIfNeeded();
    // Prefer inline CSS rather than <font> tags when supported.
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand('foreColor', false, color);
    this.updateFormattingState();
  }

  /**
   * Apply highlight (background color) to the current text selection (inside the active cell).
   */
  applyTextHighlight(color: string): void {
    if (!this.activeCell) return;
    this.restoreSelectionIfNeeded();
    document.execCommand('styleWithCSS', false, 'true');
    // `hiliteColor` works in most modern browsers; `backColor` is a fallback.
    const ok = document.execCommand('hiliteColor', false, color);
    if (!ok) {
      document.execCommand('backColor', false, color);
    }
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
    } else {
      return;
    }
    this.textAlignRequestedSubject.next(align);
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
    } else {
      return;
    }
    this.verticalAlignRequestedSubject.next(align);
    this.formattingState.update(state => ({ ...state, verticalAlign: align }));
  }

  /**
   * Apply cell background fill to selected cells or active cell.
   * (This is cell-level formatting, persisted by the table widget.)
   */
  applyCellBackgroundColor(color: string): void {
    const cells = this.getSelectedCellElements?.() ?? [];
    if (cells.length > 0) {
      cells.forEach(cell => {
        cell.style.backgroundColor = color || 'transparent';
      });
    } else if (this.activeCell) {
      this.activeCell.style.backgroundColor = color || 'transparent';
    } else {
      return;
    }
    this.cellBackgroundColorRequestedSubject.next(color || '');
  }

  /**
   * Apply border styling to selected cells (persisted by the table widget model).
   * Note: Border is applied by the widget to the cell container (<td> / sub-cell), not to the contenteditable itself.
   */
  applyCellBorder(border: CellBorderRequest): void {
    this.cellBorderRequestedSubject.next(border);
  }

  /**
   * Apply font family to selected cells or active cell (cell-level formatting).
   */
  applyFontFamily(fontFamily: string): void {
    const value = (fontFamily ?? '').trim();
    const cells = this.getSelectedCellElements?.() ?? [];
    if (cells.length > 0) {
      cells.forEach(cell => {
        if (value) {
          cell.style.fontFamily = value;
        } else {
          cell.style.removeProperty('font-family');
        }
      });
    } else if (this.activeCell) {
      if (value) {
        this.activeCell.style.fontFamily = value;
      } else {
        this.activeCell.style.removeProperty('font-family');
      }
    } else {
      return;
    }

    this.fontFamilyRequestedSubject.next(value);
    this.formattingState.update(state => ({ ...state, fontFamily: value }));
  }

  /**
   * Apply font size (px) to selected cells or active cell (cell-level formatting).
   * Pass null to reset to default.
   */
  applyFontSizePx(px: number | null): void {
    const value = px === null ? null : Math.max(6, Math.min(96, Math.trunc(Number(px))));
    const cells = this.getSelectedCellElements?.() ?? [];
    if (cells.length > 0) {
      cells.forEach(cell => {
        if (value === null) {
          cell.style.removeProperty('font-size');
        } else {
          cell.style.fontSize = `${value}px`;
        }
      });
    } else if (this.activeCell) {
      if (value === null) {
        this.activeCell.style.removeProperty('font-size');
      } else {
        this.activeCell.style.fontSize = `${value}px`;
      }
    } else {
      return;
    }

    this.fontSizeRequestedSubject.next(value);
    this.formattingState.update(state => ({ ...state, fontSizePx: value }));
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
    const textAlign = ((cell.style.textAlign || computedStyle.textAlign || 'left') as 'left' | 'center' | 'right');
    const verticalAlign = ((cell.style.verticalAlign || computedStyle.verticalAlign || 'top') as 'top' | 'middle' | 'bottom');
    const fontFamily = (cell.style.fontFamily || computedStyle.fontFamily || '').trim();
    const fontSizeRaw = (cell.style.fontSize || computedStyle.fontSize || '').trim();
    const fontSizePx = (() => {
      const m = fontSizeRaw.match(/^(\d+(?:\.\d+)?)px$/);
      if (!m) return null;
      const v = Math.round(Number(m[1]));
      return Number.isFinite(v) ? v : null;
    })();

    this.formattingState.set({
      isBold,
      isItalic,
      textAlign,
      verticalAlign,
      fontFamily,
      fontSizePx,
    });
  }

  /**
   * Clear active cell when table widget loses focus
   */
  clearActiveCell(): void {
    this.activeCellSubject.next(null);
    this.activeTableWidgetIdSubject.next(null);
  }

  private handleSelectionChange = (): void => {
    const cell = this.activeCell;
    if (!cell) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const anchorNode = selection.anchorNode;
    if (!anchorNode) return;

    // Only cache selection if it lives inside the active cell; otherwise (e.g. toolbar inputs) ignore.
    if (!cell.contains(anchorNode)) return;

    try {
      this.lastSelectionRange = selection.getRangeAt(0).cloneRange();
    } catch {
      // Ignore rare DOM errors; keep previous range.
    }
  };

  private restoreSelectionIfNeeded(): void {
    const cell = this.activeCell;
    if (!cell || !this.lastSelectionRange) return;

    try {
      cell.focus();
      const selection = window.getSelection();
      if (!selection) return;
      selection.removeAllRanges();
      selection.addRange(this.lastSelectionRange);
    } catch {
      // If restoring fails, execCommand will apply at the current caret.
    }
  }
}

