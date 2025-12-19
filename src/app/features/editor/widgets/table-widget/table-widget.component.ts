import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  inject,
  OnInit,
  signal,
  ElementRef,
  ViewChild,
  untracked,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { v4 as uuid } from 'uuid';

import {
  TableWidgetProps,
  TableRow,
  TableCell,
  TableMergedRegion,
  TableCellStyle,
  WidgetModel,
} from '../../../../models/widget.model';
import { SplitCellRequest, TableToolbarService } from '../../../../core/services/table-toolbar.service';
import { UIStateService } from '../../../../core/services/ui-state.service';
import { PendingChangesRegistry, FlushableWidget } from '../../../../core/services/pending-changes-registry.service';

/**
 * TableWidgetComponent
 * 
 * A table widget with contenteditable cells for inline editing.
 * Follows the same architecture as TextWidgetComponent:
 * - Local editing state during typing
 * - Changes emitted only on blur
 * - FlushableWidget interface for pending changes
 */
@Component({
  selector: 'app-table-widget',
  templateUrl: './table-widget.component.html',
  styleUrls: ['./table-widget.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableWidgetComponent implements OnInit, OnChanges, OnDestroy, FlushableWidget {
  private readonly maxSplitDepth = 4;
  private readonly mergeLeafPrefix = 'merge:';
  private readonly mergeLeafPathSeparator = '#';

  @Input({ required: true }) widget!: WidgetModel;

  @Output() editingChange = new EventEmitter<boolean>();
  @Output() propsChange = new EventEmitter<Partial<TableWidgetProps>>();

  @ViewChild('tableContainer', { static: false }) tableContainer?: ElementRef<HTMLElement>;

  private readonly toolbarService = inject(TableToolbarService);
  private readonly uiState = inject(UIStateService);
  private readonly pendingChangesRegistry = inject(PendingChangesRegistry);
  private readonly cdr = inject(ChangeDetectorRef);

  /** Local copy of rows during editing */
  private readonly localRows = signal<TableRow[]>([]);
  private readonly localMergedRegions = signal<TableMergedRegion[]>([]);
  
  /** Track if we're actively editing */
  private readonly isActivelyEditing = signal<boolean>(false);
  
  /** Rows at edit start for comparison */
  private rowsAtEditStart: TableRow[] = [];
  private mergedRegionsAtEditStart: TableMergedRegion[] = [];
  
  /** Currently active cell element */
  private activeCellElement: HTMLElement | null = null;
  
  /** Active cell coordinates */
  private activeCellId: string | null = null;
  
  /** Blur timeout for delayed blur handling */
  private blurTimeoutId: number | null = null;

  private splitSubscription?: Subscription;
  private mergeSubscription?: Subscription;
  private unmergeSubscription?: Subscription;

  /** Multi-cell selection state */
  private readonly selectedCells = signal<Set<string>>(new Set());
  private isSelecting = false;
  private selectionMode: 'table' | 'leafRect' | null = null;
  private selectionStart: { row: number; col: number } | null = null;
  private selectionEnd: { row: number; col: number } | null = null;
  private leafRectStart: { x: number; y: number } | null = null;
  private tableRectStart: { x: number; y: number } | null = null;

  get editing(): boolean {
    return this.isActivelyEditing();
  }

  get tableProps(): TableWidgetProps {
    return this.widget.props as TableWidgetProps;
  }

  get rows(): TableRow[] {
    return this.localRows();
  }

  get mergedRegions(): TableMergedRegion[] {
    return this.localMergedRegions();
  }

  get widgetId(): string {
    return this.widget.id;
  }

  get selection(): Set<string> {
    return this.selectedCells();
  }

  ngOnInit(): void {
    this.localRows.set(this.cloneRows(this.tableProps.rows));
    this.localMergedRegions.set(this.cloneMergedRegions(this.tableProps.mergedRegions ?? []));
    document.addEventListener('mousedown', this.handleDocumentMouseDown);
    document.addEventListener('mouseup', this.handleDocumentMouseUp);
    document.addEventListener('mousemove', this.handleDocumentMouseMove);
    
    // Register cell getter with toolbar service
    this.toolbarService.setSelectedCellsGetter(() => this.getSelectedCellElements());

    this.splitSubscription = this.toolbarService.splitCellRequested$.subscribe((request) => {
      if (this.toolbarService.activeTableWidgetId !== this.widget.id) {
        return;
      }
      this.applySplitToSelection(request);
    });

    this.mergeSubscription = this.toolbarService.mergeCellsRequested$.subscribe(() => {
      if (this.toolbarService.activeTableWidgetId !== this.widget.id) {
        return;
      }
      this.applyMergeSelection();
    });

    this.unmergeSubscription = this.toolbarService.unmergeRequested$.subscribe(() => {
      if (this.toolbarService.activeTableWidgetId !== this.widget.id) {
        return;
      }
      this.applyUnmergeSelection();
    });
  }

  ngOnDestroy(): void {
    if (this.isActivelyEditing()) {
      this.commitChanges();
      this.pendingChangesRegistry.unregister(this.widget.id);
    }

    if (this.splitSubscription) {
      this.splitSubscription.unsubscribe();
    }
    if (this.mergeSubscription) {
      this.mergeSubscription.unsubscribe();
    }
    if (this.unmergeSubscription) {
      this.unmergeSubscription.unsubscribe();
    }
    
    document.removeEventListener('mousedown', this.handleDocumentMouseDown);
    document.removeEventListener('mouseup', this.handleDocumentMouseUp);
    document.removeEventListener('mousemove', this.handleDocumentMouseMove);
    
    if (this.blurTimeoutId !== null) {
      clearTimeout(this.blurTimeoutId);
    }
    
    if (this.toolbarService.activeTableWidgetId === this.widget.id) {
      this.toolbarService.clearActiveCell();
      this.toolbarService.setSelectedCellsGetter(null);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['widget'] && !this.isActivelyEditing()) {
      this.localRows.set(this.cloneRows(this.tableProps.rows));
      this.localMergedRegions.set(this.cloneMergedRegions(this.tableProps.mergedRegions ?? []));
    }
  }

  hasPendingChanges(): boolean {
    if (!this.isActivelyEditing()) {
      return false;
    }
    const current = {
      rows: this.localRows(),
      mergedRegions: this.localMergedRegions(),
    };
    const baseline = {
      rows: this.rowsAtEditStart,
      mergedRegions: this.mergedRegionsAtEditStart,
    };
    return JSON.stringify(current) !== JSON.stringify(baseline);
  }

  flush(): void {
    if (this.isActivelyEditing()) {
      if (this.blurTimeoutId !== null) {
        clearTimeout(this.blurTimeoutId);
        this.blurTimeoutId = null;
      }
      
      this.syncCellContent();
      this.commitChanges();
      
      this.isActivelyEditing.set(false);
      this.editingChange.emit(false);
      this.pendingChangesRegistry.unregister(this.widget.id);
    }
  }

  composeLeafId(rowIndex: number, cellIndex: number, path: string): string {
    return path ? `${rowIndex}-${cellIndex}-${path}` : `${rowIndex}-${cellIndex}`;
  }

  appendPath(path: string, index: number): string {
    return path ? `${path}-${index}` : `${index}`;
  }

  isLeafSelected(rowIndex: number, cellIndex: number, path: string): boolean {
    return this.selectedCells().has(this.composeLeafId(rowIndex, cellIndex, path));
  }

  isLeafCoveredByMerge(leafId: string): boolean {
    if (leafId.startsWith(this.mergeLeafPrefix)) {
      return false;
    }
    return this.localMergedRegions().some(r => r.leafIds.includes(leafId));
  }

  getMergedRegionRect(region: TableMergedRegion): { left: number; top: number; width: number; height: number } | null {
    const container = this.tableContainer?.nativeElement;
    if (!container) return null;

    const containerRect = container.getBoundingClientRect();
    let minLeft = Number.POSITIVE_INFINITY;
    let minTop = Number.POSITIVE_INFINITY;
    let maxRight = Number.NEGATIVE_INFINITY;
    let maxBottom = Number.NEGATIVE_INFINITY;

    for (const leafId of region.leafIds) {
      const el = container.querySelector(`.table-widget__cell-content[data-leaf="${leafId}"]`) as HTMLElement | null;
      if (!el) continue;
      const r = el.getBoundingClientRect();
      minLeft = Math.min(minLeft, r.left);
      minTop = Math.min(minTop, r.top);
      maxRight = Math.max(maxRight, r.right);
      maxBottom = Math.max(maxBottom, r.bottom);
    }

    if (!isFinite(minLeft) || !isFinite(minTop) || !isFinite(maxRight) || !isFinite(maxBottom)) {
      return null;
    }

    // Convert viewport coords -> container content coords (includes scroll)
    const left = minLeft - containerRect.left + container.scrollLeft;
    const top = minTop - containerRect.top + container.scrollTop;
    const width = maxRight - minLeft;
    const height = maxBottom - minTop;
    return { left, top, width, height };
  }

  onMergeFocus(event: FocusEvent, regionId: string): void {
    const cell = event.target as HTMLElement;
    this.activeCellElement = cell;
    this.activeCellId = cell.getAttribute('data-leaf') ?? `${this.mergeLeafPrefix}${regionId}`;
    this.toolbarService.setActiveCell(cell, this.widget.id);

    if (this.blurTimeoutId !== null) {
      clearTimeout(this.blurTimeoutId);
      this.blurTimeoutId = null;
    }

    if (!this.isActivelyEditing()) {
      this.isActivelyEditing.set(true);
      this.rowsAtEditStart = this.cloneRows(this.localRows());
      this.mergedRegionsAtEditStart = this.cloneMergedRegions(this.localMergedRegions());
      this.editingChange.emit(true);
      this.pendingChangesRegistry.register(this);
    }
  }

  onMergeBlur(event: FocusEvent, regionId: string): void {
    if (!this.isActivelyEditing()) {
      return;
    }
    this.syncCellContent();

    this.blurTimeoutId = window.setTimeout(() => {
      const activeElement = document.activeElement;
      const toolbarElement = document.querySelector('app-table-toolbar');

      const isStillInsideTable = activeElement &&
        this.tableContainer?.nativeElement?.contains(activeElement);
      const isStillInsideToolbar = activeElement &&
        toolbarElement?.contains(activeElement);

      if (!isStillInsideTable && !isStillInsideToolbar) {
        this.commitChanges();

        this.isActivelyEditing.set(false);
        this.editingChange.emit(false);
        this.activeCellElement = null;
        this.activeCellId = null;

        this.toolbarService.clearActiveCell();
        this.pendingChangesRegistry.unregister(this.widget.id);
      }

      this.blurTimeoutId = null;
    }, 150);
  }

  onMergeInput(event: Event, regionId: string): void {
    this.cdr.markForCheck();
  }

  onMergeKeydown(event: KeyboardEvent, regionId: string): void {
    // keep for parity / future keyboard navigation
  }

  onCellFocus(event: FocusEvent, rowIndex: number, cellIndex: number, leafPath?: string): void {
    const cell = event.target as HTMLElement;
    this.activeCellElement = cell;
    this.activeCellId = leafPath ? this.composeLeafId(rowIndex, cellIndex, leafPath) : `${rowIndex}-${cellIndex}`;
    
    this.toolbarService.setActiveCell(cell, this.widget.id);
    
    if (this.blurTimeoutId !== null) {
      clearTimeout(this.blurTimeoutId);
      this.blurTimeoutId = null;
    }
    
    if (!this.isActivelyEditing()) {
      this.isActivelyEditing.set(true);
      this.rowsAtEditStart = this.cloneRows(this.localRows());
      this.mergedRegionsAtEditStart = this.cloneMergedRegions(this.localMergedRegions());
      this.editingChange.emit(true);
      this.pendingChangesRegistry.register(this);
    }
  }

  onCellBlur(event: FocusEvent, rowIndex: number, cellIndex: number, leafPath?: string): void {
    if (!this.isActivelyEditing()) {
      return;
    }
    
    // Sync the content from the blurred cell
    this.syncCellContent();
    
    this.blurTimeoutId = window.setTimeout(() => {
      const activeElement = document.activeElement;
      const toolbarElement = document.querySelector('app-table-toolbar');
      
      const isStillInsideTable = activeElement && 
        this.tableContainer?.nativeElement?.contains(activeElement);
      const isStillInsideToolbar = activeElement && 
        toolbarElement?.contains(activeElement);
      
      if (!isStillInsideTable && !isStillInsideToolbar) {
        this.commitChanges();
        
        this.isActivelyEditing.set(false);
        this.editingChange.emit(false);
        this.activeCellElement = null;
        this.activeCellId = null;
        
        this.toolbarService.clearActiveCell();
        this.pendingChangesRegistry.unregister(this.widget.id);
      }
      
      this.blurTimeoutId = null;
    }, 150);
  }

  onCellInput(event: Event, rowIndex: number, cellIndex: number, leafPath?: string): void {
    // Content is synced on blur to avoid frequent updates
    this.cdr.markForCheck();
  }

  onCellKeydown(event: KeyboardEvent, rowIndex: number, cellIndex: number, leafPath?: string): void {
    // Handle Tab navigation between cells
    if (event.key === 'Tab') {
      event.preventDefault();
      this.syncCellContent();
      
      const rows = this.localRows();
      let nextRowIndex = rowIndex;
      let nextCellIndex = cellIndex;
      
      if (event.shiftKey) {
        // Move backwards
        nextCellIndex--;
        if (nextCellIndex < 0) {
          nextRowIndex--;
          if (nextRowIndex >= 0) {
            nextCellIndex = rows[nextRowIndex].cells.length - 1;
          }
        }
      } else {
        // Move forwards
        nextCellIndex++;
        if (nextCellIndex >= rows[rowIndex].cells.length) {
          nextRowIndex++;
          nextCellIndex = 0;
        }
      }
      
      if (nextRowIndex >= 0 && nextRowIndex < rows.length) {
        const nextCellContent = this.tableContainer?.nativeElement
          .querySelector(`[data-cell="${nextRowIndex}-${nextCellIndex}"] .table-widget__cell-content`) as HTMLElement;
        if (nextCellContent) {
          nextCellContent.focus();
        }
      }
    }
  }

  trackByRowId(index: number, row: TableRow): string {
    return row.id;
  }

  trackByCellId(index: number, cell: TableCell): string {
    return cell.id;
  }

  private handleDocumentMouseDown = (event: MouseEvent): void => {
    // Check if click is outside the table AND outside the table toolbar.
    // If we clear selection when the user clicks the toolbar, multi-cell actions (like Split) won't work.
    const target = event.target as Node | null;
    const isInsideTable = !!(target && this.tableContainer?.nativeElement?.contains(target));
    const toolbarElement = document.querySelector('app-table-toolbar');
    const isInsideToolbar = !!(target && toolbarElement?.contains(target));

    // If click starts inside a merged overlay cell, start leaf-rect selection here.
    if (isInsideTable) {
      const leafEl = (event.target as HTMLElement | null)?.closest('.table-widget__cell-content[data-leaf]') as HTMLElement | null;
      const leafId = leafEl?.getAttribute('data-leaf') ?? null;
      if (leafId && leafId.startsWith(this.mergeLeafPrefix)) {
        // If the user is already focused in this contenteditable, allow normal text selection by dragging.
        if (document.activeElement === leafEl) {
          return;
        }
        this.toolbarService.setActiveCell(leafEl, this.widget.id);
        this.isSelecting = true;
        this.selectionMode = 'leafRect';
        this.selectionStart = null;
        this.selectionEnd = null;
        this.tableRectStart = null;
        this.leafRectStart = { x: event.clientX, y: event.clientY };
        this.setSelection(new Set([leafId]));
        return;
      }
    }

    if (this.tableContainer?.nativeElement && !isInsideTable && !isInsideToolbar) {
      this.clearSelection();
    }
  };

  private handleDocumentMouseUp = (): void => {
    if (this.isSelecting) {
      this.isSelecting = false;
    }
    this.selectionMode = null;
    this.leafRectStart = null;
    this.tableRectStart = null;

    // Debug: log final selection on mouseup for active table widget
    if (this.toolbarService.activeTableWidgetId === this.widget.id) {
      this.logSelectedCells('mouseUp');
    }
  };

  private handleDocumentMouseMove = (event: MouseEvent): void => {
    if (!this.isSelecting) {
      return;
    }

    if (this.selectionMode === 'leafRect' && this.leafRectStart) {
      const selection = this.computeLeafRectSelection(this.leafRectStart, { x: event.clientX, y: event.clientY });
      this.setSelection(selection);
      return;
    }

    if (this.selectionMode === 'table' && this.selectionStart) {
      const cell = this.getCellFromPoint(event.clientX, event.clientY);
      if (cell) {
        this.selectionEnd = cell;
        this.updateTableSelection({ x: event.clientX, y: event.clientY });
      }
    }
  };

  onCellMouseDown(event: MouseEvent, rowIndex: number, cellIndex: number): void {
    // Only start selection on left click without focus intent
    if (event.button !== 0) return;

    // If the user is already focused in a contenteditable within this cell, allow normal text selection by dragging.
    const active = document.activeElement as HTMLElement | null;
    if (active?.classList?.contains('table-widget__cell-content')) {
      const activeTd = active.closest(`[data-cell="${rowIndex}-${cellIndex}"]`);
      if (activeTd) {
        return;
      }
    }

    // Mark this table widget as active for toolbar actions (even if no contenteditable is focused)
    this.toolbarService.setActiveCell(this.activeCellElement, this.widget.id);

    const cellModel = this.localRows()?.[rowIndex]?.cells?.[cellIndex];
    const isSplitParent = !!cellModel?.split;

    // If selection starts inside a split cell, do leaf-rectangle selection
    if (isSplitParent) {
      // IMPORTANT: don't preventDefault here, otherwise the browser won't focus
      // the contenteditable sub-cell and typing won't work.
      this.isSelecting = true;
      this.selectionMode = 'leafRect';
      this.selectionStart = null;
      this.selectionEnd = null;
      this.leafRectStart = { x: event.clientX, y: event.clientY };

      const initialLeafId = this.getLeafIdFromPoint(event.clientX, event.clientY);
      this.setSelection(initialLeafId ? new Set([initialLeafId]) : new Set());
      return;
    }

    // If shift is held, extend selection
    if (event.shiftKey && this.selectionMode === 'table' && this.selectionStart) {
      event.preventDefault();
      this.selectionEnd = { row: rowIndex, col: cellIndex };
      this.updateSelection();
      return;
    }

    // Start new selection
    this.isSelecting = true;
    this.selectionMode = 'table';
    this.leafRectStart = null;
    this.tableRectStart = { x: event.clientX, y: event.clientY };
    this.selectionStart = { row: rowIndex, col: cellIndex };
    this.selectionEnd = { row: rowIndex, col: cellIndex };
    this.updateTableSelection({ x: event.clientX, y: event.clientY });
  }

  onCellMouseEnter(event: MouseEvent, rowIndex: number, cellIndex: number): void {
    if (!this.isSelecting || this.selectionMode !== 'table') return;

    this.selectionEnd = { row: rowIndex, col: cellIndex };
    this.updateTableSelection({ x: event.clientX, y: event.clientY });
  }

  isCellSelected(rowIndex: number, cellIndex: number): boolean {
    const cellModel = this.localRows()?.[rowIndex]?.cells?.[cellIndex];
    if (cellModel?.split) {
      return false;
    }
    return this.selectedCells().has(`${rowIndex}-${cellIndex}`);
  }

  private updateSelection(): void {
    // Backwards-compatible entrypoint: table-only selection (no subcells).
    // Kept for any call sites we didn't refactor.
    const normal = this.computeNormalTableRectSelection();
    this.setSelection(normal);
  }

  private updateTableSelection(currentPoint: { x: number; y: number }): void {
    const normal = this.computeNormalTableRectSelection();
    const subCells = this.tableRectStart
      ? this.computeSubCellRectSelection(this.tableRectStart, currentPoint)
      : new Set<string>();
    const merged = this.tableRectStart
      ? this.computeMergedRectSelection(this.tableRectStart, currentPoint)
      : new Set<string>();

    const union = new Set<string>([...normal, ...subCells, ...merged]);
    this.setSelection(union);
  }

  private computeMergedRectSelection(
    start: { x: number; y: number },
    end: { x: number; y: number }
  ): Set<string> {
    const container = this.tableContainer?.nativeElement;
    if (!container) return new Set<string>();

    const x1 = Math.min(start.x, end.x);
    const x2 = Math.max(start.x, end.x);
    const y1 = Math.min(start.y, end.y);
    const y2 = Math.max(start.y, end.y);

    const selection = new Set<string>();
    const regions = this.localMergedRegions();

    for (const region of regions) {
      let minLeft = Number.POSITIVE_INFINITY;
      let minTop = Number.POSITIVE_INFINITY;
      let maxRight = Number.NEGATIVE_INFINITY;
      let maxBottom = Number.NEGATIVE_INFINITY;

      for (const leafId of region.leafIds) {
        const el = container.querySelector(`.table-widget__cell-content[data-leaf="${leafId}"]`) as HTMLElement | null;
        if (!el) continue;
        const r = el.getBoundingClientRect();
        minLeft = Math.min(minLeft, r.left);
        minTop = Math.min(minTop, r.top);
        maxRight = Math.max(maxRight, r.right);
        maxBottom = Math.max(maxBottom, r.bottom);
      }

      if (!isFinite(minLeft) || !isFinite(minTop) || !isFinite(maxRight) || !isFinite(maxBottom)) {
        continue;
      }

      const intersects = maxRight >= x1 && minLeft <= x2 && maxBottom >= y1 && minTop <= y2;
      if (intersects) {
        selection.add(`${this.mergeLeafPrefix}${region.id}`);
      }
    }

    return selection;
  }

  private computeNormalTableRectSelection(): Set<string> {
    if (!this.selectionStart || !this.selectionEnd) {
      return new Set<string>();
    }

    const minRow = Math.min(this.selectionStart.row, this.selectionEnd.row);
    const maxRow = Math.max(this.selectionStart.row, this.selectionEnd.row);
    const minCol = Math.min(this.selectionStart.col, this.selectionEnd.col);
    const maxCol = Math.max(this.selectionStart.col, this.selectionEnd.col);

    const selection = new Set<string>();
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        // Preserve existing behavior for normal cells:
        // - normal cells become selected as r-c
        // - split parents are NOT selected as r-c
        const cell = this.localRows()?.[r]?.cells?.[c];
        if (cell?.split) {
          continue;
        }
        selection.add(`${r}-${c}`);
      }
    }
    return selection;
  }

  clearSelection(): void {
    this.setSelection(new Set());
    this.selectionStart = null;
    this.selectionEnd = null;
    this.isSelecting = false;
    this.selectionMode = null;
    this.leafRectStart = null;
    this.tableRectStart = null;
    this.cdr.markForCheck();

    // Debug: log when selection is cleared
    if (this.toolbarService.activeTableWidgetId === this.widget.id) {
      this.logSelectedCells('clearSelection');
    }
  }

  private getCellFromPoint(x: number, y: number): { row: number; col: number } | null {
    const element = document.elementFromPoint(x, y);
    if (!element) return null;

    const cellElement = element.closest('[data-cell]');
    if (!cellElement || !this.tableContainer?.nativeElement.contains(cellElement)) {
      return null;
    }

    const cellId = cellElement.getAttribute('data-cell');
    if (!cellId) return null;

    const [row, col] = cellId.split('-').map(Number);
    return { row, col };
  };

  private getSelectedCellElements(): HTMLElement[] {
    if (!this.tableContainer?.nativeElement) return [];
    
    const elements: HTMLElement[] = [];
    this.selectedCells().forEach(leafId => {
      const node = this.tableContainer?.nativeElement.querySelector(
        `.table-widget__cell-content[data-leaf="${leafId}"]`
      ) as HTMLElement | null;
      if (node) {
        elements.push(node);
      }
    });
    return elements;
  }

  private setSelection(selection: Set<string>): void {
    const normalized = this.normalizeSelection(selection);
    this.selectedCells.set(normalized);
    this.toolbarService.setSelectedCells(normalized);
    this.cdr.markForCheck();
  }

  private normalizeSelection(selection: Set<string>): Set<string> {
    if (selection.size === 0) return selection;

    const regions = this.localMergedRegions();
    const normalized = new Set<string>();

    selection.forEach((id) => {
      if (id.startsWith(this.mergeLeafPrefix)) {
        normalized.add(id);
        return;
      }

      const region = regions.find(r => r.leafIds.includes(id));
      if (region) {
        normalized.add(`${this.mergeLeafPrefix}${region.id}`);
        return;
      }

      if (this.isLeafCoveredByMerge(id)) {
        // Shouldn't happen generally (covered leaves are disabled), but keep safe.
        return;
      }

      normalized.add(id);
    });

    return normalized;
  }

  private getLeafIdFromPoint(x: number, y: number): string | null {
    const element = document.elementFromPoint(x, y);
    if (!element) return null;
    const leafEl = (element as HTMLElement).closest('.table-widget__cell-content[data-leaf]') as HTMLElement | null;
    return leafEl?.getAttribute('data-leaf') ?? null;
  }

  private computeLeafRectSelection(
    start: { x: number; y: number },
    end: { x: number; y: number }
  ): Set<string> {
    const container = this.tableContainer?.nativeElement;
    if (!container) return new Set();

    const x1 = Math.min(start.x, end.x);
    const x2 = Math.max(start.x, end.x);
    const y1 = Math.min(start.y, end.y);
    const y2 = Math.max(start.y, end.y);

    const selection = new Set<string>();
    const leaves = container.querySelectorAll('.table-widget__cell-content[data-leaf]') as NodeListOf<HTMLElement>;
    leaves.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const intersects = rect.right >= x1 && rect.left <= x2 && rect.bottom >= y1 && rect.top <= y2;
      if (!intersects) return;
      const id = el.getAttribute('data-leaf');
      if (!id) return;
      if (this.isLeafCoveredByMerge(id)) return;
      selection.add(id);
    });

    return selection;
  }

  private computeSubCellRectSelection(
    start: { x: number; y: number },
    end: { x: number; y: number }
  ): Set<string> {
    const container = this.tableContainer?.nativeElement;
    if (!container) return new Set<string>();

    const x1 = Math.min(start.x, end.x);
    const x2 = Math.max(start.x, end.x);
    const y1 = Math.min(start.y, end.y);
    const y2 = Math.max(start.y, end.y);

    const selection = new Set<string>();
    const subLeaves = container.querySelectorAll(
      '.table-widget__cell-content--subcell[data-leaf]'
    ) as NodeListOf<HTMLElement>;

    subLeaves.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const intersects = rect.right >= x1 && rect.left <= x2 && rect.bottom >= y1 && rect.top <= y2;
      if (!intersects) return;
      const id = el.getAttribute('data-leaf');
      if (!id) return;
      if (this.isLeafCoveredByMerge(id)) return;
      selection.add(id);
    });

    return selection;
  }

  private syncCellContent(): void {
    if (!this.activeCellElement || !this.activeCellId) {
      return;
    }

    // Merged overlay cell editing
    if (this.activeCellId.startsWith(this.mergeLeafPrefix)) {
      const { regionId, path } = this.parseMergeLeafId(this.activeCellId);
      const content = this.activeCellElement.innerHTML;
      untracked(() => {
        this.localMergedRegions.update((regions) => {
          const next = this.cloneMergedRegions(regions);
          const idx = next.findIndex(r => r.id === regionId);
          if (idx >= 0) {
            if (path.length === 0) {
              next[idx].contentHtml = content;
            } else {
              const leaf = this.getCellAtPathFromMergedRegion(next[idx], path);
              if (leaf) {
                leaf.contentHtml = content;
              }
            }
          }
          return next;
        });
      });
      return;
    }

    const parts = this.activeCellId.split('-');
    const rowIndex = Number(parts[0]);
    const cellIndex = Number(parts[1]);
    const path = parts.slice(2).map(Number);
    const content = this.activeCellElement.innerHTML;
    
    untracked(() => {
      this.localRows.update(rows => {
        const newRows = this.cloneRows(rows);
        const baseCell = newRows[rowIndex]?.cells?.[cellIndex];
        if (!baseCell) {
          return newRows;
        }

        if (path.length === 0) {
          baseCell.contentHtml = content;
          return newRows;
        }

        const leaf = this.getCellAtPath(baseCell, path);
        if (leaf) {
          leaf.contentHtml = content;
        }
        return newRows;
      });
    });
  }

  private getCellAtPath(root: TableCell, path: number[]): TableCell | null {
    let current: TableCell = root;
    for (const idx of path) {
      const next = current.split?.cells?.[idx];
      if (!next) {
        return null;
      }
      current = next;
    }
    return current;
  }

  private parseMergeLeafId(mergeLeafId: string): { regionId: string; path: number[] } {
    const raw = mergeLeafId.slice(this.mergeLeafPrefix.length);
    const sepIdx = raw.indexOf(this.mergeLeafPathSeparator);
    if (sepIdx < 0) {
      return { regionId: raw, path: [] };
    }
    const regionId = raw.slice(0, sepIdx);
    const pathStr = raw.slice(sepIdx + 1);
    const path = pathStr ? pathStr.split('-').map(n => Number(n)).filter(n => Number.isFinite(n)) : [];
    return { regionId, path };
  }

  private getCellAtPathFromMergedRegion(region: TableMergedRegion, path: number[]): TableCell | null {
    if (path.length === 0) return null;
    let current: TableCell | null = region.split?.cells?.[path[0]] ?? null;
    if (!current) return null;
    for (const idx of path.slice(1)) {
      const nextCell: TableCell | null = current.split?.cells?.[idx] ?? null;
      if (!nextCell) return null;
      current = nextCell;
    }
    return current;
  }

  private commitChanges(): void {
    const currentRows = this.localRows();
    const currentMergedRegions = this.localMergedRegions();
    const originalRows = this.rowsAtEditStart;
    const originalMergedRegions = this.mergedRegionsAtEditStart;

    const current = { rows: currentRows, mergedRegions: currentMergedRegions };
    const original = { rows: originalRows, mergedRegions: originalMergedRegions };

    if (JSON.stringify(current) !== JSON.stringify(original)) {
      this.propsChange.emit({ rows: currentRows, mergedRegions: currentMergedRegions });
    }
  }

  private cloneRows(rows: TableRow[]): TableRow[] {
    const cloneCell = (cell: TableCell): TableCell => ({
      ...cell,
      style: cell.style ? { ...cell.style } : undefined,
      split: cell.split
        ? {
            rows: cell.split.rows,
            cols: cell.split.cols,
            cells: cell.split.cells.map(cloneCell),
          }
        : undefined,
    });

    return rows.map(row => ({
      ...row,
      cells: row.cells.map(cloneCell),
    }));
  }

  private cloneMergedRegions(regions: TableMergedRegion[]): TableMergedRegion[] {
    const cloneCell = (cell: TableCell): TableCell => ({
      ...cell,
      style: cell.style ? { ...cell.style } : undefined,
      split: cell.split
        ? {
            rows: cell.split.rows,
            cols: cell.split.cols,
            cells: cell.split.cells.map(cloneCell),
          }
        : undefined,
    });

    return regions.map(r => ({
      ...r,
      leafIds: [...r.leafIds],
      style: r.style ? { ...r.style } : undefined,
      split: r.split
        ? {
            rows: r.split.rows,
            cols: r.split.cols,
            cells: r.split.cells.map(cloneCell),
          }
        : undefined,
    }));
  }

  private logSelectedCells(reason: string): void {
    const selected = Array.from(this.selectedCells());
    (window as any).__tableWidgetSelectedCells = selected;
    // eslint-disable-next-line no-console
    console.log(`[TableWidget ${this.widget.id}] selectedCells (${reason}):`, selected);
  }

  private applySplitToSelection(request: SplitCellRequest): void {
    this.syncCellContent();

    const rowsCount = Math.max(1, Math.trunc(request.rows));
    const colsCount = Math.max(1, Math.trunc(request.cols));
    if (rowsCount <= 0 || colsCount <= 0) {
      return;
    }

    const selection = this.selectedCells();
    const targetLeafIds = new Set<string>();

    if (selection.size > 0) {
      selection.forEach(id => targetLeafIds.add(id));
    } else if (this.activeCellId) {
      targetLeafIds.add(this.activeCellId);
    }

    if (targetLeafIds.size === 0) {
      return;
    }

    const before = {
      rows: this.cloneRows(this.localRows()),
      mergedRegions: this.cloneMergedRegions(this.localMergedRegions()),
    };

    this.localRows.update((rows) => {
      const newRows = this.cloneRows(rows);
      for (const leafId of targetLeafIds) {
        // Split inside merged overlay region
        if (leafId.startsWith(this.mergeLeafPrefix)) {
          continue;
        }
        const parts = leafId.split('-');
        if (parts.length < 2) continue;
        const r = Number(parts[0]);
        const c = Number(parts[1]);
        const path = parts.slice(2).map(Number);

        // Limit recursion depth to keep UI and data manageable.
        // Depth is the number of indices in the path; splitting increases it by 1.
        if (path.length >= this.maxSplitDepth) {
          continue;
        }

        const baseCell = newRows[r]?.cells?.[c];
        if (!baseCell) continue;

        const targetCell = path.length === 0 ? baseCell : this.getCellAtPath(baseCell, path);
        if (!targetCell) continue;
        if (targetCell.split) continue;

        const idPrefix = path.length > 0
          ? `cell-${r}-${c}-${path.join('_')}`
          : `cell-${r}-${c}`;

        const childCells: TableCell[] = [];
        for (let i = 0; i < rowsCount * colsCount; i++) {
          childCells.push({
            id: `${idPrefix}-${i}-${uuid()}`,
            contentHtml: '',
            style: targetCell.style ? { ...targetCell.style } : undefined,
          });
        }

        // Move existing content into the top-left child
        childCells[0].contentHtml = targetCell.contentHtml || '';

        targetCell.split = {
          rows: rowsCount,
          cols: colsCount,
          cells: childCells,
        };
        targetCell.contentHtml = '';
      }
      return newRows;
    });

    // Apply splits to merged regions separately
    const mergeTargets = Array.from(targetLeafIds).filter(id => id.startsWith(this.mergeLeafPrefix));
    if (mergeTargets.length > 0) {
      this.localMergedRegions.update((regions) => {
        const next = this.cloneMergedRegions(regions);
        for (const mergeLeafId of mergeTargets) {
          const { regionId, path } = this.parseMergeLeafId(mergeLeafId);
          const idx = next.findIndex(r => r.id === regionId);
          if (idx < 0) continue;

          if (path.length >= this.maxSplitDepth) {
            continue;
          }

          // Split region root
          if (path.length === 0) {
            if (next[idx].split) continue;
            const childCells: TableCell[] = [];
            for (let i = 0; i < rowsCount * colsCount; i++) {
              childCells.push({
                id: `merge-${regionId}-${i}-${uuid()}`,
                contentHtml: '',
                style: next[idx].style ? { ...next[idx].style } : undefined,
              });
            }
            childCells[0].contentHtml = next[idx].contentHtml || '';
            next[idx].split = { rows: rowsCount, cols: colsCount, cells: childCells };
            next[idx].contentHtml = '';
            continue;
          }

          // Split a nested cell inside region
          const targetCell = this.getCellAtPathFromMergedRegion(next[idx], path);
          if (!targetCell) continue;
          if (targetCell.split) continue;

          const childCells: TableCell[] = [];
          for (let i = 0; i < rowsCount * colsCount; i++) {
            childCells.push({
              id: `merge-${regionId}-${path.join('_')}-${i}-${uuid()}`,
              contentHtml: '',
              style: targetCell.style ? { ...targetCell.style } : undefined,
            });
          }
          childCells[0].contentHtml = targetCell.contentHtml || '';
          targetCell.split = { rows: rowsCount, cols: colsCount, cells: childCells };
          targetCell.contentHtml = '';
        }
        return next;
      });
    }

    // Persist immediately (split is a discrete action; no blur needed)
    const after = {
      rows: this.localRows(),
      mergedRegions: this.localMergedRegions(),
    };

    if (JSON.stringify(after) !== JSON.stringify(before)) {
      this.propsChange.emit({ rows: after.rows, mergedRegions: after.mergedRegions });
      // Reset baseline to avoid duplicate emits on blur
      this.rowsAtEditStart = this.cloneRows(after.rows);
      this.mergedRegionsAtEditStart = this.cloneMergedRegions(after.mergedRegions);
    }

    // Clear active element reference if it was replaced by split rendering
    this.activeCellElement = null;
    this.activeCellId = null;
    this.toolbarService.setActiveCell(null, this.widget.id);

    this.cdr.markForCheck();
  }

  private applyMergeSelection(): void {
    this.syncCellContent();

    const container = this.tableContainer?.nativeElement;
    if (!container) return;

    const selectionIds = Array.from(this.selectedCells());
    if (selectionIds.length < 2) {
      return;
    }

    // Compute selection bounding box from selected items (leaf cells + merged overlays)
    let minLeft = Number.POSITIVE_INFINITY;
    let minTop = Number.POSITIVE_INFINITY;
    let maxRight = Number.NEGATIVE_INFINITY;
    let maxBottom = Number.NEGATIVE_INFINITY;

    const regions = this.localMergedRegions();

    for (const id of selectionIds) {
      const el = container.querySelector(`.table-widget__cell-content[data-leaf="${id}"]`) as HTMLElement | null;
      if (!el) {
        continue;
      }
      const r = el.getBoundingClientRect();
      minLeft = Math.min(minLeft, r.left);
      minTop = Math.min(minTop, r.top);
      maxRight = Math.max(maxRight, r.right);
      maxBottom = Math.max(maxBottom, r.bottom);
    }

    if (!isFinite(minLeft) || !isFinite(minTop) || !isFinite(maxRight) || !isFinite(maxBottom)) {
      return;
    }

    const eps = 2.0;
    const leftBound = minLeft - eps;
    const topBound = minTop - eps;
    const rightBound = maxRight + eps;
    const bottomBound = maxBottom + eps;

    // Covered leaves are all non-merge leaves whose CENTER lies inside the selection bounds.
    // This avoids false negatives from 1px borders/gaps and matches user expectation:
    // merge rectangle between selected extremes.
    const coveredLeafIds: Array<{ id: string; top: number; left: number }> = [];
    const allLeafEls = container.querySelectorAll('.table-widget__cell-content[data-leaf]') as NodeListOf<HTMLElement>;
    for (const el of Array.from(allLeafEls)) {
      const id = el.getAttribute('data-leaf');
      if (!id || id.startsWith(this.mergeLeafPrefix)) continue;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      if (cx >= leftBound && cx <= rightBound && cy >= topBound && cy <= bottomBound) {
        coveredLeafIds.push({ id, top: r.top, left: r.left });
      }
    }

    if (coveredLeafIds.length < 2) return;

    // Determine which existing merged regions are fully/partially inside this merge (consumed)
    const leafToRegionId = new Map<string, string>();
    for (const r of regions) {
      for (const leafId of r.leafIds) {
        leafToRegionId.set(leafId, r.id);
      }
    }

    const consumedRegionIds = new Set<string>();
    for (const leaf of coveredLeafIds) {
      const rid = leafToRegionId.get(leaf.id);
      if (rid) consumedRegionIds.add(rid);
    }

    // Anchor leaf = top-left
    coveredLeafIds.sort((a, b) => (a.top - b.top) || (a.left - b.left));
    const anchorLeafId = coveredLeafIds[0].id;

    // Concatenate contents in reading order; merged regions contribute once (at their first encountered leaf).
    const usedRegionIds = new Set<string>();
    const parts: Array<{ top: number; left: number; html: string; style?: TableCellStyle }> = [];

    for (const leaf of coveredLeafIds) {
      const rid = leafToRegionId.get(leaf.id);
      if (rid) {
        if (usedRegionIds.has(rid)) continue;
        usedRegionIds.add(rid);
        const region = regions.find(r => r.id === rid);
        if (region) {
          const html = (this.serializeMergedRegionContent(region) ?? '').trim();
          if (html) {
            parts.push({ top: leaf.top, left: leaf.left, html, style: region.style });
          }
        }
        continue;
      }

      const cell = this.getLeafCellById(leaf.id);
      const html = (cell?.contentHtml ?? '').trim();
      if (html) {
        parts.push({ top: leaf.top, left: leaf.left, html, style: cell?.style });
      }
    }

    parts.sort((a, b) => (a.top - b.top) || (a.left - b.left));
    const mergedHtml = parts.length > 0 ? parts.map(p => `<div>${p.html}</div>`).join('') : '';
    const mergedStyle = parts.length > 0 ? (parts[0].style ? { ...parts[0].style } : undefined) : undefined;

    const regionId = uuid();
    const region: TableMergedRegion = {
      id: regionId,
      leafIds: coveredLeafIds.map(x => x.id),
      anchorLeafId,
      contentHtml: mergedHtml,
      style: mergedStyle,
    };

    // Clear contents of all covered leaves
    this.localRows.update((rows) => {
      const newRows = this.cloneRows(rows);
      for (const x of coveredLeafIds) {
        this.setLeafCellContent(newRows, x.id, '');
      }
      return newRows;
    });

    // Remove consumed regions and add the new one
    const nextRegions = regions.filter(r => !consumedRegionIds.has(r.id));
    this.localMergedRegions.set([...this.cloneMergedRegions(nextRegions), region]);

    // Persist immediately
    const rowsAfter = this.localRows();
    const mergedAfter = this.localMergedRegions();
    this.propsChange.emit({ rows: rowsAfter, mergedRegions: mergedAfter });
    this.rowsAtEditStart = this.cloneRows(rowsAfter);
    this.mergedRegionsAtEditStart = this.cloneMergedRegions(mergedAfter);

    // Select the merged cell overlay
    this.setSelection(new Set([`${this.mergeLeafPrefix}${regionId}`]));
    this.cdr.markForCheck();
  }

  private applyUnmergeSelection(): void {
    this.syncCellContent();

    const selection = Array.from(this.selectedCells());
    const regions = this.localMergedRegions();

    let region: TableMergedRegion | undefined;
    if (selection.length === 1 && selection[0].startsWith(this.mergeLeafPrefix)) {
      const { regionId } = this.parseMergeLeafId(selection[0]);
      region = regions.find(r => r.id === regionId);
    } else {
      // If selection hits a covered leaf, unmerge that region
      for (const leaf of selection) {
        const hit = regions.find(r => r.leafIds.includes(leaf));
        if (hit) {
          region = hit;
          break;
        }
      }
    }

    if (!region) return;

    // Remove region
    const remaining = regions.filter(r => r.id !== region!.id);
    this.localMergedRegions.set(this.cloneMergedRegions(remaining));

    // Put merged content back into anchor
    this.localRows.update((rows) => {
      const newRows = this.cloneRows(rows);
      this.setLeafCellContent(newRows, region!.anchorLeafId, this.serializeMergedRegionContent(region!) || '');
      return newRows;
    });

    const rowsAfter = this.localRows();
    const mergedAfter = this.localMergedRegions();
    this.propsChange.emit({ rows: rowsAfter, mergedRegions: mergedAfter });
    this.rowsAtEditStart = this.cloneRows(rowsAfter);
    this.mergedRegionsAtEditStart = this.cloneMergedRegions(mergedAfter);

    // Select the anchor leaf after unmerge
    this.setSelection(new Set([region.anchorLeafId]));
    this.cdr.markForCheck();
  }

  private getLeafCellById(leafId: string): TableCell | null {
    const parts = leafId.split('-');
    if (parts.length < 2) return null;
    const r = Number(parts[0]);
    const c = Number(parts[1]);
    const path = parts.slice(2).map(Number);
    const base = this.localRows()?.[r]?.cells?.[c];
    if (!base) return null;
    return path.length === 0 ? base : this.getCellAtPath(base, path);
  }

  private setLeafCellContent(rows: TableRow[], leafId: string, contentHtml: string): void {
    const parts = leafId.split('-');
    if (parts.length < 2) return;
    const r = Number(parts[0]);
    const c = Number(parts[1]);
    const path = parts.slice(2).map(Number);
    const base = rows[r]?.cells?.[c];
    if (!base) return;
    const target = path.length === 0 ? base : this.getCellAtPath(base, path);
    if (!target) return;
    target.contentHtml = contentHtml;
  }

  private serializeMergedRegionContent(region: TableMergedRegion): string {
    // If not split, contentHtml is authoritative
    if (!region.split) {
      return region.contentHtml ?? '';
    }
    return this.serializeCellContent({ contentHtml: region.contentHtml ?? '', split: region.split });
  }

  private serializeCellContent(cell: { contentHtml: string; split?: { cells: TableCell[] } }): string {
    if (!cell.split) {
      return cell.contentHtml ?? '';
    }
    const parts = cell.split.cells
      .map(c => this.serializeCellContent(c))
      .map(s => (s ?? '').trim())
      .filter(Boolean);
    return parts.length > 0 ? parts.map(h => `<div>${h}</div>`).join('') : '';
  }
}

