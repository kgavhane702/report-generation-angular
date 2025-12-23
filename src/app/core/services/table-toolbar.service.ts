import { Injectable, signal } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Subject } from 'rxjs';
import { TableCellStyle, TableWidgetProps } from '../../models/widget.model';

export type TableSectionOptions = Pick<TableWidgetProps, 'headerRow' | 'firstColumn' | 'totalRow' | 'lastColumn'>;

export interface TableFormattingState {
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  isStrikethrough: boolean;
  isSuperscript: boolean;
  isSubscript: boolean;
  textAlign: 'left' | 'center' | 'right' | 'justify';
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

export interface TableDeleteRequest {
  axis: 'row' | 'col';
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
  private readonly textAlignRequestedSubject = new Subject<'left' | 'center' | 'right' | 'justify'>();
  private readonly verticalAlignRequestedSubject = new Subject<'top' | 'middle' | 'bottom'>();
  private readonly cellBackgroundColorRequestedSubject = new Subject<string>();
  private readonly cellBorderRequestedSubject = new Subject<CellBorderRequest>();
  private readonly fontFamilyRequestedSubject = new Subject<string>();
  private readonly fontSizeRequestedSubject = new Subject<number | null>();
  private readonly insertRequestedSubject = new Subject<TableInsertRequest>();
  private readonly deleteRequestedSubject = new Subject<TableDeleteRequest>();
  private readonly formatPainterRequestedSubject = new Subject<boolean>();

  private readonly tableOptionsRequestedSubject = new Subject<{ options: TableSectionOptions; widgetId: string }>();
  
  public readonly activeCell$: Observable<HTMLElement | null> = this.activeCellSubject.asObservable();
  public readonly activeTableWidgetId$: Observable<string | null> = this.activeTableWidgetIdSubject.asObservable();
  public readonly splitCellRequested$: Observable<SplitCellRequest> = this.splitCellRequestedSubject.asObservable();
  public readonly mergeCellsRequested$: Observable<void> = this.mergeCellsRequestedSubject.asObservable();
  public readonly unmergeRequested$: Observable<void> = this.unmergeRequestedSubject.asObservable();
  public readonly textAlignRequested$: Observable<'left' | 'center' | 'right' | 'justify'> = this.textAlignRequestedSubject.asObservable();
  public readonly verticalAlignRequested$: Observable<'top' | 'middle' | 'bottom'> = this.verticalAlignRequestedSubject.asObservable();
  public readonly cellBackgroundColorRequested$: Observable<string> = this.cellBackgroundColorRequestedSubject.asObservable();
  public readonly cellBorderRequested$: Observable<CellBorderRequest> = this.cellBorderRequestedSubject.asObservable();
  public readonly fontFamilyRequested$: Observable<string> = this.fontFamilyRequestedSubject.asObservable();
  public readonly fontSizeRequested$: Observable<number | null> = this.fontSizeRequestedSubject.asObservable();
  public readonly insertRequested$: Observable<TableInsertRequest> = this.insertRequestedSubject.asObservable();
  public readonly deleteRequested$: Observable<TableDeleteRequest> = this.deleteRequestedSubject.asObservable();
  public readonly formatPainterRequested$: Observable<boolean> = this.formatPainterRequestedSubject.asObservable();
  public readonly tableOptionsRequested$: Observable<{ options: TableSectionOptions; widgetId: string }> = this.tableOptionsRequestedSubject.asObservable();
  
  /** Signal for current formatting state */
  readonly formattingState = signal<TableFormattingState>({
    isBold: false,
    isItalic: false,
    isUnderline: false,
    isStrikethrough: false,
    isSuperscript: false,
    isSubscript: false,
    textAlign: 'left',
    verticalAlign: 'top',
    fontFamily: '',
    fontSizePx: null,
  });

  /** One-shot format painter state (cell-level only) */
  readonly formatPainterActive = signal(false);
  private formatPainterStyle: Partial<TableCellStyle> | null = null;

  /** Current table section options as seen by the toolbar */
  readonly tableOptions = signal<TableSectionOptions>({
    headerRow: false,
    firstColumn: false,
    totalRow: false,
    lastColumn: false,
  });

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

  requestDelete(request: TableDeleteRequest): void {
    this.deleteRequestedSubject.next(request);
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

  /** Mark a table widget as active/selected without focusing a cell. */
  setActiveTableWidget(widgetId: string | null): void {
    this.activeTableWidgetIdSubject.next(widgetId);
  }

  /** Update table section options (header row/first column/total row/last column) */
  setTableOptions(patch: Partial<TableSectionOptions>, widgetId: string): void {
    const next: TableSectionOptions = {
      ...this.tableOptions(),
      ...patch,
    };
    this.tableOptions.set(next);
    this.tableOptionsRequestedSubject.next({ options: next, widgetId });
  }

  /** Used by the table widget to sync persisted props into toolbar state */
  syncTableOptionsFromProps(props: TableWidgetProps | null | undefined): void {
    const next: TableSectionOptions = {
      headerRow: !!props?.headerRow,
      firstColumn: !!props?.firstColumn,
      totalRow: !!props?.totalRow,
      lastColumn: !!props?.lastColumn,
    };
    // Set only if different to avoid loops.
    const cur = this.tableOptions();
    if (
      cur.headerRow !== next.headerRow ||
      cur.firstColumn !== next.firstColumn ||
      cur.totalRow !== next.totalRow ||
      cur.lastColumn !== next.lastColumn
    ) {
      this.tableOptions.set(next);
    }
  }

  /**
   * Apply bold formatting to current selection
   */
  applyBold(): void {
    if (!this.activeCell) return;
    this.restoreSelectionIfNeeded();
    document.execCommand('bold', false);
    this.updateFormattingState();
  }

  /**
   * Apply italic formatting to current selection
   */
  applyItalic(): void {
    if (!this.activeCell) return;
    this.restoreSelectionIfNeeded();
    document.execCommand('italic', false);
    this.updateFormattingState();
  }

  applyUnderline(): void {
    if (!this.activeCell) return;
    this.restoreSelectionIfNeeded();
    document.execCommand('underline', false);
    this.updateFormattingState();
  }

  applyStrikethrough(): void {
    if (!this.activeCell) return;
    this.restoreSelectionIfNeeded();
    document.execCommand('strikeThrough', false);
    this.updateFormattingState();
  }

  applySuperscript(): void {
    if (!this.activeCell) return;
    this.restoreSelectionIfNeeded();
    document.execCommand('superscript', false);
    this.updateFormattingState();
  }

  applySubscript(): void {
    if (!this.activeCell) return;
    this.restoreSelectionIfNeeded();
    document.execCommand('subscript', false);
    this.updateFormattingState();
  }

  increaseIndent(): void {
    if (!this.activeCell) return;
    this.restoreSelectionIfNeeded();
    document.execCommand('indent', false);
    this.updateFormattingState();
  }

  decreaseIndent(): void {
    if (!this.activeCell) return;
    this.restoreSelectionIfNeeded();
    document.execCommand('outdent', false);
    this.updateFormattingState();
  }

  /**
   * Toggle unordered (bullet) list with optional style
   */
  toggleBulletList(bulletStyle: string = 'disc'): void {
    if (!this.activeCell) return;
    this.restoreSelectionIfNeeded();
    this.activeCell.focus();
    
    // Always use manual implementation - execCommand is deprecated and unreliable
    this.manuallyInsertList('ul', bulletStyle);
    
    // Trigger input event to notify Angular of changes
    this.activeCell.dispatchEvent(new Event('input', { bubbles: true }));
    this.updateFormattingState();
  }

  /**
   * Toggle ordered (numbered) list
   */
  toggleNumberedList(): void {
    if (!this.activeCell) return;
    this.restoreSelectionIfNeeded();
    this.activeCell.focus();
    
    // Always use manual implementation - execCommand is deprecated and unreliable
    this.manuallyInsertList('ol', 'decimal');
    
    // Trigger input event to notify Angular of changes
    this.activeCell.dispatchEvent(new Event('input', { bubbles: true }));
    this.updateFormattingState();
  }

  /**
   * Manually insert a list when execCommand fails
   */
  private manuallyInsertList(listType: 'ul' | 'ol', markerStyle: string): void {
    const cell = this.activeCell;
    if (!cell) return;

    const selection = window.getSelection();
    
    // Check if we're already in a list of this type - if so, remove it
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const existingList = this.findParentElement(range.startContainer, listType.toUpperCase());
      if (existingList && cell.contains(existingList)) {
        // Remove list - convert list items back to text
        const fragment = document.createDocumentFragment();
        const items = existingList.querySelectorAll('li');
        items.forEach((li, index) => {
          if (index > 0) {
            fragment.appendChild(document.createElement('br'));
          }
          while (li.firstChild) {
            fragment.appendChild(li.firstChild);
          }
        });
        existingList.parentNode?.replaceChild(fragment, existingList);
        return;
      }
    }

    // Check if this is a custom marker
    const customMarkers = ['arrow', 'chevron', 'dash', 'check'];
    const isCustomMarker = customMarkers.includes(markerStyle);

    // Create a new list
    const list = document.createElement(listType);
    list.style.display = 'block';
    list.style.margin = '0';
    list.style.padding = '0';
    list.style.listStylePosition = 'inside';
    
    if (isCustomMarker) {
      // Use custom content marker via CSS ::before
      list.style.listStyleType = 'none';
      list.setAttribute('data-marker', markerStyle);
      list.className = 'custom-marker-list custom-marker-' + markerStyle;
    } else {
      list.style.listStyleType = markerStyle;
    }
    
    const li = document.createElement('li');
    li.style.display = 'list-item';
    li.style.margin = '0';
    li.style.padding = '0';
    li.style.textIndent = '0';

    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      
      if (!range.collapsed) {
        // Has selection - wrap selected content
        const selectedContent = range.extractContents();
        li.appendChild(selectedContent);
      } else {
        // Collapsed cursor - create empty list item
        // Use zero-width space for cursor positioning without visible space
        li.appendChild(document.createTextNode('\u200B'));
      }
      
      list.appendChild(li);
      range.insertNode(list);
    } else {
      // No selection at all - append to end of cell
      li.appendChild(document.createTextNode('\u200B'));
      list.appendChild(li);
      cell.appendChild(list);
    }

    // Move cursor into the list item
    try {
      const newRange = document.createRange();
      newRange.selectNodeContents(li);
      newRange.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(newRange);
    } catch (e) {
      // Ignore cursor positioning errors
    }
  }

  /**
   * Find parent element by tag name
   */
  private findParentElement(node: Node | null, tagName: string): HTMLElement | null {
    while (node && node !== this.activeCell) {
      if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName === tagName) {
        return node as HTMLElement;
      }
      node = node.parentNode;
    }
    return null;
  }

  /**
   * Apply line-height by styling the nearest block element inside the selection.
   * If selection is non-collapsed, we wrap the selected contents in a <span style="line-height: ...">.
   */
  applyLineHeight(lineHeight: string): void {
    if (!this.activeCell) return;
    const lh = (lineHeight ?? '').toString().trim();
    if (!lh) return;

    this.restoreSelectionIfNeeded();

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);

    // Accept common values like "1.2", "1.4", "2", "20px"
    const normalized = this.normalizeLineHeight(lh);
    if (!normalized) return;

    if (range.collapsed) {
      const node = range.startContainer;
      const el = (node instanceof Element ? node : node.parentElement) as Element | null;
      const block = (el?.closest('p, div, li, blockquote') ?? el) as HTMLElement | null;
      if (block && this.activeCell.contains(block)) {
        block.style.lineHeight = normalized;
      } else if (this.activeCell) {
        // Fallback: wrap entire cell contents.
        const wrapper = document.createElement('div');
        wrapper.style.lineHeight = normalized;
        wrapper.innerHTML = this.activeCell.innerHTML;
        this.activeCell.innerHTML = wrapper.outerHTML;
      }
    } else {
      const span = document.createElement('span');
      span.style.lineHeight = normalized;
      try {
        range.surroundContents(span);
      } catch {
        // Range may partially select non-text nodes; extract+wrap is more resilient.
        const frag = range.extractContents();
        span.appendChild(frag);
        range.insertNode(span);
      }

      // Reset selection around the newly inserted span.
      try {
        selection.removeAllRanges();
        const nextRange = document.createRange();
        nextRange.selectNodeContents(span);
        selection.addRange(nextRange);
      } catch {
        // ignore
      }
    }

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
  applyTextAlign(align: 'left' | 'center' | 'right' | 'justify'): void {
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
   * Apply vertical alignment to selected cells or active cell.
   * Updates the data-vertical-align attribute on the parent cell surface element,
   * which controls vertical alignment via flexbox justify-content in CSS.
   */
  applyVerticalAlign(align: 'top' | 'middle' | 'bottom'): void {
    const cells = this.getSelectedCellElements?.() ?? [];
    if (cells.length > 0) {
      cells.forEach(cell => {
        // Find the parent cell surface element and update its data-vertical-align attribute
        const cellSurface = cell.closest('.table-widget__cell-surface');
        if (cellSurface) {
          cellSurface.setAttribute('data-vertical-align', align);
        }
      });
    } else if (this.activeCell) {
      const cellSurface = this.activeCell.closest('.table-widget__cell-surface');
      if (cellSurface) {
        cellSurface.setAttribute('data-vertical-align', align);
      }
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
    const isUnderline = document.queryCommandState('underline');
    const isStrikethrough = document.queryCommandState('strikeThrough');
    const isSuperscript = document.queryCommandState('superscript');
    const isSubscript = document.queryCommandState('subscript');
    
    const computedStyle = window.getComputedStyle(cell);
    const textAlign = ((cell.style.textAlign || computedStyle.textAlign || 'left') as 'left' | 'center' | 'right');

    const surface = cell.closest('.table-widget__cell-surface');
    const surfaceAlign = (surface?.getAttribute('data-vertical-align') || '').trim();
    const verticalAlign = ((surfaceAlign || 'top') as 'top' | 'middle' | 'bottom');
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
      isUnderline,
      isStrikethrough,
      isSuperscript,
      isSubscript,
      textAlign,
      verticalAlign,
      fontFamily,
      fontSizePx,
    });
  }

  private normalizeLineHeight(input: string): string | null {
    const v = (input ?? '').trim();
    if (!v) return null;
    // unitless number
    if (/^\d+(\.\d+)?$/.test(v)) {
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0) return null;
      return String(n);
    }
    // px only (keep tight to avoid weird units in PDF)
    if (/^\d+(\.\d+)?px$/.test(v)) {
      const n = Number(v.replace(/px$/, ''));
      if (!Number.isFinite(n) || n <= 0) return null;
      return `${n}px`;
    }
    return null;
  }

  /**
   * Clear active cell when table widget loses focus
   */
  clearActiveCell(): void {
    this.activeCellSubject.next(null);
  }

  /** Clear active table selection (used when clicking outside the table). */
  clearActiveTableWidget(): void {
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

