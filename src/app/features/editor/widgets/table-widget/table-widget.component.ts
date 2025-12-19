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
  private selectionStart: { row: number; col: number } | null = null;
  private selectionEnd: { row: number; col: number } | null = null;

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

  onCellFocus(event: FocusEvent, rowIndex: number, cellIndex: number, subCellIndex?: number): void {
    const cell = event.target as HTMLElement;
    this.activeCellElement = cell;
    this.activeCellId = subCellIndex === undefined
      ? `${rowIndex}-${cellIndex}`
      : `${rowIndex}-${cellIndex}-${subCellIndex}`;
    
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

  onCellBlur(event: FocusEvent, rowIndex: number, cellIndex: number, subCellIndex?: number): void {
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

  onCellInput(event: Event, rowIndex: number, cellIndex: number, subCellIndex?: number): void {
    // Content is synced on blur to avoid frequent updates
    this.cdr.markForCheck();
  }

  onCellKeydown(event: KeyboardEvent, rowIndex: number, cellIndex: number, subCellIndex?: number): void {
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

    // Debug: log final selection on mouseup for active table widget
    if (this.toolbarService.activeTableWidgetId === this.widget.id) {
      this.logSelectedCells('mouseUp');
    }
  };

  private handleDocumentMouseMove = (event: MouseEvent): void => {
    if (!this.isSelecting || !this.selectionStart) {
      return;
    }

    const cell = this.getCellFromPoint(event.clientX, event.clientY);
    if (cell) {
      this.selectionEnd = cell;
      this.updateSelection();
    }
  };

  onCellMouseDown(event: MouseEvent, rowIndex: number, cellIndex: number): void {
    // Only start selection on left click without focus intent
    if (event.button !== 0) return;

    // Mark this table widget as active for toolbar actions (even if no contenteditable is focused)
    this.toolbarService.setActiveCell(this.activeCellElement, this.widget.id);

    // If shift is held, extend selection
    if (event.shiftKey && this.selectionStart) {
      event.preventDefault();
      this.selectionEnd = { row: rowIndex, col: cellIndex };
      this.updateSelection();
      return;
    }

    // Start new selection
    this.isSelecting = true;
    this.selectionStart = { row: rowIndex, col: cellIndex };
    this.selectionEnd = { row: rowIndex, col: cellIndex };
    this.updateSelection();
  }

  onCellMouseEnter(event: MouseEvent, rowIndex: number, cellIndex: number): void {
    if (!this.isSelecting) return;

    this.selectionEnd = { row: rowIndex, col: cellIndex };
    this.updateSelection();
  }

  isCellSelected(rowIndex: number, cellIndex: number): boolean {
    return this.selectedCells().has(`${rowIndex}-${cellIndex}`);
  }

  private updateSelection(): void {
    if (!this.selectionStart || !this.selectionEnd) {
      return;
    }

    const minRow = Math.min(this.selectionStart.row, this.selectionEnd.row);
    const maxRow = Math.max(this.selectionStart.row, this.selectionEnd.row);
    const minCol = Math.min(this.selectionStart.col, this.selectionEnd.col);
    const maxCol = Math.max(this.selectionStart.col, this.selectionEnd.col);

    const newSelection = new Set<string>();
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        newSelection.add(`${r}-${c}`);
      }
    }

    this.selectedCells.set(newSelection);
    this.toolbarService.setSelectedCells(newSelection);
    this.cdr.markForCheck();
  }

  clearSelection(): void {
    this.selectedCells.set(new Set());
    this.toolbarService.setSelectedCells(new Set());
    this.selectionStart = null;
    this.selectionEnd = null;
    this.isSelecting = false;
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
    this.selectedCells().forEach(cellId => {
      const cellNodes = this.tableContainer?.nativeElement.querySelectorAll(
        `[data-cell="${cellId}"] .table-widget__cell-content`
      ) as NodeListOf<HTMLElement>;
      cellNodes.forEach(node => elements.push(node));
    });
    return elements;
  }

  private syncCellContent(): void {
    if (!this.activeCellElement || !this.activeCellId) {
      return;
    }
    
    const parts = this.activeCellId.split('-').map(Number);
    const rowIndex = parts[0];
    const cellIndex = parts[1];
    const subCellIndex = parts.length > 2 ? parts[2] : null;
    const content = this.activeCellElement.innerHTML;
    
    this.localRows.update(rows => {
      const newRows = this.cloneRows(rows);
      const targetCell = newRows[rowIndex]?.cells?.[cellIndex];
      if (!targetCell) {
        return newRows;
      }

      if (subCellIndex === null) {
        targetCell.contentHtml = content;
      } else {
        const splitCell = targetCell.split?.cells?.[subCellIndex];
        if (splitCell) {
          splitCell.contentHtml = content;
        }
      }
      return newRows;
    });
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
    const targets = selection.size > 0
      ? Array.from(selection)
      : (this.activeCellId ? [`${this.activeCellId.split('-')[0]}-${this.activeCellId.split('-')[1]}`] : []);

    if (targets.length === 0) {
      return;
    }

    const before = this.cloneRows(this.localRows());

    this.localRows.update((rows) => {
      const newRows = this.cloneRows(rows);
      for (const coord of targets) {
        const [r, c] = coord.split('-').map(Number);
        const cell = newRows[r]?.cells?.[c];
        if (!cell) continue;
        if (cell.split) continue;

        const childCells: TableCell[] = [];
        for (let i = 0; i < rowsCount * colsCount; i++) {
          childCells.push({
            id: `cell-${r}-${c}-${i}-${uuid()}`,
            contentHtml: '',
            style: cell.style ? { ...cell.style } : undefined,
          });
        }

        // Move existing content into the top-left cell
        childCells[0].contentHtml = cell.contentHtml || '';

        cell.split = {
          rows: rowsCount,
          cols: colsCount,
          cells: childCells,
        };
        cell.contentHtml = '';
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

