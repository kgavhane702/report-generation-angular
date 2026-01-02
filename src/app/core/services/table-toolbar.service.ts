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
  // format painter removed (will be reworked later)
  private readonly importFromExcelRequestedSubject = new Subject<TableImportFromExcelRequest>();

  private readonly tableOptionsRequestedSubject = new Subject<{ options: TableSectionOptions; widgetId: string }>();
  private readonly preserveHeaderOnUrlLoadRequestedSubject = new Subject<{ widgetId: string; enabled: boolean }>();
  private readonly columnRulesRequestedSubject = new Subject<{ widgetId: string; columnRules: TableColumnRuleSet[] }>();
  
  public readonly activeCell$: Observable<HTMLElement | null> = this.activeCellSubject.asObservable();
  public readonly activeTableWidgetId$: Observable<string | null> = this.activeTableWidgetIdSubject.asObservable();
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

    const surface = cell.closest('.table-widget__cell-surface');
    const surfaceAlign = (surface?.getAttribute('data-vertical-align') || '').trim();
    const verticalAlign: 'top' | 'middle' | 'bottom' =
      surfaceAlign === 'middle' || surfaceAlign === 'bottom' ? (surfaceAlign as any) : 'top';

    const fontFamily = (cell.style.fontFamily || computedStyle.fontFamily || '').trim();
    const fontSizeRaw = (cell.style.fontSize || computedStyle.fontSize || '').trim();
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
    });
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

