import { Injectable, signal } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Subject } from 'rxjs';
import { TableCellStyle, TableWidgetProps, TableColumnRuleSet } from '../../models/widget.model';

export type TableSectionOptions = Pick<TableWidgetProps, 'headerRow' | 'firstColumn' | 'totalRow' | 'lastColumn'>;

export type TriState = 'on' | 'off' | 'mixed';

export interface TableFormattingState {
  isBold: TriState;
  isItalic: TriState;
  isUnderline: TriState;
  isStrikethrough: TriState;
  isSuperscript: TriState;
  isSubscript: TriState;
  textAlign: 'left' | 'center' | 'right' | 'justify' | 'mixed';
  verticalAlign: 'top' | 'middle' | 'bottom' | 'mixed';
  fontFamily: string;
  fontSizePx: number | null;
  blockTag: string;
  /** Current text color for the active selection (best-effort). Hex string like #rrggbb, or '' when unknown/mixed. */
  textColor: string;
  /** Current highlight color for the active selection (best-effort). Hex string like #rrggbb, or '' when none/unknown/mixed. */
  highlightColor: string;
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

export interface TableFitRowRequest {
  /**
   * Fit the active row (or selected rows if multi-cell selection exists) to content.
   * This is a transient editing action handled by TableWidgetComponent.
   */
  kind: 'fit-active-or-selection';
}

export interface TableImportFromExcelRequest {
  widgetId: string;
  rows: Array<{
    id: string;
    cells: Array<{
      id: string;
      contentHtml: string;
      merge: { rowSpan: number; colSpan: number } | null;
      coveredBy: { row: number; col: number } | null;
    }>;
  }>;
  columnFractions: number[];
  rowFractions: number[];
  /**
   * When true, keep the widget frame size (width/height) as-is while applying imported rows.
   *
   * Used for URL-based auto-load after JSON import so user-defined sizing is preserved
   * and the widget does not "grow" unexpectedly.
   */
  preserveWidgetFrame?: boolean;
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
  private readonly canMergeSelectionSubject = new BehaviorSubject<boolean>(false);
  private readonly splitCellRequestedSubject = new Subject<SplitCellRequest>();
  private readonly mergeCellsRequestedSubject = new Subject<void>();
  private readonly textAlignRequestedSubject = new Subject<'left' | 'center' | 'right' | 'justify'>();
  private readonly verticalAlignRequestedSubject = new Subject<'top' | 'middle' | 'bottom'>();
  private readonly cellBackgroundColorRequestedSubject = new Subject<string>();
  private readonly cellBorderRequestedSubject = new Subject<CellBorderRequest>();
  private readonly fontFamilyRequestedSubject = new Subject<string>();
  private readonly fontSizeRequestedSubject = new Subject<number | null>();
  private readonly fontWeightRequestedSubject = new Subject<'normal' | 'bold'>();
  private readonly fontStyleRequestedSubject = new Subject<'normal' | 'italic'>();
  private readonly textDecorationRequestedSubject = new Subject<'none' | 'underline' | 'line-through' | 'underline line-through'>();
  private readonly textColorRequestedSubject = new Subject<string>();
  private readonly textHighlightRequestedSubject = new Subject<string>();
  private readonly lineHeightRequestedSubject = new Subject<string>();
  private readonly insertRequestedSubject = new Subject<TableInsertRequest>();
  private readonly deleteRequestedSubject = new Subject<TableDeleteRequest>();
  private readonly fitRowRequestedSubject = new Subject<TableFitRowRequest>();
  // format painter removed (will be reworked later)
  private readonly importFromExcelRequestedSubject = new Subject<TableImportFromExcelRequest>();

  private readonly tableOptionsRequestedSubject = new Subject<{ options: TableSectionOptions; widgetId: string }>();
  private readonly preserveHeaderOnUrlLoadRequestedSubject = new Subject<{ widgetId: string; enabled: boolean }>();
  private readonly columnRulesRequestedSubject = new Subject<{ widgetId: string; columnRules: TableColumnRuleSet[] }>();
  
  public readonly activeCell$: Observable<HTMLElement | null> = this.activeCellSubject.asObservable();
  public readonly activeTableWidgetId$: Observable<string | null> = this.activeTableWidgetIdSubject.asObservable();
  public readonly selectedCells$: Observable<Set<string>> = this.selectedCellsSubject.asObservable();
  public readonly canMergeSelection$: Observable<boolean> = this.canMergeSelectionSubject.asObservable();
  public readonly splitCellRequested$: Observable<SplitCellRequest> = this.splitCellRequestedSubject.asObservable();
  public readonly mergeCellsRequested$: Observable<void> = this.mergeCellsRequestedSubject.asObservable();
  public readonly textAlignRequested$: Observable<'left' | 'center' | 'right' | 'justify'> = this.textAlignRequestedSubject.asObservable();
  public readonly verticalAlignRequested$: Observable<'top' | 'middle' | 'bottom'> = this.verticalAlignRequestedSubject.asObservable();
  public readonly cellBackgroundColorRequested$: Observable<string> = this.cellBackgroundColorRequestedSubject.asObservable();
  public readonly cellBorderRequested$: Observable<CellBorderRequest> = this.cellBorderRequestedSubject.asObservable();
  public readonly fontFamilyRequested$: Observable<string> = this.fontFamilyRequestedSubject.asObservable();
  public readonly fontSizeRequested$: Observable<number | null> = this.fontSizeRequestedSubject.asObservable();
  public readonly fontWeightRequested$: Observable<'normal' | 'bold'> = this.fontWeightRequestedSubject.asObservable();
  public readonly fontStyleRequested$: Observable<'normal' | 'italic'> = this.fontStyleRequestedSubject.asObservable();
  public readonly textDecorationRequested$: Observable<'none' | 'underline' | 'line-through' | 'underline line-through'> =
    this.textDecorationRequestedSubject.asObservable();
  public readonly textColorRequested$: Observable<string> = this.textColorRequestedSubject.asObservable();
  public readonly textHighlightRequested$: Observable<string> = this.textHighlightRequestedSubject.asObservable();
  public readonly lineHeightRequested$: Observable<string> = this.lineHeightRequestedSubject.asObservable();
  public readonly insertRequested$: Observable<TableInsertRequest> = this.insertRequestedSubject.asObservable();
  public readonly deleteRequested$: Observable<TableDeleteRequest> = this.deleteRequestedSubject.asObservable();
  public readonly fitRowRequested$: Observable<TableFitRowRequest> = this.fitRowRequestedSubject.asObservable();
  public readonly importFromExcelRequested$: Observable<TableImportFromExcelRequest> =
    this.importFromExcelRequestedSubject.asObservable();
  public readonly tableOptionsRequested$: Observable<{ options: TableSectionOptions; widgetId: string }> = this.tableOptionsRequestedSubject.asObservable();
  public readonly preserveHeaderOnUrlLoadRequested$: Observable<{ widgetId: string; enabled: boolean }> =
    this.preserveHeaderOnUrlLoadRequestedSubject.asObservable();
  public readonly columnRulesRequested$: Observable<{ widgetId: string; columnRules: TableColumnRuleSet[] }> =
    this.columnRulesRequestedSubject.asObservable();
  
  /** Signal for current formatting state */
  readonly formattingState = signal<TableFormattingState>({
    isBold: 'off',
    isItalic: 'off',
    isUnderline: 'off',
    isStrikethrough: 'off',
    isSuperscript: 'off',
    isSubscript: 'off',
    textAlign: 'left',
    verticalAlign: 'top',
    fontFamily: '',
    fontSizePx: null,
    blockTag: 'p',
    textColor: '#000000',
    highlightColor: '',
  });

  // format painter removed

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

  /**
   * Track the last clicked/focused image wrapper inside the active editor so toolbar actions
   * (align, reset size, etc.) can reliably target images even when the caret isn't adjacent.
   */
  private activeResizableImageWrapper: HTMLElement | null = null;
  private activeCellMouseDownListener: ((ev: MouseEvent) => void) | null = null;

  private hasTextSelectionInActiveCell(): boolean {
    const cell = this.activeCell;
    if (!cell) return false;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;
    const range = selection.getRangeAt(0);
    if (range.collapsed) return false;
    const anchor = selection.anchorNode;
    const focus = selection.focusNode;
    if (!anchor || !focus) return false;
    return cell.contains(anchor) && cell.contains(focus);
  }

  private getSelectedCellsCount(): number {
    return this.selectedCellsSubject.value?.size ?? 0;
  }

  private getSelectedCellsUniformState<T extends string>(
    getState: (el: HTMLElement) => T
  ): { all: T | null; values: T[] } {
    const cells = this.getSelectedCellElements?.() ?? [];
    const values = cells.map(getState);
    if (values.length === 0) {
      return { all: null, values: [] };
    }
    const first = values[0];
    const same = values.every((v) => v === first);
    return { all: same ? first : null, values };
  }

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

  /** Whether the current selection is actually mergeable (rectangle/valid region). */
  get canMergeSelection(): boolean {
    return !!this.canMergeSelectionSubject.value;
  }

  /** Used by the table widget to keep merge button enabled-state in sync with merge rules. */
  setCanMergeSelection(canMerge: boolean): void {
    this.canMergeSelectionSubject.next(!!canMerge);
  }

  requestSplitCell(request: SplitCellRequest): void {
    this.splitCellRequestedSubject.next(request);
  }

  requestMergeCells(): void {
    this.mergeCellsRequestedSubject.next();
  }

  requestInsert(request: TableInsertRequest): void {
    this.insertRequestedSubject.next(request);
  }

  requestDelete(request: TableDeleteRequest): void {
    this.deleteRequestedSubject.next(request);
  }

  requestFitRowToContent(): void {
    this.fitRowRequestedSubject.next({ kind: 'fit-active-or-selection' });
  }

  requestImportTableFromExcel(request: TableImportFromExcelRequest): void {
    this.importFromExcelRequestedSubject.next(request);
  }

  /** URL tables: preserve existing header row(s) on auto-load/export (remote data replaces only body). */
  setPreserveHeaderOnUrlLoad(enabled: boolean, widgetId: string): void {
    this.preserveHeaderOnUrlLoadRequestedSubject.next({ widgetId, enabled: !!enabled });
  }

  /** Persist column conditional rules for a table widget. */
  setColumnRules(columnRules: TableColumnRuleSet[], widgetId: string): void {
    this.columnRulesRequestedSubject.next({ widgetId, columnRules: Array.isArray(columnRules) ? columnRules : [] });
  }

  // format painter removed

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
    // Fast-path: if there isn't even a multi-cell selection, merge is definitely disabled.
    if ((cells?.size ?? 0) < 2) {
      this.canMergeSelectionSubject.next(false);
    }
    // If user is operating on a multi-cell selection, prefer cell formatting over image controls.
    if ((cells?.size ?? 0) > 1) {
      this.activeResizableImageWrapper = null;
    }
  }

  /**
   * Register a cell as the active one for formatting
   */
  setActiveCell(cell: HTMLElement | null, widgetId: string | null): void {
    // Remove delegated listener from previous active cell.
    const prev = this.activeCellSubject.value;
    if (prev && this.activeCellMouseDownListener) {
      try {
        prev.removeEventListener('mousedown', this.activeCellMouseDownListener, true);
      } catch {
        // ignore
      }
    }
    this.activeCellMouseDownListener = null;
    this.activeResizableImageWrapper = null;

    this.activeCellSubject.next(cell);
    this.activeTableWidgetIdSubject.next(widgetId);
    
    if (cell) {
      // Delegate clicks on images to capture "active image" without mutating persisted HTML.
      this.activeCellMouseDownListener = (ev: MouseEvent) => {
        const target = ev.target as Element | null;
        const wrapper = (target?.closest?.('.tw-resizable-image') as HTMLElement | null) ?? null;
        if (wrapper && cell.contains(wrapper)) {
          this.activeResizableImageWrapper = wrapper;
          // Make existing images focusable for better UX (outline via :focus). This is safe to persist.
          if (!wrapper.hasAttribute('tabindex')) {
            wrapper.setAttribute('tabindex', '0');
          }
          try {
            wrapper.focus?.();
          } catch {
            // ignore
          }
        } else {
          this.activeResizableImageWrapper = null;
        }
      };
      try {
        cell.addEventListener('mousedown', this.activeCellMouseDownListener, true);
      } catch {
        // ignore
      }

      this.updateFormattingState();
    }
  }

  /** Mark a table widget as active/selected without focusing a cell. */
  setActiveTableWidget(widgetId: string | null): void {
    this.activeTableWidgetIdSubject.next(widgetId);
    if (!widgetId) {
      this.canMergeSelectionSubject.next(false);
    }
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

    // If multiple cells are selected, apply cell-level fontWeight to the whole selection.
    // If selection is mixed, first action makes ALL bold (PPT-like).
    if (this.getSelectedCellsCount() > 1) {
      const { all } = this.getSelectedCellsUniformState<'normal' | 'bold'>((el) => {
        const w = (el.style.fontWeight || window.getComputedStyle(el).fontWeight || '').toString();
        // computed can be "700" etc.
        return w === 'bold' || Number(w) >= 600 ? 'bold' : 'normal';
      });

      const next: 'normal' | 'bold' = all === 'bold' ? 'normal' : 'bold';
      this.fontWeightRequestedSubject.next(next);
      this.formattingState.update((state) => ({ ...state, isBold: next === 'bold' ? 'on' : 'off' }));
      return;
    }

    // Otherwise keep existing inline behavior.
    this.restoreSelectionIfNeeded();
    document.execCommand('bold', false);
    this.updateFormattingState();
  }

  /**
   * Apply italic formatting to current selection
   */
  applyItalic(): void {
    if (!this.activeCell) return;

    if (this.getSelectedCellsCount() > 1) {
      const { all } = this.getSelectedCellsUniformState<'normal' | 'italic'>((el) => {
        const v = (el.style.fontStyle || window.getComputedStyle(el).fontStyle || '').toString();
        return v === 'italic' ? 'italic' : 'normal';
      });
      const next: 'normal' | 'italic' = all === 'italic' ? 'normal' : 'italic';
      this.fontStyleRequestedSubject.next(next);
      this.formattingState.update((state) => ({ ...state, isItalic: next === 'italic' ? 'on' : 'off' }));
      return;
    }

    this.restoreSelectionIfNeeded();
    document.execCommand('italic', false);
    this.updateFormattingState();
  }

  applyUnderline(): void {
    if (!this.activeCell) return;

    if (this.getSelectedCellsCount() > 1) {
      const { all } = this.getSelectedCellsUniformState<'none' | 'underline'>((el) => {
        const td = (el.style.textDecorationLine || window.getComputedStyle(el).textDecorationLine || '').toString();
        return td.includes('underline') ? 'underline' : 'none';
      });
      const next: 'none' | 'underline' = all === 'underline' ? 'none' : 'underline';
      this.textDecorationRequestedSubject.next(next);
      this.formattingState.update((state) => ({ ...state, isUnderline: next === 'underline' ? 'on' : 'off' }));
      return;
    }

    this.restoreSelectionIfNeeded();
    document.execCommand('underline', false);
    this.updateFormattingState();
  }

  applyStrikethrough(): void {
    if (!this.activeCell) return;

    if (this.getSelectedCellsCount() > 1) {
      const { all } = this.getSelectedCellsUniformState<'none' | 'line-through'>((el) => {
        const td = (el.style.textDecorationLine || window.getComputedStyle(el).textDecorationLine || '').toString();
        return td.includes('line-through') ? 'line-through' : 'none';
      });
      const next: 'none' | 'line-through' = all === 'line-through' ? 'none' : 'line-through';
      this.textDecorationRequestedSubject.next(next);
      this.formattingState.update((state) => ({ ...state, isStrikethrough: next === 'line-through' ? 'on' : 'off' }));
      return;
    }

    this.restoreSelectionIfNeeded();
    document.execCommand('strikeThrough', false);
    this.updateFormattingState();
  }

  /**
   * Editor-level undo for the active table cell (contenteditable).
   * Keeps focus/selection in the cell so we don't exit edit mode.
   */
  undo(): void {
    if (!this.activeCell) return;
    this.restoreSelectionIfNeeded();
    this.activeCell.focus();
    document.execCommand('undo', false);
    this.updateFormattingState();
  }

  /**
   * Editor-level redo for the active table cell (contenteditable).
   */
  redo(): void {
    if (!this.activeCell) return;
    this.restoreSelectionIfNeeded();
    this.activeCell.focus();
    document.execCommand('redo', false);
    this.updateFormattingState();
  }

  applySuperscript(): void {
    if (!this.activeCell) return;
    this.restoreSelectionIfNeeded();
    document.execCommand('superscript', false);
    // Persist DOM changes even if the browser doesn't fire an input event.
    try {
      this.activeCell.dispatchEvent(new CustomEvent('input', { bubbles: true, detail: { source: 'table-toolbar-superscript' } }));
    } catch {
      // ignore
    }
    this.updateFormattingState();
  }

  applySubscript(): void {
    if (!this.activeCell) return;
    this.restoreSelectionIfNeeded();
    document.execCommand('subscript', false);
    // Persist DOM changes even if the browser doesn't fire an input event.
    try {
      this.activeCell.dispatchEvent(new CustomEvent('input', { bubbles: true, detail: { source: 'table-toolbar-subscript' } }));
    } catch {
      // ignore
    }
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
        // Collapsed cursor: try to convert the current "line"/block into a list item
        // (PPT-like behavior: bulletize the current line with existing text).
        const didConvert = this.tryConvertCurrentBlockToList(range, cell, list, li);
        if (didConvert) {
          return;
        }

        // Fallback: create empty list item (still shows bullet in most browsers)
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
   * When the caret is collapsed inside an existing line of text, convert that line into a list item
   * so the bullet is visible immediately and keeps the existing text.
   */
  private tryConvertCurrentBlockToList(range: Range, cell: HTMLElement, list: HTMLElement, li: HTMLLIElement): boolean {
    const start = range.startContainer;
    if (!start) return false;

    // Find nearest block element inside the cell (most contenteditables create DIV or P per line).
    let node: Node | null = start.nodeType === Node.ELEMENT_NODE ? start : start.parentNode;
    while (node && node !== cell) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tag = el.tagName;
        if (tag === 'DIV' || tag === 'P') {
          // If the block is already empty-ish, fall back.
          const hasMeaningfulText = (el.textContent ?? '').replace(/\u200B/g, '').trim().length > 0;
          // Move block contents into the list item.
          while (el.firstChild) {
            li.appendChild(el.firstChild);
          }
          if (!li.firstChild && !hasMeaningfulText) {
            li.appendChild(document.createTextNode('\u200B'));
          }
          list.appendChild(li);
          el.parentNode?.replaceChild(list, el);

          // Place cursor at end of li content.
          try {
            const sel = window.getSelection();
            const newRange = document.createRange();
            newRange.selectNodeContents(li);
            newRange.collapse(false);
            sel?.removeAllRanges();
            sel?.addRange(newRange);
          } catch {
            // ignore
          }
          return true;
        }
      }
      node = node.parentNode;
    }

    // No block wrapper found (some editors keep plain text directly under the contenteditable).
    // In that case, wrap the current content into a list item so the bullet is visible and includes the existing text.
    try {
      // Move all content from the cell into the list item.
      while (cell.firstChild) {
        li.appendChild(cell.firstChild);
      }
      if (!li.firstChild) {
        li.appendChild(document.createTextNode('\u200B'));
      }
      list.appendChild(li);
      cell.appendChild(list);

      const sel = window.getSelection();
      const newRange = document.createRange();
      newRange.selectNodeContents(li);
      newRange.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(newRange);
      return true;
    } catch {
      return false;
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

    const normalized = this.normalizeLineHeight(lh);
    if (!normalized) return;

    if (this.getSelectedCellsCount() > 1) {
      this.lineHeightRequestedSubject.next(normalized);
      this.formattingState.update((state) => ({ ...state, fontSizePx: state.fontSizePx }));
      return;
    }

    this.restoreSelectionIfNeeded();

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);

    // Accept common values like "1.2", "1.4", "2", "20px"

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
    const value = (color ?? '').trim();

    if (this.getSelectedCellsCount() > 1) {
      // Cell-level text color for multi-cell selection.
      this.textColorRequestedSubject.next(value);
      // Keep toolbar UI in sync even before widget persists.
      this.formattingState.update((s) => ({ ...s, textColor: this.normalizeColorToHex(value) || s.textColor }));
      return;
    }

    this.restoreSelectionIfNeeded();
    // Prefer inline CSS rather than <font> tags when supported.
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand('foreColor', false, value);
    this.updateFormattingState();
  }

  /**
   * Apply highlight (background color) to the current text selection (inside the active cell).
   */
  applyTextHighlight(color: string): void {
    if (!this.activeCell) return;
    const value = (color ?? '').trim();

    if (this.getSelectedCellsCount() > 1) {
      // Cell-level highlight for multi-cell selection.
      this.textHighlightRequestedSubject.next(value);
      // Keep toolbar UI in sync even before widget persists.
      this.formattingState.update((s) => ({ ...s, highlightColor: this.normalizeColorToHex(value) }));
      return;
    }

    this.restoreSelectionIfNeeded();
    document.execCommand('styleWithCSS', false, 'true');
    // `hiliteColor` works in most modern browsers; `backColor` is a fallback.
    const ok = document.execCommand('hiliteColor', false, value);
    if (!ok) {
      document.execCommand('backColor', false, value);
    }
    this.updateFormattingState();
  }

  /**
   * Apply text alignment to selected cells or active cell
   */
  applyTextAlign(align: 'left' | 'center' | 'right' | 'justify'): void {
    // If the user explicitly selected text or multiple cells, alignment should affect text/cells, not images.
    const selectedCount = this.getSelectedCellsCount();
    const hasTextSelection = this.hasTextSelectionInActiveCell();
    if (!hasTextSelection && selectedCount <= 1) {
      // If an image wrapper is active (focused/clicked/caret-adjacent), interpret align as IMAGE layout control.
      const activeImage = this.getActiveResizableImageWrapper();
      if (activeImage && this.activeCell) {
        this.applyImageAlign(activeImage, align);
        try {
          this.activeCell.dispatchEvent(new CustomEvent('input', { bubbles: true, detail: { source: 'table-toolbar-image-align' } }));
        } catch {
          // Best-effort.
        }
        return;
      }
    }

    const cells = this.getSelectedCellElements?.() ?? [];
    if (cells.length > 0) {
      cells.forEach(cell => {
        cell.style.textAlign = align;
      });
    } else if (this.activeCell) {
      // For non-table editors (e.g. Editastra textbox) use execCommand so the alignment
      // is written into inner block elements and persists as part of innerHTML/contentHtml.
      const isInTable = !!this.activeCell.closest('.widget-table');
      if (!isInTable) {
        this.restoreSelectionIfNeeded();
        this.activeCell.focus();
        const cmdMap: Record<string, string> = {
          left: 'justifyLeft',
          center: 'justifyCenter',
          right: 'justifyRight',
          justify: 'justifyFull',
        };
        const cmd = cmdMap[align];
        if (cmd) {
          document.execCommand(cmd, false);
        }
        try {
          this.activeCell.dispatchEvent(new CustomEvent('input', { bubbles: true, detail: { source: 'table-toolbar-text-align' } }));
        } catch {
          // ignore
        }
      } else {
        this.activeCell.style.textAlign = align;
      }
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
    if (!this.activeCell && (this.getSelectedCellElements?.() ?? []).length === 0) return;
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
   * Apply font family.
   * - Multi-cell selection: cell-level styling (for tables).
   * - Single cell with text selection: inline <span> wrapping so it persists in innerHTML/contentHtml.
   * - Collapsed cursor: cell-level fallback.
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
      this.restoreSelectionIfNeeded();
      const appliedInline = this.applyInlineStyleToSelection('fontFamily', value || null);
      if (!appliedInline) {
        // Collapsed cursor: set cell-level style
        if (value) {
          this.activeCell.style.fontFamily = value;
        } else {
          this.activeCell.style.removeProperty('font-family');
        }
      }
      // Dispatch input event so widget autosave detects the content change.
      try {
        this.activeCell.dispatchEvent(new CustomEvent('input', { bubbles: true, detail: { source: 'table-toolbar-font-family' } }));
      } catch {
        // ignore
      }
    } else {
      return;
    }

    this.fontFamilyRequestedSubject.next(value);
    this.formattingState.update(state => ({ ...state, fontFamily: value }));
  }

  /**
   * Apply font size (px).
   * - Multi-cell selection: cell-level styling (for tables).
   * - Single cell with text selection: inline <span> wrapping so it persists in innerHTML/contentHtml.
   * - Collapsed cursor: cell-level fallback.
   * Pass null to reset to default.
   */
  applyFontSizePx(px: number | null): void {
    const value = px === null ? null : Math.max(6, Math.min(96, Math.trunc(Number(px))));
    const valueCss = value === null ? null : `${value}px`;
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
      this.restoreSelectionIfNeeded();
      const appliedInline = this.applyInlineStyleToSelection('fontSize', valueCss);
      if (!appliedInline) {
        // Collapsed cursor: set cell-level style
        if (value === null) {
          this.activeCell.style.removeProperty('font-size');
        } else {
          this.activeCell.style.fontSize = `${value}px`;
        }
      }
      // Dispatch input event so widget autosave detects the content change.
      try {
        this.activeCell.dispatchEvent(new CustomEvent('input', { bubbles: true, detail: { source: 'table-toolbar-font-size' } }));
      } catch {
        // ignore
      }
    } else {
      return;
    }

    this.fontSizeRequestedSubject.next(value);
    this.formattingState.update(state => ({ ...state, fontSizePx: value }));
  }

  /**
   * Apply a block-level tag (p, h1-h6) to the current selection or block.
   * Uses execCommand formatBlock for broad browser support.
   */
  applyBlockTag(tag: string): void {
    const normalizedTag = (tag || 'p').toLowerCase();
    const validTags = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
    if (!validTags.includes(normalizedTag)) return;

    const cell = this.activeCell;
    if (!cell) return;

    // Ensure focus is in the cell
    cell.focus();

    // Use formatBlock command
    document.execCommand('formatBlock', false, `<${normalizedTag}>`);

    // Update formatting state
    this.formattingState.update(state => ({ ...state, blockTag: normalizedTag }));
  }

  /**
   * Update formatting state based on current selection
   */
  updateFormattingState(): void {
    const cell = this.activeCell;
    if (!cell) return;

    // Multi-cell selection: compute tri-state from cell-level styles.
    if (this.getSelectedCellsCount() > 1) {
      const boldState = this.getSelectedCellsUniformState<'normal' | 'bold'>((el) => {
        const w = (el.style.fontWeight || window.getComputedStyle(el).fontWeight || '').toString();
        return w === 'bold' || Number(w) >= 600 ? 'bold' : 'normal';
      });

      const italicState = this.getSelectedCellsUniformState<'normal' | 'italic'>((el) => {
        const v = (el.style.fontStyle || window.getComputedStyle(el).fontStyle || '').toString();
        return v === 'italic' ? 'italic' : 'normal';
      });

      const underlineState = this.getSelectedCellsUniformState<'none' | 'underline'>((el) => {
        const td = (el.style.textDecorationLine || window.getComputedStyle(el).textDecorationLine || '').toString();
        return td.includes('underline') ? 'underline' : 'none';
      });

      const strikeState = this.getSelectedCellsUniformState<'none' | 'line-through'>((el) => {
        const td = (el.style.textDecorationLine || window.getComputedStyle(el).textDecorationLine || '').toString();
        return td.includes('line-through') ? 'line-through' : 'none';
      });

      const alignState = this.getSelectedCellsUniformState<'left' | 'center' | 'right' | 'justify'>((el) => {
        const a = (el.style.textAlign || window.getComputedStyle(el).textAlign || 'left').toString();
        return (a === 'center' || a === 'right' || a === 'justify') ? (a as any) : 'left';
      });

      const vAlignState = this.getSelectedCellsUniformState<'top' | 'middle' | 'bottom'>((el) => {
        const surface = el.closest('.table-widget__cell-surface');
        const v = (surface?.getAttribute('data-vertical-align') || '').trim();
        return (v === 'middle' || v === 'bottom') ? (v as any) : 'top';
      });

      const ffState = this.getSelectedCellsUniformState<string>((el) =>
        (el.style.fontFamily || window.getComputedStyle(el).fontFamily || '').trim()
      );
      const fsState = this.getSelectedCellsUniformState<string>((el) =>
        (el.style.fontSize || window.getComputedStyle(el).fontSize || '').trim()
      );

      const textColorState = this.getSelectedCellsUniformState<string>((el) =>
        (el.style.color || window.getComputedStyle(el).color || '').trim()
      );
      const highlightState = this.getSelectedCellsUniformState<string>((el) =>
        (el.style.backgroundColor || window.getComputedStyle(el).backgroundColor || '').trim()
      );

      const fontSizePx = (() => {
        if (fsState.all === null) return null;
        const m = (fsState.all ?? '').match(/^(\d+(?:\.\d+)?)px$/);
        if (!m) return null;
        const v = Math.round(Number(m[1]));
        return Number.isFinite(v) ? v : null;
      })();

      this.formattingState.set({
        isBold: boldState.all === null ? 'mixed' : boldState.all === 'bold' ? 'on' : 'off',
        isItalic: italicState.all === null ? 'mixed' : italicState.all === 'italic' ? 'on' : 'off',
        isUnderline: underlineState.all === null ? 'mixed' : underlineState.all === 'underline' ? 'on' : 'off',
        isStrikethrough: strikeState.all === null ? 'mixed' : strikeState.all === 'line-through' ? 'on' : 'off',
        // Inline-only behaviors: treat as off when multi-cell.
        isSuperscript: 'off',
        isSubscript: 'off',
        textAlign: alignState.all === null ? 'mixed' : alignState.all,
        verticalAlign: vAlignState.all === null ? 'mixed' : vAlignState.all,
        fontFamily: ffState.all === null ? '' : ffState.all,
        fontSizePx,
        blockTag: 'p', // Multi-cell: default to paragraph
        textColor: textColorState.all === null ? '' : (this.normalizeColorToHex(textColorState.all) || ''),
        highlightColor: (() => {
          if (highlightState.all === null) return '';
          const hx = this.normalizeColorToHex(highlightState.all) || '';
          // Treat fully transparent/none as empty.
          return hx;
        })(),
      });
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const isBold = document.queryCommandState('bold');
    const isItalic = document.queryCommandState('italic');
    const computedStyle = window.getComputedStyle(cell);

    const underlineFromSelection = document.queryCommandState('underline');
    const strikeFromSelection = document.queryCommandState('strikeThrough');

    const tdLine = (cell.style.textDecorationLine || computedStyle.textDecorationLine || '').toString();
    const underlineFromCell = tdLine.includes('underline');
    const strikeFromCell = tdLine.includes('line-through');

    const isUnderline = underlineFromSelection || underlineFromCell;
    const isStrikethrough = strikeFromSelection || strikeFromCell;
    const isSuperscript = document.queryCommandState('superscript');
    const isSubscript = document.queryCommandState('subscript');

    const rawAlign = (cell.style.textAlign || computedStyle.textAlign || 'left').toString();
    const textAlign: 'left' | 'center' | 'right' | 'justify' =
      rawAlign === 'center' || rawAlign === 'right' || rawAlign === 'justify' ? (rawAlign as any) : 'left';

    const surface =
      cell.closest('.table-widget__cell-surface') ||
      cell.closest('.object-widget__text-container');
    const surfaceAlign = (
      surface?.getAttribute('data-vertical-align') ||
      surface?.getAttribute('data-v-align') ||
      ''
    ).trim();
    const verticalAlign: 'top' | 'middle' | 'bottom' =
      surfaceAlign === 'middle' || surfaceAlign === 'bottom' ? (surfaceAlign as any) : 'top';

    const fontFamily = this.getInlineStyleFromSelection(cell, 'fontFamily') ||
      (cell.style.fontFamily || computedStyle.fontFamily || '').trim();

    // Best-effort: current inline text/highlight colors from browser command values.
    // NOTE: queryCommandValue can be stale immediately after focus changes; consumers should refresh on selectionchange.
    const textColorHex = (() => {
      const baseHex = this.normalizeColorToHex(computedStyle.color) || '#000000';
      // Prefer DOM-derived color at caret/selection (works for Editastra where color can be on inline spans).
      const fromSelection = this.getTextColorHexFromSelection(cell, baseHex);
      if (fromSelection) return fromSelection;

      // Fallback to browser command value.
      const raw = (() => { try { return (document.queryCommandValue('foreColor') as any) ?? ''; } catch { return ''; } })();
      return this.normalizeColorToHex(raw) || baseHex;
    })();
    const highlightColorHex = (() => {
      // IMPORTANT:
      // In tables, "fill" is often the cell element's background.
      // In Editastra, "widget background" may live on an ancestor (editable itself can be transparent).
      // So compute an *effective* background by walking up to the first non-transparent bg.
      const effectiveBgHex = this.getEffectiveBackgroundHex(cell);
      const selection = window.getSelection();
      const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

      // Prefer hiliteColor (true text highlight when supported).
      const hiliteRaw = (() => { try { return (document.queryCommandValue('hiliteColor') as any) ?? ''; } catch { return ''; } })();
      const hiliteHex = this.normalizeColorToHex(hiliteRaw) || '';
      if (hiliteHex && hiliteHex !== effectiveBgHex) return hiliteHex;

      // Next, try reading highlight from the element under the caret/selection (more reliable than backColor in our table cells).
      const fromSelection = this.getHighlightHexFromSelection(cell, effectiveBgHex);
      if (fromSelection) return fromSelection;

      // Finally, fall back to backColor ONLY when there's an actual text selection,
      // and only if it doesn't match the cell fill background (otherwise fill bleeds into "highlight").
      if (range && !range.collapsed) {
        const backRaw = (() => { try { return (document.queryCommandValue('backColor') as any) ?? ''; } catch { return ''; } })();
        const backHex = this.normalizeColorToHex(backRaw) || '';
        if (backHex && backHex !== effectiveBgHex) return backHex;
      }

      return '';
    })();

    const fontSizeRaw = this.getInlineStyleFromSelection(cell, 'fontSize') ||
      (cell.style.fontSize || computedStyle.fontSize || '').trim();
    const fontSizePx = (() => {
      const m = fontSizeRaw.match(/^(\d+(?:\.\d+)?)px$/);
      if (!m) return null;
      const v = Math.round(Number(m[1]));
      return Number.isFinite(v) ? v : null;
    })();

    // Detect current block tag (h1-h6 or p)
    const blockTag = this.detectCurrentBlockTag();

    this.formattingState.set({
      isBold: isBold ? 'on' : 'off',
      isItalic: isItalic ? 'on' : 'off',
      isUnderline: isUnderline ? 'on' : 'off',
      isStrikethrough: isStrikethrough ? 'on' : 'off',
      isSuperscript: isSuperscript ? 'on' : 'off',
      isSubscript: isSubscript ? 'on' : 'off',
      textAlign,
      verticalAlign,
      fontFamily,
      fontSizePx,
      blockTag,
      textColor: textColorHex,
      highlightColor: highlightColorHex,
    });
  }

  private getHighlightHexFromSelection(cell: HTMLElement, cellBgHex: string): string {
    try {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return '';
      const range = selection.getRangeAt(0);
      // Anchor a node near the caret.
      const startNode = range.startContainer;
      const startEl =
        (startNode instanceof HTMLElement
          ? startNode
          : (startNode.parentElement as HTMLElement | null)) ?? null;
      if (!startEl) return '';
      if (!cell.contains(startEl)) return '';

      // Walk up from the caret element toward the cell, looking for a non-transparent background that differs from cell fill.
      let el: HTMLElement | null = startEl;
      while (el && el !== cell) {
        const bg = window.getComputedStyle(el).backgroundColor;
        const bgHex = this.normalizeColorToHex(bg) || '';
        if (bgHex && bgHex !== cellBgHex) return bgHex;
        el = el.parentElement;
      }
      return '';
    } catch {
      return '';
    }
  }

  private getTextColorHexFromSelection(cell: HTMLElement, baseHex: string): string {
    try {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return '';
      const range = selection.getRangeAt(0);
      const startNode = range.startContainer;
      const startEl =
        (startNode instanceof HTMLElement
          ? startNode
          : (startNode.parentElement as HTMLElement | null)) ?? null;
      if (!startEl) return '';
      if (!cell.contains(startEl)) return '';

      // Walk up from caret toward the editor root, and take the first color that differs from the base.
      let el: HTMLElement | null = startEl;
      while (el && el !== cell) {
        const c = window.getComputedStyle(el).color;
        const hx = this.normalizeColorToHex(c) || '';
        if (hx && hx !== baseHex) return hx;
        el = el.parentElement;
      }

      return '';
    } catch {
      return '';
    }
  }

  private getEffectiveBackgroundHex(el: HTMLElement): string {
    try {
      let node: HTMLElement | null = el;
      while (node && node !== document.body) {
        const bg = window.getComputedStyle(node).backgroundColor;
        const hx = this.normalizeColorToHex(bg) || '';
        if (hx) return hx;
        node = node.parentElement;
      }
      return '';
    } catch {
      return '';
    }
  }

  private normalizeColorToHex(input: string): string {
    const raw = (input ?? '').toString().trim();
    if (!raw) return '';
    // Already hex.
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) {
      if (raw.length === 4) {
        const r = raw[1], g = raw[2], b = raw[3];
        return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
      }
      return raw.toLowerCase();
    }
    // rgb/rgba(...) - treat fully transparent as empty
    const m = raw.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([0-9.]+))?/i);
    if (m) {
      const r = Math.max(0, Math.min(255, Number(m[1]) || 0));
      const g = Math.max(0, Math.min(255, Number(m[2]) || 0));
      const b = Math.max(0, Math.min(255, Number(m[3]) || 0));
      const a = m[4] === undefined ? 1 : Math.max(0, Math.min(1, Number(m[4]) || 0));
      if (a <= 0.05) return '';
      const toHex = (n: number) => n.toString(16).padStart(2, '0');
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }
    // Fallback: let the browser parse named colors etc.
    try {
      const el = document.createElement('span');
      el.style.color = raw;
      document.body.appendChild(el);
      const c = window.getComputedStyle(el).color;
      document.body.removeChild(el);
      return this.normalizeColorToHex(c);
    } catch {
      return '';
    }
  }

  private detectCurrentBlockTag(): string {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return 'p';

    let node: Node | null = sel.anchorNode;
    while (node && node !== this.activeCell) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = (node as Element).tagName?.toLowerCase();
        if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p'].includes(tagName)) {
          return tagName;
        }
      }
      node = node.parentNode;
    }
    return 'p';
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
   * Apply an inline CSS style to the current text selection by wrapping it in a <span>.
   * For collapsed cursors (no selection), returns false so the caller can fall back to cell-level styling.
   * Returns true if inline styling was successfully applied.
   */
  private applyInlineStyleToSelection(styleProp: string, value: string | null): boolean {
    const cell = this.activeCell;
    if (!cell) return false;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;

    const range = selection.getRangeAt(0);
    if (!cell.contains(range.startContainer)) return false;
    if (range.collapsed) return false;

    // Convert camelCase to kebab-case for CSS property removal.
    const cssProperty = styleProp.replace(/([A-Z])/g, '-$1').toLowerCase();

    const span = document.createElement('span');
    if (value) {
      (span.style as any)[styleProp] = value;
    }

    try {
      range.surroundContents(span);
    } catch {
      // surroundContents fails when range partially selects non-text nodes.
      const fragment = range.extractContents();
      span.appendChild(fragment);
      range.insertNode(span);
    }

    // Clean up: remove the same style property from nested elements to prevent stacking.
    const nestedElements = span.querySelectorAll('span, font');
    nestedElements.forEach(el => {
      (el as HTMLElement).style.removeProperty(cssProperty);
      // Handle deprecated <font> elements that may exist from prior execCommands.
      if (el.tagName === 'FONT') {
        if (styleProp === 'fontFamily') el.removeAttribute('face');
        if (styleProp === 'fontSize') el.removeAttribute('size');
      }
    });

    // Restore selection around the newly inserted span.
    try {
      selection.removeAllRanges();
      const newRange = document.createRange();
      newRange.selectNodeContents(span);
      selection.addRange(newRange);
      this.lastSelectionRange = newRange.cloneRange();
    } catch {
      // ignore
    }

    return true;
  }

  /**
   * Get an inline CSS style value from the element at the current selection/caret position.
   * Walks from the caret's node upward to the cell, looking for the specified style property
   * set via inline style attributes (e.g. font-family on a <span>).
   */
  private getInlineStyleFromSelection(cell: HTMLElement, styleProp: string): string {
    try {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return '';
      const range = selection.getRangeAt(0);
      const startNode = range.startContainer;
      const startEl =
        (startNode instanceof HTMLElement
          ? startNode
          : (startNode.parentElement as HTMLElement | null)) ?? null;
      if (!startEl || !cell.contains(startEl)) return '';

      let el: HTMLElement | null = startEl;
      while (el && el !== cell) {
        const val = ((el.style as any)[styleProp] ?? '').toString().trim();
        if (val) return val;
        el = el.parentElement;
      }
      return '';
    } catch {
      return '';
    }
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
    this.canMergeSelectionSubject.next(false);
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

  /**
   * Snapshot the current selection inside the active cell.
   * Useful before opening native dialogs (file picker) that can steal focus/selection.
   */
  snapshotSelection(): void {
    this.handleSelectionChange();
  }

  /**
   * Insert an image at the current cursor position within the active cell/editor.
   * Stores images as data URLs so they persist in the document model.
   *
   * Default behavior: insert as an inline "glyph" object (caret can move around it).
   * The user can later use Align buttons while the caret is near the image to switch:
   * - Left: wrap-left
   * - Right: wrap-right
   * - Center: block (above/below)
   * - Justify: inline glyph (reset)
   */
  insertImageAtCursor(dataUrl: string, options?: { alt?: string }): void {
    const cell = this.activeCell;
    if (!cell) return;

    // Restore caret if toolbar interaction stole focus.
    this.restoreSelectionIfNeeded();
    cell.focus();

    const selection = window.getSelection();
    if (!selection) return;

    const wrapper = document.createElement('span');
    wrapper.className = 'tw-resizable-image tw-resizable-image--inline';
    wrapper.setAttribute('data-tw-resizable-image', '1');
    wrapper.setAttribute('contenteditable', 'false');
    wrapper.setAttribute('tabindex', '0');

    const isInTableCell = !!cell.closest('.widget-table');

    // Default sizing:
    // - Table: start at glyph-size (matches current font size)
    // - Editastra: start a bit larger (still scales with font size)
    wrapper.style.width = isInTableCell ? '1em' : '4em';

    const isSvg = this.isSvgDataUrl(dataUrl);
    if (isSvg) {
      const svg = this.buildInlineSvgFromDataUrl(dataUrl);
      if (svg) {
        svg.classList.add('tw-inline-svg');
        wrapper.appendChild(svg);
        // SVG icons should default to glyph-size.
        const glyph = isInTableCell ? '1em' : '1.2em';
        wrapper.style.width = glyph;
        wrapper.style.height = glyph;
        wrapper.setAttribute('data-tw-svg', '1');
      } else {
        // Fallback: render as <img> (won't inherit font color, but still works).
        const img = document.createElement('img');
        img.src = dataUrl;
        img.alt = (options?.alt ?? '').toString();
        img.setAttribute('draggable', 'false');
        img.addEventListener('load', () => {
          try {
            cell.dispatchEvent(new CustomEvent('input', { bubbles: true, detail: { source: 'table-toolbar-image-load' } }));
          } catch {
            // ignore
          }
        });
        wrapper.appendChild(img);
      }
    } else {
      const img = document.createElement('img');
      img.src = dataUrl;
      img.alt = (options?.alt ?? '').toString();
      img.setAttribute('draggable', 'false');
      img.addEventListener('load', () => {
        try {
          cell.dispatchEvent(new CustomEvent('input', { bubbles: true, detail: { source: 'table-toolbar-image-load' } }));
        } catch {
          // ignore
        }
      });
      wrapper.appendChild(img);
    }

    // Custom resize handle (pointer-driven) so the icon can be customized.
    const handle = document.createElement('span');
    handle.className = 'tw-resizable-image__handle';
    handle.setAttribute('contenteditable', 'false');
    handle.setAttribute('aria-hidden', 'true');
    wrapper.appendChild(handle);

    handle.addEventListener('pointerdown', (ev: PointerEvent) => {
      ev.preventDefault();
      ev.stopPropagation();

      wrapper.setAttribute('data-tw-resize-active', '1');

      try {
        (ev.target as HTMLElement | null)?.setPointerCapture?.(ev.pointerId);
      } catch {
        // Ignore.
      }

      const startRect = wrapper.getBoundingClientRect();
      const startW = Math.max(1, startRect.width);
      const startX = ev.clientX;

      const minW = 16;
      const maxW = Math.max(minW, startW + 2000);
      const isSvgWrapper = wrapper.getAttribute('data-tw-svg') === '1';

      const onMove = (moveEv: PointerEvent) => {
        const dx = moveEv.clientX - startX;
        const nextW = Math.max(minW, Math.min(maxW, Math.round(startW + dx)));
        wrapper.style.width = `${nextW}px`;
        // Keep inline SVG square so it matches glyph behavior.
        if (isSvgWrapper) {
          wrapper.style.height = `${nextW}px`;
        }
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove, true);
        window.removeEventListener('pointerup', onUp, true);
        wrapper.removeAttribute('data-tw-resize-active');
        try {
          cell.dispatchEvent(new CustomEvent('input', { bubbles: true, detail: { source: 'table-toolbar-image-resize' } }));
        } catch {
          // Best-effort.
        }
      };

      window.addEventListener('pointermove', onMove, true);
      window.addEventListener('pointerup', onUp, true);
    });

    let range: Range;
    if (selection.rangeCount > 0) {
      const r = selection.getRangeAt(0);
      // Only use selection if it lives inside the active cell.
      range = cell.contains(r.startContainer) ? r : document.createRange();
    } else {
      range = document.createRange();
    }

    if (!cell.contains(range.startContainer)) {
      range.selectNodeContents(cell);
      range.collapse(false);
    } else {
      range.deleteContents();
    }

    // Insert the wrapper at the caret.
    range.insertNode(wrapper);

    // Add a caret spacer after the image so the user can continue typing.
    const spacer = document.createTextNode('\u200B');
    try {
      wrapper.parentNode?.insertBefore(spacer, wrapper.nextSibling);
    } catch {
      // Ignore.
    }

    // Move caret after the spacer (or after wrapper if spacer failed).
    try {
      const nextAnchor = spacer.parentNode ? spacer : wrapper;
      range.setStartAfter(nextAnchor);
      range.setEndAfter(nextAnchor);
      selection.removeAllRanges();
      selection.addRange(range);
      this.lastSelectionRange = range.cloneRange();
    } catch {
      // ignore
    }

    // Notify the editor wrapper (table/editastra) that content changed.
    try {
      cell.dispatchEvent(new CustomEvent('input', { bubbles: true, detail: { source: 'table-toolbar-insert-image' } }));
    } catch {
      // Best-effort.
    }

    this.updateFormattingState();
  }

  /**
   * Reset the currently active/selected inline image back to its default "insert" size.
   * - Table: 1em (glyph-size)
   * - Editastra: 4em (raster), 1.2em (SVG glyph)
   */
  resetActiveInlineImageSize(): void {
    const cell = this.activeCell;
    if (!cell) return;

    const wrapper = this.getActiveResizableImageWrapper();
    if (!wrapper || !cell.contains(wrapper)) return;

    const isInTableCell = !!cell.closest('.widget-table');
    const isSvgWrapper = wrapper.getAttribute('data-tw-svg') === '1' || !!wrapper.querySelector('svg');

    if (isSvgWrapper) {
      const glyph = isInTableCell ? '1em' : '1.2em';
      wrapper.style.width = glyph;
      wrapper.style.height = glyph;
    } else {
      wrapper.style.width = isInTableCell ? '1em' : '4em';
      wrapper.style.removeProperty('height');
    }

    try {
      cell.dispatchEvent(new CustomEvent('input', { bubbles: true, detail: { source: 'table-toolbar-image-reset-size' } }));
    } catch {
      // Best-effort.
    }
  }

  private isSvgDataUrl(dataUrl: string): boolean {
    const v = (dataUrl ?? '').trim().toLowerCase();
    return v.startsWith('data:image/svg+xml');
  }

  private buildInlineSvgFromDataUrl(dataUrl: string): SVGElement | null {
    try {
      const raw = (dataUrl ?? '').trim();
      const lower = raw.toLowerCase();
      if (!lower.startsWith('data:image/svg+xml')) return null;

      const commaIdx = raw.indexOf(',');
      if (commaIdx === -1) return null;
      const meta = raw.slice(0, commaIdx).toLowerCase();
      const payload = raw.slice(commaIdx + 1);

      let svgText = '';
      if (meta.includes(';base64')) {
        svgText = atob(payload);
      } else {
        // URL-encoded or plain text payload.
        svgText = decodeURIComponent(payload);
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(svgText, 'image/svg+xml');
      const svg = doc.documentElement as unknown as SVGElement | null;
      if (!svg || svg.tagName.toLowerCase() !== 'svg') return null;

      this.sanitizeInlineSvg(svg);
      this.applyCurrentColorToSvg(svg);

      // Ensure predictable sizing inside the wrapper.
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');
      if (!svg.getAttribute('preserveAspectRatio')) {
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      }

      return document.importNode(svg, true) as unknown as SVGElement;
    } catch {
      return null;
    }
  }

  private sanitizeInlineSvg(svg: SVGElement): void {
    // Remove obviously unsafe elements.
    const forbidden = svg.querySelectorAll('script,foreignObject,iframe,object,embed');
    forbidden.forEach((n) => n.remove());

    const walker = document.createTreeWalker(svg, NodeFilter.SHOW_ELEMENT);
    const nodes: Element[] = [];
    while (walker.nextNode()) nodes.push(walker.currentNode as Element);

    for (const el of nodes) {
      for (const attr of Array.from(el.attributes)) {
        const name = (attr.name ?? '').toLowerCase();
        const value = attr.value ?? '';
        if (!name) continue;

        if (name.startsWith('on')) {
          el.removeAttribute(attr.name);
          continue;
        }

        // Prevent external references inside inline SVG.
        if (name === 'href' || name === 'xlink:href') {
          el.removeAttribute(attr.name);
          continue;
        }

        if (name === 'style' && (value ?? '').toLowerCase().includes('url(')) {
          el.removeAttribute('style');
        }
      }
    }
  }

  private applyCurrentColorToSvg(svg: SVGElement): void {
    // Ensure the SVG inherits the surrounding text color.
    const all = svg.querySelectorAll('*');
    for (const el of Array.from(all)) {
      const fill = (el.getAttribute('fill') ?? '').trim();
      if (fill && fill.toLowerCase() !== 'none' && fill.toLowerCase() !== 'currentcolor') {
        el.setAttribute('fill', 'currentColor');
      }
      const stroke = (el.getAttribute('stroke') ?? '').trim();
      if (stroke && stroke.toLowerCase() !== 'none' && stroke.toLowerCase() !== 'currentcolor') {
        el.setAttribute('stroke', 'currentColor');
      }
    }
    if (!svg.getAttribute('fill')) {
      svg.setAttribute('fill', 'currentColor');
    }
  }

  private getActiveResizableImageWrapper(): HTMLElement | null {
    const cell = this.activeCell;
    if (!cell) return null;

    // Prefer focused image wrapper.
    const activeEl = document.activeElement as HTMLElement | null;
    if (activeEl && activeEl.classList?.contains('tw-resizable-image') && cell.contains(activeEl)) {
      return activeEl;
    }

    // Prefer last clicked image wrapper in this active cell.
    if (this.activeResizableImageWrapper && this.activeResizableImageWrapper.isConnected && cell.contains(this.activeResizableImageWrapper)) {
      return this.activeResizableImageWrapper;
    }

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);

    // Case 1: selection is inside the wrapper element subtree.
    const startNode = range.startContainer;
    const startEl =
      (startNode && startNode.nodeType === Node.ELEMENT_NODE ? (startNode as Element) : (startNode as any as Node | null)?.parentElement) ?? null;
    const direct = (startEl?.closest?.('.tw-resizable-image') as HTMLElement | null) ?? null;
    if (direct && cell.contains(direct)) return direct;

    // Case 2: selection is on the contenteditable container and offset points near a wrapper node.
    if (range.startContainer && range.startContainer.nodeType === Node.ELEMENT_NODE) {
      const container = range.startContainer as Element;
      if (cell.contains(container)) {
        const idx = range.startOffset;
        const candidates: Array<Node | null> = [
          container.childNodes.item(idx) ?? null,
          idx > 0 ? (container.childNodes.item(idx - 1) ?? null) : null,
        ];
        for (const n of candidates) {
          const el = n && (n as any).nodeType === Node.ELEMENT_NODE ? (n as HTMLElement) : null;
          if (el && el.classList.contains('tw-resizable-image') && cell.contains(el)) {
            return el;
          }
        }
      }
    }

    return null;
  }

  private applyImageAlign(wrapper: HTMLElement, align: 'left' | 'center' | 'right' | 'justify'): void {
    wrapper.classList.remove(
      'tw-resizable-image--inline',
      'tw-resizable-image--left',
      'tw-resizable-image--right',
      'tw-resizable-image--block'
    );

    if (align === 'justify') {
      // Use justify as a convenient "reset to inline glyph" for images.
      wrapper.classList.add('tw-resizable-image--inline');
      return;
    }
    if (align === 'left') {
      wrapper.classList.add('tw-resizable-image--left');
      return;
    }
    if (align === 'right') {
      wrapper.classList.add('tw-resizable-image--right');
      return;
    }
    // center => block
    wrapper.classList.add('tw-resizable-image--block');
  }
}

