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

import {
  TableWidgetProps,
  TableRow,
  TableCell,
  WidgetModel,
} from '../../../../models/widget.model';
import { TableToolbarService } from '../../../../core/services/table-toolbar.service';
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
  }

  ngOnDestroy(): void {
    if (this.isActivelyEditing()) {
      this.commitChanges();
      this.pendingChangesRegistry.unregister(this.widget.id);
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

  onCellFocus(event: FocusEvent, rowIndex: number, cellIndex: number): void {
    const cell = event.target as HTMLElement;
    this.activeCellElement = cell;
    this.activeCellId = `${rowIndex}-${cellIndex}`;
    
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

  onCellBlur(event: FocusEvent, rowIndex: number, cellIndex: number): void {
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

  onCellInput(event: Event, rowIndex: number, cellIndex: number): void {
    // Content is synced on blur to avoid frequent updates
    this.cdr.markForCheck();
  }

  onCellKeydown(event: KeyboardEvent, rowIndex: number, cellIndex: number): void {
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
        const nextCell = this.tableContainer?.nativeElement
          .querySelector(`[data-cell="${nextRowIndex}-${nextCellIndex}"]`) as HTMLElement;
        if (nextCell) {
          nextCell.focus();
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
    // Check if click is outside the table
    if (this.tableContainer?.nativeElement && !this.tableContainer.nativeElement.contains(event.target as Node)) {
      this.clearSelection();
    }
  };

  private handleDocumentMouseUp = (): void => {
    if (this.isSelecting) {
      this.isSelecting = false;
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
    this.cdr.markForCheck();
  }

  clearSelection(): void {
    this.selectedCells.set(new Set());
    this.selectionStart = null;
    this.selectionEnd = null;
    this.isSelecting = false;
    this.cdr.markForCheck();
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
      const cell = this.tableContainer?.nativeElement.querySelector(
        `[data-cell="${cellId}"] .table-widget__cell-content`
      ) as HTMLElement;
      if (cell) {
        elements.push(cell);
      }
    });
    return elements;
  }

  private syncCellContent(): void {
    if (!this.activeCellElement || !this.activeCellId) {
      return;
    }
    
    const [rowIndex, cellIndex] = this.activeCellId.split('-').map(Number);
    const content = this.activeCellElement.innerHTML;
    
    this.localRows.update(rows => {
      const newRows = this.cloneRows(rows);
      if (newRows[rowIndex] && newRows[rowIndex].cells[cellIndex]) {
        newRows[rowIndex].cells[cellIndex].contentHtml = content;
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
    return rows.map(row => ({
      ...row,
      cells: row.cells.map(cell => ({ ...cell, style: cell.style ? { ...cell.style } : undefined })),
    }));
  }
}

