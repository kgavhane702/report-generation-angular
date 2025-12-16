import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { WidgetModel, AdvancedTableCellStyle, AdvancedTableWidgetProps } from '../../../../models/widget.model';
import { TableSelectionService } from '../../../../core/services/table-selection.service';
import { TableOperationsService } from '../../../../core/services/table-operations.service';
import { Subscription } from 'rxjs';

interface CellPosition {
  row: number;
  col: number;
}

@Component({
  selector: 'app-advanced-table-widget',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './advanced-table-widget.component.html',
  styleUrls: ['./advanced-table-widget.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdvancedTableWidgetComponent implements OnInit, OnChanges, OnDestroy {
  @Input() widget!: WidgetModel<AdvancedTableWidgetProps>;
  @Output() cellDataChange = new EventEmitter<string[][]>();
  @Output() cellStylesChange = new EventEmitter<Record<string, AdvancedTableCellStyle>>();
  @Output() structureChange = new EventEmitter<{
    rows: number;
    columns: number;
    cellData: string[][];
    cellStyles: Record<string, AdvancedTableCellStyle>;
    mergedCells?: Record<string, { rowspan: number; colspan: number }>;
  }>();

  rows: number = 3;
  columns: number = 3;
  tableData: string[][] = [];
  cellStyles: Record<string, AdvancedTableCellStyle> = {};
  mergedCells: Record<string, { rowspan: number; colspan: number }> = {};

  // Selection state
  isSelecting = false;
  selectionStart: CellPosition | null = null;
  selectionEnd: CellPosition | null = null;
  selectedCells: CellPosition[] = [];

  // Editing state
  editingCell: CellPosition | null = null;
  editingValue: string = '';

  private operationsSubscription?: Subscription;

  constructor(
    private cdr: ChangeDetectorRef,
    private tableSelectionService: TableSelectionService,
    private tableOperationsService: TableOperationsService
  ) {}

  ngOnInit(): void {
    if (this.widget?.props) {
      this.rows = this.widget.props.rows || 3;
      this.columns = this.widget.props.columns || 3;
      this.loadTableData();
    }

    // Subscribe to table operations
    this.operationsSubscription = this.tableOperationsService.operation$.subscribe(operation => {
      switch (operation.type) {
        case 'insertRow':
          this.insertRow(operation.above);
          break;
        case 'deleteRow':
          this.deleteRow();
          break;
        case 'insertColumn':
          this.insertColumn(operation.left);
          break;
        case 'deleteColumn':
          this.deleteColumn();
          break;
        case 'mergeCells':
          this.mergeCells();
          break;
        case 'unmergeCells':
          this.unmergeCells();
          break;
        case 'copyCells':
          this.copySelectedCells();
          break;
        case 'pasteCells':
          this.pasteCells();
          break;
        case 'cutCells':
          this.cutSelectedCells();
          break;
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['widget'] && this.widget?.props) {
      const prevProps = changes['widget'].previousValue?.props;
      const currentProps = this.widget.props;
      
      // KEY CHANGE: Don't update from external props while actively editing
      // This prevents disrupting user's editing session
      if (this.isActivelyEditing) {
        return;
      }
      
      this.rows = currentProps.rows || 3;
      this.columns = currentProps.columns || 3;
      
      // Reload data if rows/columns changed
      if (prevProps?.rows !== currentProps.rows || prevProps?.columns !== currentProps.columns) {
        this.loadTableData();
      } else {
        // Just update cell data and styles if they changed
        if (currentProps.cellData) {
          // Clean cell values when loading
          this.tableData = currentProps.cellData.map(row => 
            row.map(cell => this.cleanCellValue(cell || ''))
          );
        }
        if (currentProps.cellStyles) {
          this.cellStyles = { ...currentProps.cellStyles };
        }
        if (currentProps.mergedCells) {
          this.mergedCells = { ...currentProps.mergedCells };
        }
        this.cdr.markForCheck();
      }
    }
  }
  
  /**
   * Track if table is being actively edited/selected
   * Used to prevent external updates during user interaction
   */
  get isActivelyEditing(): boolean {
    return this.editingCell !== null || this.isSelecting || this.selectedCells.length > 0;
  }

  ngOnDestroy(): void {
    // Clean up event listeners
    this.stopSelection();
    if (this.operationsSubscription) {
      this.operationsSubscription.unsubscribe();
    }
  }

  private loadTableData(): void {
    // Load from props if available, otherwise initialize empty
    if (this.widget?.props?.cellData && 
        this.widget.props.cellData.length === this.rows &&
        this.widget.props.cellData[0]?.length === this.columns) {
      // Deep copy and clean cell values
      this.tableData = this.widget.props.cellData.map(row => 
        row.map(cell => this.cleanCellValue(cell || ''))
      );
    } else {
      this.initializeTableData();
    }

    // Load cell styles
    this.cellStyles = this.widget?.props?.cellStyles ? { ...this.widget.props.cellStyles } : {};
    
    // Load merged cells
    this.mergedCells = this.widget?.props?.mergedCells ? { ...this.widget.props.mergedCells } : {};
  }

  private initializeTableData(): void {
    this.tableData = [];
    for (let i = 0; i < this.rows; i++) {
      const row: string[] = [];
      for (let j = 0; j < this.columns; j++) {
        row.push('');
      }
      this.tableData.push(row);
    }
  }

  getCellValue(rowIndex: number, colIndex: number): string {
    if (this.tableData[rowIndex] && this.tableData[rowIndex][colIndex] !== undefined) {
      const value = this.tableData[rowIndex][colIndex];
      // Clean the value for display (remove &nbsp;)
      return this.cleanCellValue(value);
    }
    return '';
  }

  getCellStyle(rowIndex: number, colIndex: number): AdvancedTableCellStyle | undefined {
    const key = `${rowIndex}-${colIndex}`;
    return this.cellStyles[key];
  }

  onCellMouseDown(event: MouseEvent, rowIndex: number, colIndex: number): void {
    // If double-click, start editing
    if (event.detail === 2) {
      this.startEditing(rowIndex, colIndex);
      return;
    }

    // Single click for selection
    event.preventDefault();
    this.stopEditing();
    this.isSelecting = true;
    this.selectionStart = { row: rowIndex, col: colIndex };
    this.selectionEnd = { row: rowIndex, col: colIndex };
    this.updateSelectedCells();
    this.cdr.markForCheck();
  }

  onCellClick(rowIndex: number, colIndex: number): void {
    // Single click - just update selection, don't start editing
    // Editing is triggered by double-click
  }

  onCellMouseEnter(rowIndex: number, colIndex: number): void {
    if (this.isSelecting && this.selectionStart) {
      this.selectionEnd = { row: rowIndex, col: colIndex };
      this.updateSelectedCells();
      this.cdr.markForCheck();
    }
  }

  @HostListener('document:mouseup', ['$event'])
  onDocumentMouseUp(event: MouseEvent): void {
    if (this.isSelecting) {
      this.stopSelection();
    }
  }

  @HostListener('document:mousemove', ['$event'])
  onDocumentMouseMove(event: MouseEvent): void {
    // This is handled by onCellMouseEnter
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeyDown(event: KeyboardEvent): void {
    // Only handle if table is focused or a cell is being edited
    const target = event.target as HTMLElement;
    const isTableInput = target.tagName === 'INPUT' && target.hasAttribute('data-cell-input');
    const isTableFocused = target.closest('.advanced-table-widget') !== null;

    if (!isTableFocused && !isTableInput) {
      return;
    }

    // Handle Ctrl+C (Copy)
    if ((event.ctrlKey || event.metaKey) && event.key === 'c' && !event.shiftKey) {
      if (!isTableInput) {
        event.preventDefault();
        this.copySelectedCells();
      }
    }

    // Handle Ctrl+V (Paste)
    if ((event.ctrlKey || event.metaKey) && event.key === 'v' && !event.shiftKey) {
      if (!isTableInput) {
        event.preventDefault();
        this.pasteCells();
      }
    }

    // Handle Ctrl+X (Cut)
    if ((event.ctrlKey || event.metaKey) && event.key === 'x' && !event.shiftKey) {
      if (!isTableInput) {
        event.preventDefault();
        this.cutSelectedCells();
      }
    }

    // Handle Delete/Backspace to clear cell content
    if ((event.key === 'Delete' || event.key === 'Backspace') && !isTableInput) {
      if (this.selectedCells.length > 0) {
        event.preventDefault();
        this.selectedCells.forEach(cell => {
          this.tableData[cell.row][cell.col] = '';
        });
        this.cellDataChange.emit(this.tableData.map(row => [...row]));
        this.cdr.markForCheck();
      }
    }

    // Handle Arrow keys for navigation
    if (!isTableInput && (event.key.startsWith('Arrow') || event.key === 'Enter' || event.key === 'Tab')) {
      if (this.selectedCells.length > 0) {
        const firstCell = this.selectedCells[0];
        let newRow = firstCell.row;
        let newCol = firstCell.col;

        switch (event.key) {
          case 'ArrowUp':
            event.preventDefault();
            newRow = Math.max(0, newRow - 1);
            break;
          case 'ArrowDown':
            event.preventDefault();
            newRow = Math.min(this.rows - 1, newRow + 1);
            break;
          case 'ArrowLeft':
            event.preventDefault();
            newCol = Math.max(0, newCol - 1);
            break;
          case 'ArrowRight':
            event.preventDefault();
            newCol = Math.min(this.columns - 1, newCol + 1);
            break;
        }

        if (newRow !== firstCell.row || newCol !== firstCell.col) {
          this.selectionStart = { row: newRow, col: newCol };
          this.selectionEnd = { row: newRow, col: newCol };
          this.selectedCells = [{ row: newRow, col: newCol }];
          this.cdr.markForCheck();
        }
      }
    }

    // Handle Ctrl+A to select all
    if ((event.ctrlKey || event.metaKey) && event.key === 'a' && !event.shiftKey) {
      if (isTableFocused && !isTableInput) {
        event.preventDefault();
        this.selectedCells = [];
        for (let i = 0; i < this.rows; i++) {
          for (let j = 0; j < this.columns; j++) {
            this.selectedCells.push({ row: i, col: j });
          }
        }
        this.selectionStart = { row: 0, col: 0 };
        this.selectionEnd = { row: this.rows - 1, col: this.columns - 1 };
        this.cdr.markForCheck();
      }
    }

  }

  private stopSelection(): void {
    if (this.isSelecting) {
      this.isSelecting = false;
      this.logSelectedCells();
      // Notify selection service
      this.tableSelectionService.setSelectedCells(this.selectedCells);
    }
  }

  private updateSelectedCells(): void {
    if (!this.selectionStart || !this.selectionEnd) {
      this.selectedCells = [];
      return;
    }

    const startRow = Math.min(this.selectionStart.row, this.selectionEnd.row);
    const endRow = Math.max(this.selectionStart.row, this.selectionEnd.row);
    const startCol = Math.min(this.selectionStart.col, this.selectionEnd.col);
    const endCol = Math.max(this.selectionStart.col, this.selectionEnd.col);

    this.selectedCells = [];
    for (let i = startRow; i <= endRow; i++) {
      for (let j = startCol; j <= endCol; j++) {
        this.selectedCells.push({ row: i, col: j });
      }
    }
  }

  isCellSelected(rowIndex: number, colIndex: number): boolean {
    return this.selectedCells.some(
      (cell) => cell.row === rowIndex && cell.col === colIndex
    );
  }

  private logSelectedCells(): void {
    console.log('Selected Cells:', this.selectedCells);
    console.log('Selection Range:', {
      start: this.selectionStart,
      end: this.selectionEnd,
      count: this.selectedCells.length,
    });
    
    // Also log cell coordinates in a readable format
    if (this.selectedCells.length > 0) {
      const cellRefs = this.selectedCells.map((cell) => `R${cell.row + 1}C${cell.col + 1}`);
      console.log('Cell References:', cellRefs.join(', '));
    }
  }

  // Cell editing methods
  startEditing(rowIndex: number, colIndex: number): void {
    this.editingCell = { row: rowIndex, col: colIndex };
    this.editingValue = this.getCellValue(rowIndex, colIndex);
    this.cdr.markForCheck();
    
    // Focus the input after view update
    setTimeout(() => {
      const input = document.querySelector(`[data-cell-input="${rowIndex}-${colIndex}"]`) as HTMLInputElement;
      if (input) {
        input.focus();
        input.select();
      }
    }, 0);
  }

  stopEditing(): void {
    if (this.editingCell) {
      this.saveCellValue(this.editingCell.row, this.editingCell.col, this.editingValue);
      this.editingCell = null;
      this.editingValue = '';
      this.cdr.markForCheck();
    }
  }

  isCellEditing(rowIndex: number, colIndex: number): boolean {
    return this.editingCell?.row === rowIndex && this.editingCell?.col === colIndex;
  }

  onCellInputChange(value: string): void {
    this.editingValue = value;
  }

  onCellInputBlur(): void {
    this.stopEditing();
  }

  onCellInputKeyDown(event: KeyboardEvent, rowIndex: number, colIndex: number): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.stopEditing();
      // Move to next row, same column
      if (rowIndex < this.rows - 1) {
        this.startEditing(rowIndex + 1, colIndex);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.editingCell = null;
      this.editingValue = '';
      this.cdr.markForCheck();
    } else if (event.key === 'Tab') {
      event.preventDefault();
      this.stopEditing();
      // Move to next column, wrap to next row if needed
      if (colIndex < this.columns - 1) {
        this.startEditing(rowIndex, colIndex + 1);
      } else if (rowIndex < this.rows - 1) {
        this.startEditing(rowIndex + 1, 0);
      }
    }
  }

  private saveCellValue(rowIndex: number, colIndex: number, value: string): void {
    if (!this.tableData[rowIndex]) {
      this.tableData[rowIndex] = [];
    }
    // Clean the value - remove &nbsp; and trim whitespace
    const cleanedValue = this.cleanCellValue(value);
    this.tableData[rowIndex][colIndex] = cleanedValue;
    
    // Emit change event with cleaned values
    const cleanedCellData = this.tableData.map(row => 
      row.map(cell => this.cleanCellValue(cell || ''))
    );
    this.cellDataChange.emit(cleanedCellData);
  }

  private cleanCellValue(value: string): string {
    if (!value) {
      return '';
    }
    // Remove &nbsp; (both HTML entity and literal string)
    let cleaned = value.replace(/&nbsp;/g, '');
    cleaned = cleaned.replace(/&nbsp;/gi, ''); // Case insensitive
    // Remove all whitespace-only content
    cleaned = cleaned.trim();
    // If result is empty or only whitespace, return empty string
    return cleaned.length === 0 ? '' : cleaned;
  }

  // Style methods
  applyStyleToSelectedCells(style: Partial<AdvancedTableCellStyle>): void {
    this.selectedCells.forEach(cell => {
      const key = `${cell.row}-${cell.col}`;
      this.cellStyles[key] = {
        ...this.cellStyles[key],
        ...style,
      };
    });
    this.cellStylesChange.emit({ ...this.cellStyles });
    this.cdr.markForCheck();
  }

  // Structure operation methods
  insertRow(above: boolean = false): void {
    if (this.selectedCells.length === 0) {
      return;
    }

    const targetRow = above 
      ? Math.min(...this.selectedCells.map(c => c.row))
      : Math.max(...this.selectedCells.map(c => c.row)) + 1;

    // Insert new row
    const newRow: string[] = [];
    for (let j = 0; j < this.columns; j++) {
      newRow.push('');
    }
    this.tableData.splice(targetRow, 0, newRow);
    this.rows++;

    // Update cell styles keys (shift rows down)
    const updatedStyles: Record<string, AdvancedTableCellStyle> = {};
    const updatedMergedCells: Record<string, { rowspan: number; colspan: number }> = {};
    
    Object.keys(this.cellStyles).forEach(key => {
      const [row, col] = key.split('-').map(Number);
      if (row >= targetRow) {
        updatedStyles[`${row + 1}-${col}`] = this.cellStyles[key];
      } else {
        updatedStyles[key] = this.cellStyles[key];
      }
    });

    Object.keys(this.mergedCells).forEach(key => {
      const [row, col] = key.split('-').map(Number);
      if (row >= targetRow) {
        updatedMergedCells[`${row + 1}-${col}`] = this.mergedCells[key];
      } else {
        updatedMergedCells[key] = this.mergedCells[key];
      }
    });

    this.cellStyles = updatedStyles;
    this.mergedCells = updatedMergedCells;

    // Update selection
    this.selectedCells = this.selectedCells.map(cell => ({
      row: cell.row >= targetRow ? cell.row + 1 : cell.row,
      col: cell.col,
    }));

    this.emitStructureChange();
  }

  deleteRow(): void {
    if (this.selectedCells.length === 0 || this.rows <= 1) {
      return;
    }

    const rowsToDelete = new Set(this.selectedCells.map(c => c.row));
    const sortedRows = Array.from(rowsToDelete).sort((a, b) => b - a); // Delete from bottom to top

    sortedRows.forEach(rowIndex => {
      if (this.rows > 1) {
        this.tableData.splice(rowIndex, 1);
        this.rows--;

        // Update cell styles keys (shift rows up)
        const updatedStyles: Record<string, AdvancedTableCellStyle> = {};
        const updatedMergedCells: Record<string, { rowspan: number; colspan: number }> = {};
        
        Object.keys(this.cellStyles).forEach(key => {
          const [row, col] = key.split('-').map(Number);
          if (row > rowIndex) {
            updatedStyles[`${row - 1}-${col}`] = this.cellStyles[key];
          } else if (row !== rowIndex) {
            updatedStyles[key] = this.cellStyles[key];
          }
        });

        Object.keys(this.mergedCells).forEach(key => {
          const [row, col] = key.split('-').map(Number);
          if (row > rowIndex) {
            updatedMergedCells[`${row - 1}-${col}`] = this.mergedCells[key];
          } else if (row !== rowIndex) {
            updatedMergedCells[key] = this.mergedCells[key];
          }
        });

        this.cellStyles = updatedStyles;
        this.mergedCells = updatedMergedCells;
      }
    });

    // Clear selection
    this.selectedCells = [];
    this.selectionStart = null;
    this.selectionEnd = null;

    this.emitStructureChange();
  }

  insertColumn(left: boolean = false): void {
    if (this.selectedCells.length === 0) {
      return;
    }

    const targetCol = left
      ? Math.min(...this.selectedCells.map(c => c.col))
      : Math.max(...this.selectedCells.map(c => c.col)) + 1;

    // Insert new column
    this.tableData.forEach(row => {
      row.splice(targetCol, 0, '');
    });
    this.columns++;

    // Update cell styles keys (shift columns right)
    const updatedStyles: Record<string, AdvancedTableCellStyle> = {};
    const updatedMergedCells: Record<string, { rowspan: number; colspan: number }> = {};
    
    Object.keys(this.cellStyles).forEach(key => {
      const [row, col] = key.split('-').map(Number);
      if (col >= targetCol) {
        updatedStyles[`${row}-${col + 1}`] = this.cellStyles[key];
      } else {
        updatedStyles[key] = this.cellStyles[key];
      }
    });

    Object.keys(this.mergedCells).forEach(key => {
      const [row, col] = key.split('-').map(Number);
      if (col >= targetCol) {
        updatedMergedCells[`${row}-${col + 1}`] = this.mergedCells[key];
      } else {
        updatedMergedCells[key] = this.mergedCells[key];
      }
    });

    this.cellStyles = updatedStyles;
    this.mergedCells = updatedMergedCells;

    // Update selection
    this.selectedCells = this.selectedCells.map(cell => ({
      row: cell.row,
      col: cell.col >= targetCol ? cell.col + 1 : cell.col,
    }));

    this.emitStructureChange();
  }

  deleteColumn(): void {
    if (this.selectedCells.length === 0 || this.columns <= 1) {
      return;
    }

    const colsToDelete = new Set(this.selectedCells.map(c => c.col));
    const sortedCols = Array.from(colsToDelete).sort((a, b) => b - a); // Delete from right to left

    sortedCols.forEach(colIndex => {
      if (this.columns > 1) {
        this.tableData.forEach(row => {
          row.splice(colIndex, 1);
        });
        this.columns--;

        // Update cell styles keys (shift columns left)
        const updatedStyles: Record<string, AdvancedTableCellStyle> = {};
        const updatedMergedCells: Record<string, { rowspan: number; colspan: number }> = {};
        
        Object.keys(this.cellStyles).forEach(key => {
          const [row, col] = key.split('-').map(Number);
          if (col > colIndex) {
            updatedStyles[`${row}-${col - 1}`] = this.cellStyles[key];
          } else if (col !== colIndex) {
            updatedStyles[key] = this.cellStyles[key];
          }
        });

        Object.keys(this.mergedCells).forEach(key => {
          const [row, col] = key.split('-').map(Number);
          if (col > colIndex) {
            updatedMergedCells[`${row}-${col - 1}`] = this.mergedCells[key];
          } else if (col !== colIndex) {
            updatedMergedCells[key] = this.mergedCells[key];
          }
        });

        this.cellStyles = updatedStyles;
        this.mergedCells = updatedMergedCells;
      }
    });

    // Clear selection
    this.selectedCells = [];
    this.selectionStart = null;
    this.selectionEnd = null;

    this.emitStructureChange();
  }

  mergeCells(): void {
    if (this.selectedCells.length < 2) {
      return;
    }

    const rows = this.selectedCells.map(c => c.row);
    const cols = this.selectedCells.map(c => c.col);
    const minRow = Math.min(...rows);
    const maxRow = Math.max(...rows);
    const minCol = Math.min(...cols);
    const maxCol = Math.max(...cols);

    const rowspan = maxRow - minRow + 1;
    const colspan = maxCol - minCol + 1;

    // Store merged cell info
    const key = `${minRow}-${minCol}`;
    this.mergedCells[key] = { rowspan, colspan };

    // Preserve data from top-left cell
    const topLeftData = this.tableData[minRow][minCol];
    
    // Clear data from other cells in the merge range
    for (let i = minRow; i <= maxRow; i++) {
      for (let j = minCol; j <= maxCol; j++) {
        if (i !== minRow || j !== minCol) {
          this.tableData[i][j] = '';
          // Remove styles from merged cells (keep only top-left)
          const cellKey = `${i}-${j}`;
          delete this.cellStyles[cellKey];
        }
      }
    }

    // Update selection to only the top-left cell
    this.selectedCells = [{ row: minRow, col: minCol }];
    this.selectionStart = { row: minRow, col: minCol };
    this.selectionEnd = { row: minRow, col: minCol };

    this.emitStructureChange();
  }

  unmergeCells(): void {
    if (this.selectedCells.length === 0) {
      return;
    }

    // Unmerge all selected cells
    this.selectedCells.forEach(cell => {
      const key = `${cell.row}-${cell.col}`;
      if (this.mergedCells[key]) {
        delete this.mergedCells[key];
      }
    });

    this.emitStructureChange();
  }

  private emitStructureChange(): void {
    // Clean all cell values before emitting
    const cleanedCellData = this.tableData.map(row => 
      row.map(cell => this.cleanCellValue(cell || ''))
    );
    
    this.structureChange.emit({
      rows: this.rows,
      columns: this.columns,
      cellData: cleanedCellData,
      cellStyles: { ...this.cellStyles },
      mergedCells: { ...this.mergedCells },
    });
    this.cdr.markForCheck();
  }

  isCellMerged(rowIndex: number, colIndex: number): boolean {
    // Check if this cell is part of a merged cell
    for (const [key, merge] of Object.entries(this.mergedCells)) {
      const [mergeRow, mergeCol] = key.split('-').map(Number);
      if (rowIndex >= mergeRow && rowIndex < mergeRow + merge.rowspan &&
          colIndex >= mergeCol && colIndex < mergeCol + merge.colspan) {
        return true;
      }
    }
    return false;
  }

  getCellMergeInfo(rowIndex: number, colIndex: number): { rowspan: number; colspan: number } | null {
    // Check if this is the top-left cell of a merged cell
    const key = `${rowIndex}-${colIndex}`;
    return this.mergedCells[key] || null;
  }

  shouldRenderCell(rowIndex: number, colIndex: number): boolean {
    // Don't render cells that are part of a merged cell (except the top-left)
    for (const [key, merge] of Object.entries(this.mergedCells)) {
      const [mergeRow, mergeCol] = key.split('-').map(Number);
      if (rowIndex >= mergeRow && rowIndex < mergeRow + merge.rowspan &&
          colIndex >= mergeCol && colIndex < mergeCol + merge.colspan) {
        // Only render the top-left cell
        return rowIndex === mergeRow && colIndex === mergeCol;
      }
    }
    return true;
  }

  // Copy/Paste methods
  copySelectedCells(): void {
    if (this.selectedCells.length === 0) {
      return;
    }

    const rows = this.selectedCells.map(c => c.row);
    const cols = this.selectedCells.map(c => c.col);
    const minRow = Math.min(...rows);
    const maxRow = Math.max(...rows);
    const minCol = Math.min(...cols);
    const maxCol = Math.max(...cols);

    // Extract data from selected range (getCellValue already cleans the values)
    const copiedData: string[][] = [];
    for (let i = minRow; i <= maxRow; i++) {
      const row: string[] = [];
      for (let j = minCol; j <= maxCol; j++) {
        row.push(this.getCellValue(i, j));
      }
      copiedData.push(row);
    }

    // Store in clipboard as JSON
    const clipboardData = {
      type: 'advanced-table-cells',
      data: copiedData,
      rows: maxRow - minRow + 1,
      cols: maxCol - minCol + 1,
    };

    // Use Clipboard API if available
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(JSON.stringify(clipboardData)).catch(err => {
        console.error('Failed to copy to clipboard:', err);
        // Fallback to storing in memory
        this.copiedData = clipboardData;
      });
    } else {
      // Fallback: store in memory
      this.copiedData = clipboardData;
    }
  }

  private copiedData: { type: string; data: string[][]; rows: number; cols: number } | null = null;

  async pasteCells(): Promise<void> {
    let clipboardData: { type: string; data: string[][]; rows: number; cols: number } | null = null;

    // Try to read from clipboard
    if (navigator.clipboard && navigator.clipboard.readText) {
      try {
        const text = await navigator.clipboard.readText();
        const parsed = JSON.parse(text);
        if (parsed.type === 'advanced-table-cells') {
          clipboardData = parsed;
        }
      } catch (err) {
        // If clipboard read fails, try memory fallback
        clipboardData = this.copiedData;
      }
    } else {
      // Fallback: use memory
      clipboardData = this.copiedData;
    }

    if (!clipboardData || clipboardData.data.length === 0) {
      return;
    }

    // Determine paste target
    let targetRow = 0;
    let targetCol = 0;

    if (this.selectedCells.length > 0) {
      targetRow = Math.min(...this.selectedCells.map(c => c.row));
      targetCol = Math.min(...this.selectedCells.map(c => c.col));
    } else if (this.editingCell) {
      targetRow = this.editingCell.row;
      targetCol = this.editingCell.col;
    }

    // Paste data
    const sourceRows = clipboardData.rows;
    const sourceCols = clipboardData.cols;

    for (let i = 0; i < sourceRows; i++) {
      const targetRowIndex = targetRow + i;
      if (targetRowIndex >= this.rows) {
        // Add new rows if needed
        const newRow: string[] = [];
        for (let j = 0; j < this.columns; j++) {
          newRow.push('');
        }
        this.tableData.push(newRow);
        this.rows++;
      }

      for (let j = 0; j < sourceCols; j++) {
        const targetColIndex = targetCol + j;
        if (targetColIndex >= this.columns) {
          // Add new columns if needed
          this.tableData.forEach(row => {
            row.push('');
          });
          this.columns++;
        }

        if (clipboardData.data[i] && clipboardData.data[i][j] !== undefined) {
          // Clean the pasted value
          this.tableData[targetRowIndex][targetColIndex] = this.cleanCellValue(clipboardData.data[i][j]);
        }
      }
    }

    // Update selection to pasted area
    this.selectedCells = [];
    for (let i = 0; i < sourceRows; i++) {
      for (let j = 0; j < sourceCols; j++) {
        this.selectedCells.push({
          row: targetRow + i,
          col: targetCol + j,
        });
      }
    }

    this.selectionStart = { row: targetRow, col: targetCol };
    this.selectionEnd = {
      row: targetRow + sourceRows - 1,
      col: targetCol + sourceCols - 1,
    };

    this.emitStructureChange();
  }

  cutSelectedCells(): void {
    this.copySelectedCells();
    // Clear selected cells
    this.selectedCells.forEach(cell => {
      this.tableData[cell.row][cell.col] = '';
      const key = `${cell.row}-${cell.col}`;
      delete this.cellStyles[key];
    });
    this.emitStructureChange();
  }
}

