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
  
  /** Track if we're actively editing */
  private readonly isActivelyEditing = signal<boolean>(false);
  
  /** Rows at edit start for comparison */
  private rowsAtEditStart: TableRow[] = [];
  
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

  get widgetId(): string {
    return this.widget.id;
  }

  get selection(): Set<string> {
    return this.selectedCells();
  }

  getRenderableRowCells(rowIndex: number): Array<{ colIndex: number; cell: TableCell }> {
    const row = this.localRows()?.[rowIndex];
    if (!row) return [];
    return row.cells
      .map((cell, colIndex) => ({ cell, colIndex }))
      .filter(({ cell }) => !cell.coveredBy);
  }

  ngOnInit(): void {
    const initialRows = this.cloneRows(this.tableProps.rows);
    const migrated = this.migrateLegacyMergedRegions(initialRows, this.tableProps.mergedRegions ?? []);
    this.localRows.set(migrated);
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
      const nextRows = this.cloneRows(this.tableProps.rows);
      const migrated = this.migrateLegacyMergedRegions(nextRows, this.tableProps.mergedRegions ?? []);
      this.localRows.set(migrated);
    }
  }

  hasPendingChanges(): boolean {
    if (!this.isActivelyEditing()) {
      return false;
    }
    const current = {
      rows: this.localRows(),
    };
    const baseline = {
      rows: this.rowsAtEditStart,
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

  trackByRenderableCell(index: number, item: { colIndex: number; cell: TableCell }): string {
    // Use the actual cell id for stable DOM reuse (even when some cells are skipped due to merges)
    return item.cell.id;
  }

  private handleDocumentMouseDown = (event: MouseEvent): void => {
    // Check if click is outside the table AND outside the table toolbar.
    // If we clear selection when the user clicks the toolbar, multi-cell actions (like Split) won't work.
    const target = event.target as Node | null;
    const isInsideTable = !!(target && this.tableContainer?.nativeElement?.contains(target));
    const toolbarElement = document.querySelector('app-table-toolbar');
    const isInsideToolbar = !!(target && toolbarElement?.contains(target));

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

    // NOTE:
    // We intentionally DO NOT early-return when a contenteditable inside this cell is focused.
    // Previously, we returned to "allow text selection by dragging", but that caused two UX bugs:
    // - Clicking different sub-cells inside the same split parent kept the previous leaf id selected/logged.
    // - If a cell was in edit mode, you couldn't start cell-selection dragging from that cell.
    // This table widget behaves more like a spreadsheet: dragging selects cells (not text).

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

    const union = new Set<string>([...normal, ...subCells]);
    this.setSelection(union);
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

    const normalized = new Set<string>();
    selection.forEach((id) => {
      const mapped = this.mapLeafIdThroughMerge(id);
      if (mapped) {
        normalized.add(mapped);
      }
    });
    return normalized;
  }

  /**
   * If an id points to a covered cell, map it to its merged anchor leaf id.
   * Otherwise, keep the id as-is.
   */
  private mapLeafIdThroughMerge(id: string): string | null {
    const parsed = this.parseLeafId(id);
    if (!parsed) return null;

    const { row, col, path } = parsed;
    const base = this.localRows()?.[row]?.cells?.[col];
    if (!base) return null;

    if (base.coveredBy) {
      // Covered cells are not rendered; normalize selection to the anchor cell.
      return `${base.coveredBy.row}-${base.coveredBy.col}`;
    }

    // Keep id (including sub-cell path) for normal / merged anchor cells.
    return path.length > 0 ? this.composeLeafId(row, col, path.join('-')) : `${row}-${col}`;
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
      selection.add(id);
    });

    return selection;
  }

  private syncCellContent(): void {
    if (!this.activeCellElement || !this.activeCellId) {
      return;
    }

    const parsed = this.parseLeafId(this.activeCellId);
    if (!parsed) return;

    const { row: rowIndex, col: cellIndex, path } = parsed;
    const content = this.activeCellElement.innerHTML;
    
    untracked(() => {
      this.localRows.update(rows => {
        const newRows = this.cloneRows(rows);
        let baseCell = newRows[rowIndex]?.cells?.[cellIndex];
        if (!baseCell) {
          return newRows;
        }

        // Safety: if a covered cell somehow gets focused, redirect updates to its anchor.
        if (baseCell.coveredBy) {
          const a = baseCell.coveredBy;
          baseCell = newRows[a.row]?.cells?.[a.col];
          if (!baseCell) return newRows;
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

  private parseLeafId(leafId: string): { row: number; col: number; path: number[] } | null {
    const parts = leafId.split('-');
    if (parts.length < 2) return null;
    const row = Number(parts[0]);
    const col = Number(parts[1]);
    if (!Number.isFinite(row) || !Number.isFinite(col)) return null;

    const path: number[] = [];
    for (const p of parts.slice(2)) {
      const n = Number(p);
      if (!Number.isFinite(n)) {
        return null;
      }
      path.push(n);
    }

    return { row, col, path };
  }

  private commitChanges(): void {
    const currentRows = this.localRows();
    const originalRows = this.rowsAtEditStart;

    if (JSON.stringify(currentRows) !== JSON.stringify(originalRows)) {
      // Always clear legacy mergedRegions when we emit, since merges are now inline on cells.
      this.propsChange.emit({ rows: currentRows, mergedRegions: [] });
    }
  }

  private cloneRows(rows: TableRow[]): TableRow[] {
    const cloneCell = (cell: TableCell): TableCell => ({
      ...cell,
      style: cell.style ? { ...cell.style } : undefined,
      merge: cell.merge ? { ...cell.merge } : undefined,
      coveredBy: cell.coveredBy ? { ...cell.coveredBy } : undefined,
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

    const beforeRows = this.cloneRows(this.localRows());

    this.localRows.update((rows) => {
      const newRows = this.cloneRows(rows);
      for (const leafId of targetLeafIds) {
        const parsed = this.parseLeafId(leafId);
        if (!parsed) continue;
        const r = parsed.row;
        const c = parsed.col;
        const path = parsed.path;

        // Limit recursion depth to keep UI and data manageable.
        // Depth is the number of indices in the path; splitting increases it by 1.
        if (path.length >= this.maxSplitDepth) {
          continue;
        }

        const baseCell = newRows[r]?.cells?.[c];
        if (!baseCell) continue;
        if (baseCell.coveredBy) continue;

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

    // Persist immediately (split is a discrete action; no blur needed)
    const afterRows = this.localRows();

    if (JSON.stringify(afterRows) !== JSON.stringify(beforeRows)) {
      this.propsChange.emit({ rows: afterRows, mergedRegions: [] });
      // Reset baseline to avoid duplicate emits on blur
      this.rowsAtEditStart = this.cloneRows(afterRows);
    }

    // Clear active element reference if it was replaced by split rendering
    this.activeCellElement = null;
    this.activeCellId = null;
    this.toolbarService.setActiveCell(null, this.widget.id);

    this.cdr.markForCheck();
  }

  private applyMergeSelection(): void {
    this.syncCellContent();

    // New behavior: treat merged cell as a real table cell (rowspan/colspan on the anchor cell).
    // We only support merging top-level cells (no split sub-cells) for now.
    const selectionIds = Array.from(this.selectedCells());
    const coords: Array<{ row: number; col: number }> = [];
    for (const id of selectionIds) {
      const parsed = this.parseLeafId(id);
      if (!parsed) continue;
      if (parsed.path.length > 0) continue; // skip sub-cells
      coords.push({ row: parsed.row, col: parsed.col });
    }

    if (coords.length < 2) return;

    const minRow = Math.min(...coords.map(x => x.row));
    const maxRow = Math.max(...coords.map(x => x.row));
    const minCol = Math.min(...coords.map(x => x.col));
    const maxCol = Math.max(...coords.map(x => x.col));

    // Ensure selection is a full rectangle of mergeable cells
    const selectedSet = new Set(coords.map(x => `${x.row}-${x.col}`));
    const rowsSnapshot = this.localRows();
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        if (!selectedSet.has(`${r}-${c}`)) return;
        const cell = rowsSnapshot?.[r]?.cells?.[c];
        if (!cell) return;
        if (cell.coveredBy) return;
        if (cell.merge) return;
        if (cell.split) return;
      }
    }

    const anchorRow = minRow;
    const anchorCol = minCol;
    const rowSpan = maxRow - minRow + 1;
    const colSpan = maxCol - minCol + 1;

    // Concatenate content in reading order
    const contentParts: Array<{ html: string; style?: TableCellStyle }> = [];
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const cell = rowsSnapshot[r].cells[c];
        const html = (cell.contentHtml ?? '').trim();
        if (html) {
          contentParts.push({ html, style: cell.style });
        }
      }
    }

    const mergedHtml = contentParts.length > 0
      ? contentParts.map(p => `<div>${p.html}</div>`).join('')
      : '';
    const mergedStyle = contentParts.length > 0 ? (contentParts[0].style ? { ...contentParts[0].style } : undefined) : undefined;

    this.localRows.update((rows) => {
      const next = this.cloneRows(rows);
      const anchor = next?.[anchorRow]?.cells?.[anchorCol];
      if (!anchor) return next;

      anchor.merge = { rowSpan, colSpan };
      anchor.contentHtml = mergedHtml;
      if (mergedStyle) {
        anchor.style = mergedStyle;
      }

      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          if (r === anchorRow && c === anchorCol) continue;
          const covered = next?.[r]?.cells?.[c];
          if (!covered) continue;
          covered.coveredBy = { row: anchorRow, col: anchorCol };
          covered.contentHtml = '';
          covered.split = undefined;
          covered.merge = undefined;
        }
      }

      return next;
    });

    const rowsAfter = this.localRows();
    this.propsChange.emit({ rows: rowsAfter, mergedRegions: [] });
    this.rowsAtEditStart = this.cloneRows(rowsAfter);

    this.setSelection(new Set([`${anchorRow}-${anchorCol}`]));
    this.cdr.markForCheck();
  }

  private applyUnmergeSelection(): void {
    this.syncCellContent();

    const selectionIds = Array.from(this.selectedCells());
    const rowsSnapshot = this.localRows();

    let anchor: { row: number; col: number } | null = null;
    for (const id of selectionIds) {
      const parsed = this.parseLeafId(id);
      if (!parsed) continue;
      const base = rowsSnapshot?.[parsed.row]?.cells?.[parsed.col];
      if (!base) continue;

      if (base.coveredBy) {
        anchor = { ...base.coveredBy };
        break;
      }
      if (base.merge) {
        anchor = { row: parsed.row, col: parsed.col };
        break;
      }
    }

    if (!anchor) return;

    this.localRows.update((rows) => {
      const next = this.cloneRows(rows);
      const anchorCell = next?.[anchor!.row]?.cells?.[anchor!.col];
      if (!anchorCell || !anchorCell.merge) return next;

      // Clear merge on anchor
      anchorCell.merge = undefined;

      // Uncover any cells covered by this anchor
      for (let r = 0; r < next.length; r++) {
        for (let c = 0; c < next[r].cells.length; c++) {
          const cell = next[r].cells[c];
          if (cell.coveredBy && cell.coveredBy.row === anchor!.row && cell.coveredBy.col === anchor!.col) {
            cell.coveredBy = undefined;
          }
        }
      }

      return next;
    });

    const rowsAfter = this.localRows();
    this.propsChange.emit({ rows: rowsAfter, mergedRegions: [] });
    this.rowsAtEditStart = this.cloneRows(rowsAfter);

    this.setSelection(new Set([`${anchor.row}-${anchor.col}`]));
    this.cdr.markForCheck();
  }

  /**
   * Legacy migration: convert overlay-style `mergedRegions` into inline cell merges.
   * Best-effort: supports top-level rectangular merges. Any legacy region split is moved onto the anchor cell as `split`.
   */
  private migrateLegacyMergedRegions(rows: TableRow[], regions: TableMergedRegion[]): TableRow[] {
    if (!regions || regions.length === 0) return rows;

    const next = this.cloneRows(rows);

    const parseTopLevel = (leafId: string): { row: number; col: number } | null => {
      const parsed = this.parseLeafId(leafId);
      if (!parsed) return null;
      return { row: parsed.row, col: parsed.col };
    };

    for (const region of regions) {
      const anchorCoord = parseTopLevel(region.anchorLeafId);
      if (!anchorCoord) continue;

      const coords = region.leafIds
        .map(parseTopLevel)
        .filter((x): x is { row: number; col: number } => !!x);

      if (coords.length < 2) continue;

      const minRow = Math.min(...coords.map(x => x.row));
      const maxRow = Math.max(...coords.map(x => x.row));
      const minCol = Math.min(...coords.map(x => x.col));
      const maxCol = Math.max(...coords.map(x => x.col));

      const rowSpan = maxRow - minRow + 1;
      const colSpan = maxCol - minCol + 1;

      const anchor = next?.[anchorCoord.row]?.cells?.[anchorCoord.col];
      if (!anchor) continue;

      anchor.merge = { rowSpan, colSpan };
      anchor.contentHtml = region.contentHtml ?? '';
      if (region.style) {
        anchor.style = { ...region.style };
      }
      if (region.split) {
        // Move legacy split grid onto the anchor cell (this is the key to fixing split-inside-merge)
        anchor.split = {
          rows: region.split.rows,
          cols: region.split.cols,
          cells: region.split.cells,
        };
        anchor.contentHtml = '';
      }

      for (const c of coords) {
        if (c.row === anchorCoord.row && c.col === anchorCoord.col) continue;
        const covered = next?.[c.row]?.cells?.[c.col];
        if (!covered) continue;
        covered.coveredBy = { row: anchorCoord.row, col: anchorCoord.col };
        covered.contentHtml = '';
        covered.split = undefined;
        covered.merge = undefined;
      }
    }

    return next;
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

