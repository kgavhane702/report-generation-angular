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
} from '@angular/core';
import { Subscription } from 'rxjs';
import { v4 as uuid } from 'uuid';

import {
  TableWidgetProps,
  TableRow,
  TableCell,
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

  ngOnInit(): void {
    this.localRows.set(this.cloneRows(this.tableProps.rows));
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
  }

  ngOnDestroy(): void {
    if (this.isActivelyEditing()) {
      this.commitChanges();
      this.pendingChangesRegistry.unregister(this.widget.id);
    }

    if (this.splitSubscription) {
      this.splitSubscription.unsubscribe();
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
    }
  }

  hasPendingChanges(): boolean {
    if (!this.isActivelyEditing()) {
      return false;
    }
    return JSON.stringify(this.localRows()) !== JSON.stringify(this.rowsAtEditStart);
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
    this.selectedCells.set(selection);
    this.toolbarService.setSelectedCells(selection);
    this.cdr.markForCheck();
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
      if (id) selection.add(id);
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
      if (id) selection.add(id);
    });

    return selection;
  }

  private syncCellContent(): void {
    if (!this.activeCellElement || !this.activeCellId) {
      return;
    }
    
    const parts = this.activeCellId.split('-');
    const rowIndex = Number(parts[0]);
    const cellIndex = Number(parts[1]);
    const path = parts.slice(2).map(Number);
    const content = this.activeCellElement.innerHTML;
    
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

  private commitChanges(): void {
    const currentRows = this.localRows();
    const originalRows = this.rowsAtEditStart;
    
    if (JSON.stringify(currentRows) !== JSON.stringify(originalRows)) {
      this.propsChange.emit({ rows: currentRows });
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

    const before = this.cloneRows(this.localRows());

    this.localRows.update((rows) => {
      const newRows = this.cloneRows(rows);
      for (const leafId of targetLeafIds) {
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

    // Persist immediately (split is a discrete action; no blur needed)
    const after = this.localRows();
    if (JSON.stringify(after) !== JSON.stringify(before)) {
      this.propsChange.emit({ rows: after });
      // Reset baseline to avoid duplicate emits on blur
      this.rowsAtEditStart = this.cloneRows(after);
    }

    // Clear active element reference if it was replaced by split rendering
    this.activeCellElement = null;
    this.activeCellId = null;
    this.toolbarService.setActiveCell(null, this.widget.id);

    this.cdr.markForCheck();
  }
}

