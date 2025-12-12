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

  rows: number = 3;
  columns: number = 3;
  tableData: string[][] = [];
  cellStyles: Record<string, AdvancedTableCellStyle> = {};

  // Selection state
  isSelecting = false;
  selectionStart: CellPosition | null = null;
  selectionEnd: CellPosition | null = null;
  selectedCells: CellPosition[] = [];

  // Editing state
  editingCell: CellPosition | null = null;
  editingValue: string = '';

  constructor(
    private cdr: ChangeDetectorRef,
    private tableSelectionService: TableSelectionService
  ) {}

  ngOnInit(): void {
    if (this.widget?.props) {
      this.rows = this.widget.props.rows || 3;
      this.columns = this.widget.props.columns || 3;
      this.loadTableData();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['widget'] && this.widget?.props) {
      const prevProps = changes['widget'].previousValue?.props;
      const currentProps = this.widget.props;
      
      this.rows = currentProps.rows || 3;
      this.columns = currentProps.columns || 3;
      
      // Reload data if rows/columns changed
      if (prevProps?.rows !== currentProps.rows || prevProps?.columns !== currentProps.columns) {
        this.loadTableData();
      } else {
        // Just update cell data and styles if they changed
        if (currentProps.cellData) {
          this.tableData = currentProps.cellData.map(row => [...row]);
        }
        if (currentProps.cellStyles) {
          this.cellStyles = { ...currentProps.cellStyles };
        }
        this.cdr.markForCheck();
      }
    }
  }

  ngOnDestroy(): void {
    // Clean up event listeners
    this.stopSelection();
  }

  private loadTableData(): void {
    // Load from props if available, otherwise initialize empty
    if (this.widget?.props?.cellData && 
        this.widget.props.cellData.length === this.rows &&
        this.widget.props.cellData[0]?.length === this.columns) {
      // Deep copy to avoid reference issues
      this.tableData = this.widget.props.cellData.map(row => [...row]);
    } else {
      this.initializeTableData();
    }

    // Load cell styles
    this.cellStyles = this.widget?.props?.cellStyles ? { ...this.widget.props.cellStyles } : {};
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
      return this.tableData[rowIndex][colIndex];
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
    this.tableData[rowIndex][colIndex] = value;
    
    // Emit change event
    this.cellDataChange.emit(this.tableData.map(row => [...row]));
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
}

