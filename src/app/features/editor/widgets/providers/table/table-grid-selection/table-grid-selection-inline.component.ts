import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-table-grid-selection-inline',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './table-grid-selection-inline.component.html',
  styleUrls: ['./table-grid-selection-inline.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableGridSelectionInlineComponent {
  @Output() selected = new EventEmitter<{ rows: number; columns: number }>();
  @Output() cancelled = new EventEmitter<void>();

  maxRows = 10;
  maxColumns = 10;
  selectedRows = 1;
  selectedColumns = 1;

  constructor(private cdr: ChangeDetectorRef) {}

  get rowsArray(): number[] {
    return Array(this.maxRows).fill(0).map((_, i) => i);
  }

  get columnsArray(): number[] {
    return Array(this.maxColumns).fill(0).map((_, i) => i);
  }

  onCellHover(row: number, col: number): void {
    this.selectedRows = row + 1;
    this.selectedColumns = col + 1;
    this.cdr.markForCheck();
  }

  onCellClick(row: number, col: number): void {
    this.selectedRows = row + 1;
    this.selectedColumns = col + 1;
    this.selected.emit({
      rows: this.selectedRows,
      columns: this.selectedColumns,
    });
  }
}

