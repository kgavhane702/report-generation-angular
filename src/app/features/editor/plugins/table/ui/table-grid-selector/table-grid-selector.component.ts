import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Output,
  signal,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppModalComponent } from '../../../../../../shared/components/modal/app-modal/app-modal.component';

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
  imports: [CommonModule, AppModalComponent],
  templateUrl: './table-grid-selector.component.html',
  styleUrls: ['./table-grid-selector.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableGridSelectorComponent {
  @Output() tableInsert = new EventEmitter<TableDimensions>();
  @Output() excelImport = new EventEmitter<File>();
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

  /** New vs Import mode */
  readonly mode = signal<'new' | 'import'>('new');

  @ViewChild('excelFileInput', { static: false }) excelFileInput?: ElementRef<HTMLInputElement>;

  /** Import dialog state */
  importDialogOpen = false;
  importFile: File | null = null;
  importFileName: string | null = null;

  get selectionLabel(): string {
    if (this.mode() === 'import') {
      return 'Import Table';
    }
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
      this.mode.set('new');
      this.hoverRows.set(0);
      this.hoverColumns.set(0);
    }
  }

  closeDropdown(): void {
    this.isOpen.set(false);
    this.mode.set('new');
    this.hoverRows.set(0);
    this.hoverColumns.set(0);
    this.close.emit();
  }

  setMode(mode: 'new' | 'import'): void {
    this.mode.set(mode);
    if (mode !== 'new') {
      this.hoverRows.set(0);
      this.hoverColumns.set(0);
    }
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

  openImportDialog(event?: MouseEvent): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    // Close the dropdown first, then open modal.
    this.closeDropdown();
    this.importDialogOpen = true;
    this.importFile = null;
    this.importFileName = null;
  }

  onExcelFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // reset immediately so selecting same file again triggers change
    input.value = '';
    if (!file) return;
    this.importFile = file;
    this.importFileName = file.name;
  }

  confirmImport(): void {
    if (!this.importFile) return;
    this.excelImport.emit(this.importFile);
    this.importDialogOpen = false;
    this.importFile = null;
    this.importFileName = null;
  }

  cancelImport(): void {
    this.importDialogOpen = false;
    this.importFile = null;
    this.importFileName = null;
  }

  isCellSelected(rowIndex: number, colIndex: number): boolean {
    return rowIndex < this.hoverRows() && colIndex < this.hoverColumns();
  }

  onBackdropClick(event: MouseEvent): void {
    event.stopPropagation();
    this.closeDropdown();
  }
}

