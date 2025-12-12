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
import { WidgetModel } from '../../../../models/widget.model';
import { AdvancedTableWidgetProps } from '../../../../models/widget.model';

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

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    if (this.widget?.props) {
      this.rows = this.widget.props.rows || 3;
      this.columns = this.widget.props.columns || 3;
      this.initializeTableData();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['widget'] && this.widget?.props) {
      this.rows = this.widget.props.rows || 3;
      this.columns = this.widget.props.columns || 3;
      this.initializeTableData();
    }
  }

  ngOnDestroy(): void {
    // Clean up event listeners
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
  }

  getCellValue(rowIndex: number, colIndex: number): string {
    if (this.tableData[rowIndex] && this.tableData[rowIndex][colIndex] !== undefined) {
      return this.tableData[rowIndex][colIndex];
    }
    return '';
  }

  onCellMouseDown(event: MouseEvent, rowIndex: number, colIndex: number): void {
    event.preventDefault();
    this.isSelecting = true;
    this.selectionStart = { row: rowIndex, col: colIndex };
    this.selectionEnd = { row: rowIndex, col: colIndex };
    this.updateSelectedCells();
    this.cdr.markForCheck();
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
}

