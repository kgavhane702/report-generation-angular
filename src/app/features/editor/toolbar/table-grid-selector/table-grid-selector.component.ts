import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';

export interface TableDimensions {
  rows: number;
  columns: number;
}

/**
 * TableGridSelectorComponent
 * 
 * PPT-style animated grid selector for choosing table dimensions.
 * Hover over cells to select rows x columns, click to confirm.
 */
@Component({
  selector: 'app-table-grid-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './table-grid-selector.component.html',
  styleUrls: ['./table-grid-selector.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableGridSelectorComponent {
  @Output() tableInsert = new EventEmitter<TableDimensions>();
  @Output() close = new EventEmitter<void>();

  readonly maxRows = 10;
  readonly maxColumns = 10;
  
  /** Grid array for template iteration */
  readonly gridRows = Array.from({ length: this.maxRows }, (_, i) => i);
  readonly gridColumns = Array.from({ length: this.maxColumns }, (_, i) => i);

  /** Current hover selection */
  readonly hoverRows = signal<number>(0);
  readonly hoverColumns = signal<number>(0);

  /** Dropdown open state */
  readonly isOpen = signal<boolean>(false);

  get selectionLabel(): string {
    const rows = this.hoverRows();
    const cols = this.hoverColumns();
    if (rows === 0 || cols === 0) {
      return 'Insert Table';
    }
    return `${rows} × ${cols} Table`;
  }

  toggleDropdown(): void {
    this.isOpen.update(v => !v);
    if (!this.isOpen()) {
      this.hoverRows.set(0);
      this.hoverColumns.set(0);
    }
  }

  closeDropdown(): void {
    this.isOpen.set(false);
    this.hoverRows.set(0);
    this.hoverColumns.set(0);
    this.close.emit();
  }

  onCellHover(rowIndex: number, colIndex: number): void {
    this.hoverRows.set(rowIndex + 1);
    this.hoverColumns.set(colIndex + 1);
  }

  onCellLeave(): void {
    // Keep the last selection visible
  }

  onGridLeave(): void {
    this.hoverRows.set(0);
    this.hoverColumns.set(0);
  }

  onCellClick(rowIndex: number, colIndex: number): void {
    const dimensions: TableDimensions = {
      rows: rowIndex + 1,
      columns: colIndex + 1,
    };
    this.tableInsert.emit(dimensions);
    this.closeDropdown();
  }

  isCellSelected(rowIndex: number, colIndex: number): boolean {
    return rowIndex < this.hoverRows() && colIndex < this.hoverColumns();
  }

  onBackdropClick(event: MouseEvent): void {
    event.stopPropagation();
    this.closeDropdown();
  }
}

