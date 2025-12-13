import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { WidgetModel, AdvancedTableWidgetProps } from '../../../../models/widget.model';
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

  rows: number = 3;
  columns: number = 3;
  tableData: string[][] = [];

  // Selection state
  isSelecting = false;
  selectionStart: CellPosition | null = null;
  selectionEnd: CellPosition | null = null;
  selectedCells: CellPosition[] = [];

  constructor(
    private cdr: ChangeDetectorRef,
    private tableSelectionService: TableSelectionService
  ) {}

  ngOnInit(): void {
    if (this.widget?.props) {
      this.rows = this.widget.props.rows || 3;
      this.columns = this.widget.props.columns || 3;
      this.initializeTableData();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['widget'] && this.widget?.props) {
      const currentProps = this.widget.props;
      this.rows = currentProps.rows || 3;
      this.columns = currentProps.columns || 3;
      this.initializeTableData();
    }
  }

  ngOnDestroy(): void {
    this.stopSelection();
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
    this.cdr.markForCheck();
  }

  onCellMouseDown(event: MouseEvent, rowIndex: number, colIndex: number): void {
    // Single click for selection
    event.preventDefault();
    this.isSelecting = true;
    this.selectionStart = { row: rowIndex, col: colIndex };
    this.selectionEnd = { row: rowIndex, col: colIndex };
    this.updateSelectedCells();
    this.cdr.markForCheck();
  }

  onCellClick(rowIndex: number, colIndex: number): void {
    // Selection is handled by mousedown
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

  @HostListener('document:keydown', ['$event'])
  onDocumentKeyDown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    const isTableFocused = target.closest('.advanced-table-widget') !== null;

    if (!isTableFocused) {
      return;
    }

    // Handle Arrow keys for navigation
    if (event.key.startsWith('Arrow')) {
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

  private stopSelection(): void {
    if (this.isSelecting) {
      this.isSelecting = false;
      // Log selected cells
      this.logSelectedCells();
      // Notify selection service
      this.tableSelectionService.setSelectedCells(this.selectedCells);
    }
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

  // Public method to get current state (called by widget-container for table creation)
  getCurrentState(): {
    rows: number;
    columns: number;
    cellData: string[][];
    cellStyles: Record<string, any>;
    mergedCells?: Record<string, { rowspan: number; colspan: number }>;
  } {
    return {
      rows: this.rows,
      columns: this.columns,
      cellData: this.tableData.map(row => row.map(() => '')),
      cellStyles: {},
      mergedCells: {},
    };
  }
}
