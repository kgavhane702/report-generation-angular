import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  signal,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppModalComponent } from '../../../../../../shared/components/modal/app-modal/app-modal.component';
import { HttpRequestBuilderComponent } from '../../../../../../shared/http-request/components/http-request-builder/http-request-builder.component';
import type { HttpRequestSpec } from '../../../../../../shared/http-request/models/http-request.model';
import type { TableHttpDataSourceConfig } from '../../../../../../shared/http-request/models/http-data-source.model';
import { ImportFormat } from '../../../../../../core/tabular-import/enums/import-format.enum';

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
  imports: [CommonModule, AppModalComponent, HttpRequestBuilderComponent],
  templateUrl: './table-grid-selector.component.html',
  styleUrls: ['./table-grid-selector.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableGridSelectorComponent implements OnChanges {
  /** Backend import state (provided by parent) */
  @Input() importInProgress = false;
  @Input() importError: string | null = null;

  @Output() tableInsert = new EventEmitter<TableDimensions>();
  @Output() excelImport = new EventEmitter<File>();
  @Output() urlImport = new EventEmitter<TableHttpDataSourceConfig>();
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
  importDialogMode: 'file' | 'url' = 'file';
  importFile: File | null = null;
  importFileName: string | null = null;
  private importRequested = false;
  visibleImportError: string | null = null;

  // URL import state
  urlRequest: HttpRequestSpec = {
    url: '',
    method: 'GET',
    timeoutMs: 20000,
    followRedirects: true,
    queryParams: [{ key: '', value: '', enabled: true }],
    headers: [{ key: '', value: '', enabled: true }],
  };
  urlFormat: ImportFormat | null = null;
  urlSheetIndex: number | null = null;
  urlDelimiter = '';

  readonly ImportFormat = ImportFormat;

  ngOnChanges(changes: SimpleChanges): void {
    const importInProgressChange = changes['importInProgress'];
    if (!importInProgressChange) return;

    const prev = !!importInProgressChange.previousValue;
    const cur = !!importInProgressChange.currentValue;

    // When a user-triggered import completes, close the modal on success.
    if (prev && !cur && this.importRequested) {
      this.importRequested = false;
      if (this.importError) {
        this.visibleImportError = this.importError;
      } else {
        this.importDialogOpen = false;
        this.importFile = null;
        this.importFileName = null;
        this.visibleImportError = null;
      }
    }
  }

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
    this.importDialogMode = 'file';
    this.importFile = null;
    this.importFileName = null;
    this.visibleImportError = null;
  }

  setImportDialogMode(mode: 'file' | 'url'): void {
    if (this.importInProgress) return;
    this.importDialogMode = mode;
    this.visibleImportError = null;
  }

  onExcelFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // reset immediately so selecting same file again triggers change
    input.value = '';
    if (this.importInProgress) {
      return;
    }
    if (!file) return;
    this.importFile = file;
    this.importFileName = file.name;
    this.visibleImportError = null;
  }

  confirmImport(): void {
    const file = this.importFile;
    if (!file || this.importInProgress) return;

    this.importRequested = true;
    this.visibleImportError = null;

    // Close immediately so the canvas (and placeholder widget) is visible while backend import runs.
    this.importDialogOpen = false;
    this.importFile = null;
    this.importFileName = null;

    this.excelImport.emit(file);
  }

  get canImportUrl(): boolean {
    const url = (this.urlRequest?.url ?? '').trim();
    return url.length > 0 && !this.importInProgress;
  }

  confirmUrlImport(): void {
    if (!this.canImportUrl) return;

    this.importRequested = true;
    this.visibleImportError = null;

    // Close immediately so canvas is visible while backend import runs.
    this.importDialogOpen = false;
    this.importFile = null;
    this.importFileName = null;

    const cfg: TableHttpDataSourceConfig = {
      kind: 'http',
      request: this.urlRequest,
      format: this.urlFormat ?? undefined,
      sheetIndex: this.urlSheetIndex ?? undefined,
      delimiter: this.urlDelimiter?.trim() ? this.urlDelimiter.trim() : undefined,
    };

    this.urlImport.emit(cfg);
  }

  cancelImport(): void {
    if (this.importInProgress) return;
    this.importDialogOpen = false;
    this.importFile = null;
    this.importFileName = null;
    this.importRequested = false;
    this.visibleImportError = null;
  }

  isCellSelected(rowIndex: number, colIndex: number): boolean {
    return rowIndex < this.hoverRows() && colIndex < this.hoverColumns();
  }

  onBackdropClick(event: MouseEvent): void {
    event.stopPropagation();
    this.closeDropdown();
  }
}

