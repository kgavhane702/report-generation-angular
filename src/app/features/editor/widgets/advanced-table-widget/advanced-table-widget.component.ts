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
import { Subscription } from 'rxjs';
import { WidgetModel, AdvancedTableWidgetProps } from '../../../../models/widget.model';
import { TableSelectionService } from '../../../../core/services/table-selection.service';
import { TableOperationsService } from '../../../../core/services/table-operations.service';
import { DocumentService } from '../../../../core/services/document.service';
import { EditorStateService } from '../../../../core/services/editor-state.service';

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
  
  // Track last saved cellData to prevent unnecessary updates
  private lastSavedCellData: string[][] | null = null;
  private subscriptions = new Subscription();

  constructor(
    private cdr: ChangeDetectorRef,
    private tableSelectionService: TableSelectionService,
    private tableOperationsService: TableOperationsService,
    private documentService: DocumentService,
    private editorState: EditorStateService
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

    // Listen to table operations
    this.subscriptions.add(
      this.tableOperationsService.operation$.subscribe(operation => {
        this.handleTableOperation(operation);
      })
    );
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['widget'] && this.widget?.props) {
      const currentProps = this.widget.props;
      const newRows = currentProps.rows || 3;
      const newColumns = currentProps.columns || 3;
      
      // Only reinitialize if dimensions changed
      const dimensionsChanged = newRows !== this.rows || newColumns !== this.columns;
      
      if (dimensionsChanged) {
        this.rows = newRows;
        this.columns = newColumns;
        this.initializeTableData();
        this.lastSavedCellData = null; // Reset when dimensions change
      }
      
      // Check if cellData actually changed to prevent unnecessary updates
      const cellDataChanged = currentProps.cellData && Array.isArray(currentProps.cellData) &&
        (!this.lastSavedCellData || JSON.stringify(this.lastSavedCellData) !== JSON.stringify(currentProps.cellData));
      
      // Update cellData from widget props if available and changed
      if (cellDataChanged && currentProps.cellData && Array.isArray(currentProps.cellData)) {
        this.updateCellDataFromProps(currentProps.cellData, dimensionsChanged);
        this.lastSavedCellData = currentProps.cellData.map(row => [...row]); // Store a copy
      }
      
      // Only update DOM if dimensions changed or cellData changed
      if (dimensionsChanged) {
        Promise.resolve().then(() => {
          this.initializeCellContents();
        });
      } else if (cellDataChanged) {
        // For content-only updates, sync DOM without full reinitialization
        Promise.resolve().then(() => {
          this.syncCellContentsFromData();
        });
      }
      // If nothing changed, don't update DOM at all - prevents flicker
    }
  }

  ngOnDestroy(): void {
    this.stopSelection();
    this.subscriptions.unsubscribe();
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
    Promise.resolve().then(() => {
      this.initializeCellContents();
    });
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
        // Only update if content is different to prevent flicker
        if (div.textContent !== content) {
          div.textContent = content;
        }
      }
    });
  }

  /**
   * Update cellData from props without full reinitialization
   * Only updates cells that actually changed
   */
  private updateCellDataFromProps(cellData: string[][], forceUpdate: boolean = false): void {
    for (let i = 0; i < this.rows && i < cellData.length; i++) {
      const sourceRow = cellData[i];
      if (Array.isArray(sourceRow)) {
        for (let j = 0; j < this.columns && j < sourceRow.length; j++) {
          if (this.tableData[i] && this.tableData[i][j] !== undefined) {
            const newContent = sourceRow[j] || '';
            // Only update if content changed to prevent unnecessary updates
            if (forceUpdate || this.tableData[i][j] !== newContent) {
              this.tableData[i][j] = newContent;
            }
          }
        }
      }
    }
  }

  /**
   * Sync cell contents from tableData without full reinitialization
   * Only updates DOM elements that actually changed
   */
  private syncCellContentsFromData(): void {
    if (!this.tableContainer) return;
    
    const editableDivs = this.tableContainer.nativeElement.querySelectorAll(
      '.advanced-table-widget__cell-editable'
    ) as NodeListOf<HTMLElement>;
    
    editableDivs.forEach((div, index) => {
      const row = Math.floor(index / this.columns);
      const col = index % this.columns;
      
      if (this.tableData[row] && this.tableData[row][col] !== undefined) {
        const expectedContent = this.tableData[row][col];
        const currentContent = div.textContent || '';
        
        // Only update if content is different to prevent flicker
        if (currentContent !== expectedContent) {
          // Preserve cursor position if the cell is being edited
          if (this.editingCell && this.editingCell.row === row && this.editingCell.col === col) {
            // Don't update if user is currently editing this cell
            return;
          }
          div.textContent = expectedContent;
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
      cellStyles: this.widget?.props?.cellStyles ? { ...this.widget.props.cellStyles } : {},
      mergedCells: this.widget?.props?.mergedCells ? { ...this.widget.props.mergedCells } : {},
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

  /**
   * Get cell style object for a specific cell
   * Converts AdvancedTableCellStyle to CSS style object
   */
  getCellStyle(row: number, col: number): Record<string, any> {
    if (!this.widget?.props?.cellStyles) {
      return {};
    }

    const key = `${row}-${col}`;
    const style = this.widget.props.cellStyles[key];
    
    if (!style) {
      return {};
    }

    const cssStyle: Record<string, any> = {};

    if (style.textAlign) {
      cssStyle['text-align'] = style.textAlign;
    }
    if (style.fontWeight) {
      cssStyle['font-weight'] = style.fontWeight;
    }
    if (style.fontStyle) {
      cssStyle['font-style'] = style.fontStyle;
    }
    if (style.textDecoration) {
      cssStyle['text-decoration'] = style.textDecoration;
    }
    if (style.fontSize) {
      cssStyle['font-size'] = `${style.fontSize}px`;
    }
    if (style.color) {
      cssStyle['color'] = style.color;
    }
    if (style.backgroundColor) {
      cssStyle['background-color'] = style.backgroundColor;
    }
    if (style.verticalAlign) {
      cssStyle['vertical-align'] = style.verticalAlign;
    }
    if (style.borderStyle || style.borderWidth || style.borderColor) {
      const borderWidth = style.borderWidth || 1;
      const borderStyle = style.borderStyle || 'solid';
      const borderColor = style.borderColor || '#000000';
      cssStyle['border'] = `${borderWidth}px ${borderStyle} ${borderColor}`;
    }

    return cssStyle;
  }

  /**
   * Handle table operations from toolbar
   */
  private handleTableOperation(operation: any): void {
    // Only handle operations if this widget is active
    const activeWidget = this.editorState.activeWidget();
    if (activeWidget?.id !== this.widget?.id) {
      return;
    }

    const subsectionId = this.editorState.activeSubsectionId();
    const pageId = this.editorState.activePageId();

    if (!subsectionId || !pageId) {
      return;
    }

    const selectedCells = this.tableSelectionService.getSelectedCells();
    if (selectedCells.length === 0) {
      return; // Need selection for operations
    }

    // Get the first selected cell as reference
    const firstCell = selectedCells[0];
    const lastCell = selectedCells[selectedCells.length - 1];
    const startRow = Math.min(firstCell.row, lastCell.row);
    const endRow = Math.max(firstCell.row, lastCell.row);
    const startCol = Math.min(firstCell.col, lastCell.col);
    const endCol = Math.max(firstCell.col, lastCell.col);

    switch (operation.type) {
      case 'insertRow':
        this.insertRow(startRow, operation.above);
        break;
      case 'deleteRow':
        this.deleteRow(startRow, endRow);
        break;
      case 'insertColumn':
        this.insertColumn(startCol, operation.left);
        break;
      case 'deleteColumn':
        this.deleteColumn(startCol, endCol);
        break;
      case 'mergeCells':
        this.mergeCells(startRow, endRow, startCol, endCol);
        break;
      case 'unmergeCells':
        this.unmergeCells(startRow, startCol);
        break;
      case 'copyCells':
        this.copyCells(startRow, endRow, startCol, endCol);
        break;
      case 'pasteCells':
        this.pasteCells(startRow, startCol);
        break;
      case 'cutCells':
        this.cutCells(startRow, endRow, startCol, endCol);
        break;
    }
  }

  private insertRow(referenceRow: number, above: boolean): void {
    const newRow = above ? referenceRow : referenceRow + 1;
    this.rows++;
    
    // Insert empty row in tableData
    const emptyRow: string[] = [];
    for (let j = 0; j < this.columns; j++) {
      emptyRow.push('');
    }
    this.tableData.splice(newRow, 0, emptyRow);

    this.updateWidget();
  }

  private deleteRow(startRow: number, endRow: number): void {
    if (this.rows <= 1) return; // Don't delete last row
    
    // Remove rows from tableData
    const count = endRow - startRow + 1;
    this.tableData.splice(startRow, count);
    this.rows -= count;

    this.updateWidget();
  }

  private insertColumn(referenceCol: number, left: boolean): void {
    const newCol = left ? referenceCol : referenceCol + 1;
    this.columns++;
    
    // Insert empty column in all rows
    this.tableData.forEach(row => {
      row.splice(newCol, 0, '');
    });

    this.updateWidget();
  }

  private deleteColumn(startCol: number, endCol: number): void {
    if (this.columns <= 1) return; // Don't delete last column
    
    // Remove columns from all rows
    const count = endCol - startCol + 1;
    this.tableData.forEach(row => {
      row.splice(startCol, count);
    });
    this.columns -= count;

    this.updateWidget();
  }

  private mergeCells(startRow: number, endRow: number, startCol: number, endCol: number): void {
    // Store merged cell info
    const mergedCells = this.widget?.props?.mergedCells || {};
    const key = `${startRow}-${startCol}`;
    
    // Calculate rowspan and colspan
    const rowspan = endRow - startRow + 1;
    const colspan = endCol - startCol + 1;

    // Merge content - combine all cell contents
    let mergedContent = '';
    for (let i = startRow; i <= endRow; i++) {
      for (let j = startCol; j <= endCol; j++) {
        if (this.tableData[i] && this.tableData[i][j]) {
          if (mergedContent) mergedContent += ' ';
          mergedContent += this.tableData[i][j];
        }
      }
    }

    // Set merged content to first cell
    if (this.tableData[startRow] && this.tableData[startRow][startCol] !== undefined) {
      this.tableData[startRow][startCol] = mergedContent;
    }

    // Update merged cells record
    const updatedMergedCells = {
      ...mergedCells,
      [key]: { rowspan, colspan }
    };

    this.updateWidget({ mergedCells: updatedMergedCells });
  }

  private unmergeCells(row: number, col: number): void {
    const mergedCells = this.widget?.props?.mergedCells || {};
    const key = `${row}-${col}`;
    
    if (mergedCells[key]) {
      const { rowspan, colspan } = mergedCells[key];
      const updatedMergedCells = { ...mergedCells };
      delete updatedMergedCells[key];

      // Clear content in unmerged cells
      const content = this.tableData[row]?.[col] || '';
      for (let i = row; i < row + rowspan; i++) {
        for (let j = col; j < col + colspan; j++) {
          if (i === row && j === col) continue;
          if (this.tableData[i] && this.tableData[i][j] !== undefined) {
            this.tableData[i][j] = '';
          }
        }
      }

      this.updateWidget({ mergedCells: updatedMergedCells });
    }
  }

  private copyCells(startRow: number, endRow: number, startCol: number, endCol: number): void {
    // Copy cell data to clipboard (simplified - could use Clipboard API)
    const copiedData: string[][] = [];
    for (let i = startRow; i <= endRow; i++) {
      const row: string[] = [];
      for (let j = startCol; j <= endCol; j++) {
        row.push(this.tableData[i]?.[j] || '');
      }
      copiedData.push(row);
    }
    
    // Store in sessionStorage for paste
    sessionStorage.setItem('tableClipboard', JSON.stringify(copiedData));
  }

  private pasteCells(startRow: number, startCol: number): void {
    const clipboardData = sessionStorage.getItem('tableClipboard');
    if (!clipboardData) return;

    try {
      const copiedData: string[][] = JSON.parse(clipboardData);
      
      // Paste data starting at selected cell
      for (let i = 0; i < copiedData.length; i++) {
        const targetRow = startRow + i;
        if (targetRow >= this.rows) break;
        
        for (let j = 0; j < copiedData[i].length; j++) {
          const targetCol = startCol + j;
          if (targetCol >= this.columns) break;
          
          if (this.tableData[targetRow] && this.tableData[targetRow][targetCol] !== undefined) {
            this.tableData[targetRow][targetCol] = copiedData[i][j];
          }
        }
      }

      this.updateWidget();
    } catch (error) {
      console.error('Error pasting cells:', error);
    }
  }

  private cutCells(startRow: number, endRow: number, startCol: number, endCol: number): void {
    // Copy first
    this.copyCells(startRow, endRow, startCol, endCol);
    
    // Then clear
    for (let i = startRow; i <= endRow; i++) {
      for (let j = startCol; j <= endCol; j++) {
        if (this.tableData[i] && this.tableData[i][j] !== undefined) {
          this.tableData[i][j] = '';
        }
      }
    }

    this.updateWidget();
  }

  /**
   * Update widget with new table structure
   */
  private updateWidget(additionalProps?: Partial<AdvancedTableWidgetProps>): void {
    const subsectionId = this.editorState.activeSubsectionId();
    const pageId = this.editorState.activePageId();

    if (!subsectionId || !pageId || !this.widget) {
      return;
    }

    // Sync data from DOM before updating
    this.syncTableDataFromDOM();

    const currentState = this.getCurrentState();
    
    this.documentService.updateWidget(subsectionId, pageId, this.widget.id, {
      props: {
        ...this.widget.props,
        rows: this.rows,
        columns: this.columns,
        cellData: currentState.cellData,
        cellStyles: currentState.cellStyles,
        mergedCells: currentState.mergedCells,
        ...additionalProps,
      } as any,
    });

    this.cdr.markForCheck();
  }
}
