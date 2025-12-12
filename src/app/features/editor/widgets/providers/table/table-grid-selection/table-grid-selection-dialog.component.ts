import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';

export interface TableGridSelectionResult {
  rows: number;
  columns: number;
  cancelled: boolean;
}

@Component({
  selector: 'app-table-grid-selection-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './table-grid-selection-dialog.component.html',
  styleUrls: ['./table-grid-selection-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableGridSelectionDialogComponent {
  @Output() closed = new EventEmitter<TableGridSelectionResult>();

  maxRows = 10;
  maxColumns = 10;
  selectedRows = 1;
  selectedColumns = 1;

  get rowsArray(): number[] {
    return Array(this.maxRows).fill(0).map((_, i) => i);
  }

  get columnsArray(): number[] {
    return Array(this.maxColumns).fill(0).map((_, i) => i);
  }

  onCellHover(row: number, col: number): void {
    this.selectedRows = row + 1;
    this.selectedColumns = col + 1;
  }

  onCellClick(row: number, col: number): void {
    this.selectedRows = row + 1;
    this.selectedColumns = col + 1;
    this.confirm();
  }

  confirm(): void {
    this.closed.emit({
      rows: this.selectedRows,
      columns: this.selectedColumns,
      cancelled: false,
    });
  }

  cancel(): void {
    this.closed.emit({
      rows: 0,
      columns: 0,
      cancelled: true,
    });
  }

  closeDialog(event?: MouseEvent): void {
    if (event) {
      const target = event.target as HTMLElement;
      if (target.classList.contains('table-grid-selection-dialog__overlay')) {
        this.cancel();
      }
    } else {
      this.cancel();
    }
  }
}

