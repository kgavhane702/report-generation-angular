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
  AfterViewInit,
  ElementRef,
  ViewChild,
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
export class AdvancedTableWidgetComponent implements OnInit, OnChanges, OnDestroy, AfterViewInit {
  @Input() widget!: WidgetModel<AdvancedTableWidgetProps>;
  @ViewChild('tableContainer', { static: false }) tableContainer?: ElementRef<HTMLElement>;

  rows: number = 3;
  columns: number = 3;
  tableData: string[][] = [];

  // Selection state
  isSelecting = false;
  selectionStart: CellPosition | null = null;
  selectionEnd: CellPosition | null = null;
  selectedCells: CellPosition[] = [];

  // Track which cell is currently being edited to prevent content updates
  editingCell: CellPosition | null = null;

  constructor(
    private cdr: ChangeDetectorRef,
    private tableSelectionService: TableSelectionService
  ) {}

  ngOnInit(): void {
    if (this.widget?.props) {
      this.rows = this.widget.props.rows || 3;
      this.columns = this.widget.props.columns || 3;
      this.initializeTableData();
      
      // Load existing cellData from widget props if available
      if (this.widget.props.cellData && Array.isArray(this.widget.props.cellData)) {
        // Ensure tableData matches the dimensions
        for (let i = 0; i < this.rows && i < this.widget.props.cellData.length; i++) {
          const sourceRow = this.widget.props.cellData[i];
          if (Array.isArray(sourceRow)) {
            for (let j = 0; j < this.columns && j < sourceRow.length; j++) {
              if (this.tableData[i] && this.tableData[i][j] !== undefined) {
                this.tableData[i][j] = sourceRow[j] || '';
              }
            }
          }
        }
      }
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['widget'] && this.widget?.props) {
      const currentProps = this.widget.props;
      this.rows = currentProps.rows || 3;
      this.columns = currentProps.columns || 3;
      this.initializeTableData();
      
      // Load existing cellData from widget props if available
      if (currentProps.cellData && Array.isArray(currentProps.cellData)) {
        // Ensure tableData matches the dimensions
        for (let i = 0; i < this.rows && i < currentProps.cellData.length; i++) {
          const sourceRow = currentProps.cellData[i];
          if (Array.isArray(sourceRow)) {
            for (let j = 0; j < this.columns && j < sourceRow.length; j++) {
              if (this.tableData[i] && this.tableData[i][j] !== undefined) {
                this.tableData[i][j] = sourceRow[j] || '';
              }
            }
          }
        }
      }
      
      // Reinitialize cell contents after data changes
      setTimeout(() => {
        this.initializeCellContents();
      }, 0);
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

  ngAfterViewInit(): void {
    // Initialize content for all editable cells after view is initialized
    setTimeout(() => {
      this.initializeCellContents();
    }, 0);
  }

  private initializeCellContents(): void {
    if (!this.tableContainer) return;
    
    const editableDivs = this.tableContainer.nativeElement.querySelectorAll(
      '.advanced-table-widget__cell-editable'
    ) as NodeListOf<HTMLElement>;
    
    editableDivs.forEach((div, index) => {
      const row = Math.floor(index / this.columns);
      const col = index % this.columns;
      
      if (this.tableData[row] && this.tableData[row][col] !== undefined) {
        const content = this.tableData[row][col];
        if (content && !div.textContent) {
          div.textContent = content;
        }
      }
    });
  }

  onCellMouseDown(event: MouseEvent, rowIndex: number, colIndex: number): void {
    // Don't prevent default if clicking on the editable div
    const target = event.target as HTMLElement;
    if (target.classList.contains('advanced-table-widget__cell-editable')) {
      // Allow the editable div to handle the event
      return;
    }
    
    // Single click for selection (only on cell, not editable content)
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

  onCellContentChange(event: Event, rowIndex: number, colIndex: number): void {
    const target = event.target as HTMLElement;
    const newContent = target.textContent || '';
    
    // Update the tableData array
    if (this.tableData[rowIndex] && this.tableData[rowIndex][colIndex] !== undefined) {
      // Only update if content actually changed to minimize unnecessary updates
      if (this.tableData[rowIndex][colIndex] !== newContent) {
        this.tableData[rowIndex][colIndex] = newContent;
      }
    }
    
    // Don't trigger change detection during editing to prevent cursor jumping
    // Change detection will happen on blur
  }

  onCellBlur(event: FocusEvent, rowIndex: number, colIndex: number): void {
    const target = event.target as HTMLElement;
    const finalContent = target.textContent || '';
    
    // Ensure data is saved on blur
    if (this.tableData[rowIndex] && this.tableData[rowIndex][colIndex] !== undefined) {
      this.tableData[rowIndex][colIndex] = finalContent;
    }
    
    // Clear editing state
    this.editingCell = null;
    
    // Trigger change detection after editing is complete
    this.cdr.markForCheck();
  }

  onCellFocus(event: FocusEvent, rowIndex: number, colIndex: number): void {
    // Track which cell is being edited
    this.editingCell = { row: rowIndex, col: colIndex };
    
    // Set initial content from data model if editable div is empty
    const target = event.target as HTMLElement;
    const cellData = this.tableData[rowIndex] && this.tableData[rowIndex][colIndex] 
      ? this.tableData[rowIndex][colIndex] 
      : '';
    
    // Only set content if the div is empty or content doesn't match (to avoid cursor jumping)
    if (!target.textContent || target.textContent.trim() === '') {
      target.textContent = cellData;
    }
  }

  getCellContent(rowIndex: number, colIndex: number): string {
    // Return the stored content
    // Angular's change detection will only update if the value actually changed
    // and we prevent updates during editing by not triggering change detection
    return this.tableData[rowIndex] && this.tableData[rowIndex][colIndex] 
      ? this.tableData[rowIndex][colIndex] 
      : '';
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

  // Public method to get current state (called by widget-container for saving)
  // This is called when widget is dragged, resized, or when save is triggered
  getCurrentState(): {
    rows: number;
    columns: number;
    cellData: string[][];
    cellStyles: Record<string, any>;
    mergedCells?: Record<string, { rowspan: number; colspan: number }>;
  } {
    // Update tableData from DOM before returning state
    this.syncTableDataFromDOM();
    
    return {
      rows: this.rows,
      columns: this.columns,
      cellData: this.tableData.map(row => [...row]), // Return a copy of the actual data
      cellStyles: {},
      mergedCells: {},
    };
  }

  /**
   * Sync tableData from DOM contenteditable divs
   * This ensures we have the latest content before saving
   */
  private syncTableDataFromDOM(): void {
    if (!this.tableContainer) return;
    
    const editableDivs = this.tableContainer.nativeElement.querySelectorAll(
      '.advanced-table-widget__cell-editable'
    ) as NodeListOf<HTMLElement>;
    
    editableDivs.forEach((div, index) => {
      const row = Math.floor(index / this.columns);
      const col = index % this.columns;
      
      if (this.tableData[row] && this.tableData[row][col] !== undefined) {
        const content = div.textContent || '';
        this.tableData[row][col] = content;
      }
    });
  }
}
