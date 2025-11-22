import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  inject,
  Input,
  OnDestroy,
  Output,
} from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import {
  TableWidgetProps,
  TableColumn,
  TableRow,
} from '../../../../models/widget.model';
import {
  createDefaultTableData,
  parseCsvToTableData,
  tableDataToCsv,
} from '../../../../models/table-data.model';
import { v4 as uuid } from 'uuid';

export interface TableConfigDialogData {
  tableProps: TableWidgetProps;
  widgetId?: string;
}

export interface TableConfigDialogResult {
  tableProps: TableWidgetProps;
  cancelled: boolean;
}

@Component({
  selector: 'app-table-config-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './table-config-dialog.component.html',
  styleUrls: ['./table-config-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableConfigDialogComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly destroy$ = new Subject<void>();

  @Input() data?: TableConfigDialogData;
  @Output() closed = new EventEmitter<TableConfigDialogResult>();

  readonly cellTypes: Array<'text' | 'number' | 'currency' | 'icon'> = [
    'text',
    'number',
    'currency',
    'icon',
  ];

  readonly alignments: Array<'left' | 'center' | 'right'> = ['left', 'center', 'right'];

  form!: FormGroup;
  csvFormControl = this.fb.control('');
  showCsvImport = false;
  editingCellId: string | null = null;
  editingCellValue = '';

  ngOnInit(): void {
    const tableProps = this.data?.tableProps || {
      columns: createDefaultTableData().columns,
      rows: createDefaultTableData().rows,
      allowIconsInColumns: true,
    };
    this.initializeForm(tableProps);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeForm(tableProps: TableWidgetProps): void {
    this.form = this.fb.group({
      allowIconsInColumns: [tableProps.allowIconsInColumns !== false],
      columns: this.fb.array(
        tableProps.columns.map((col) => this.createColumnFormGroup(col))
      ),
      rows: this.fb.array(
        tableProps.rows.map((row) => this.createRowFormGroup(row))
      ),
    });

    // Initialize CSV with current data
    this.csvFormControl.setValue(this.exportToCsv());
  }

  private createColumnFormGroup(column: TableColumn = this.createDefaultColumn()): FormGroup {
    return this.fb.group({
      id: [column.id || uuid()],
      title: [column.title || '', Validators.required],
      widthPx: [column.widthPx || 120, [Validators.required, Validators.min(50)]],
      align: [column.align || 'left', Validators.required],
      cellType: [column.cellType || 'text', Validators.required],
      icon: this.fb.group({
        name: [column.icon?.name || ''],
        svg: [column.icon?.svg || ''],
        url: [column.icon?.url || ''],
      }),
    });
  }

  private createRowFormGroup(row: TableRow): FormGroup {
    const cellsArray = this.fb.array(
      row.cells.map((cell) => this.fb.control(cell))
    );
    return this.fb.group({
      id: [row.id || uuid()],
      cells: cellsArray,
    });
  }

  private createDefaultColumn(): TableColumn {
    return {
      id: uuid(),
      title: 'New Column',
      widthPx: 120,
      align: 'left',
      cellType: 'text',
    };
  }

  get columnsFormArray(): FormArray {
    return this.form.get('columns') as FormArray;
  }

  get rowsFormArray(): FormArray {
    return this.form.get('rows') as FormArray;
  }

  addColumn(): void {
    this.columnsFormArray.push(this.createColumnFormGroup());
    // Add empty cell to all existing rows
    this.rowsFormArray.controls.forEach((rowGroup) => {
      const cellsArray = rowGroup.get('cells') as FormArray;
      cellsArray.push(this.fb.control(''));
    });
  }

  removeColumn(index: number): void {
    this.columnsFormArray.removeAt(index);
    // Remove corresponding cell from all rows
    this.rowsFormArray.controls.forEach((rowGroup) => {
      const cellsArray = rowGroup.get('cells') as FormArray;
      if (cellsArray.length > index) {
        cellsArray.removeAt(index);
      }
    });
  }

  moveColumn(fromIndex: number, toIndex: number): void {
    const column = this.columnsFormArray.at(fromIndex);
    this.columnsFormArray.removeAt(fromIndex);
    this.columnsFormArray.insert(toIndex, column);
  }

  addRow(): void {
    const columnCount = this.columnsFormArray.length;
    const emptyCells = Array(columnCount).fill('');
    this.rowsFormArray.push(
      this.createRowFormGroup({ id: uuid(), cells: emptyCells })
    );
  }

  removeRow(index: number): void {
    this.rowsFormArray.removeAt(index);
  }

  getRowCellsArray(rowIndex: number): FormArray {
    const rowGroup = this.rowsFormArray.at(rowIndex) as FormGroup;
    return rowGroup.get('cells') as FormArray;
  }

  startCellEdit(rowIndex: number, cellIndex: number): void {
    const cellId = `${rowIndex}-${cellIndex}`;
    this.editingCellId = cellId;
    const cellsArray = this.getRowCellsArray(rowIndex);
    this.editingCellValue = String(cellsArray.at(cellIndex).value || '');
  }

  saveCellEdit(rowIndex: number, cellIndex: number): void {
    if (this.editingCellId === `${rowIndex}-${cellIndex}`) {
      const cellsArray = this.getRowCellsArray(rowIndex);
      const column = this.columnsFormArray.at(cellIndex).value as TableColumn;
      
      // Convert value based on cell type
      let value: unknown = this.editingCellValue;
      if (column.cellType === 'number' || column.cellType === 'currency') {
        value = parseFloat(this.editingCellValue) || 0;
      }

      cellsArray.at(cellIndex).setValue(value);
      this.cancelCellEdit();
    }
  }

  cancelCellEdit(): void {
    this.editingCellId = null;
    this.editingCellValue = '';
  }

  importFromCsv(): void {
    try {
      const csvValue = this.csvFormControl.value || '';
      const { columns, rows } = parseCsvToTableData(csvValue);
      
      // Update form with imported data
      this.columnsFormArray.clear();
      this.rowsFormArray.clear();

      columns.forEach((col) => {
        this.columnsFormArray.push(this.createColumnFormGroup(col));
      });

      rows.forEach((row) => {
        this.rowsFormArray.push(this.createRowFormGroup(row));
      });

      this.showCsvImport = false;
    } catch (error) {
      alert('Failed to parse CSV. Please check the format.');
      console.error('CSV import error:', error);
    }
  }

  exportToCsv(): string {
    const formValue = this.form.value;
    const columns: TableColumn[] = formValue.columns.map((col: any) => ({
      id: col.id,
      title: col.title,
      widthPx: col.widthPx,
      align: col.align,
      cellType: col.cellType,
      icon: col.icon?.name || col.icon?.svg || col.icon?.url ? col.icon : null,
    }));

    const rows: TableRow[] = formValue.rows.map((row: any) => ({
      id: row.id,
      cells: row.cells || [],
    }));

    return tableDataToCsv(columns, rows);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const formValue = this.form.value;
    const tableProps: TableWidgetProps = {
      columns: formValue.columns.map((col: any) => ({
        id: col.id,
        title: col.title,
        widthPx: col.widthPx,
        align: col.align,
        cellType: col.cellType,
        icon: col.icon?.name || col.icon?.svg || col.icon?.url ? col.icon : null,
      })),
      rows: formValue.rows.map((row: any) => ({
        id: row.id,
        cells: row.cells || [],
      })),
      allowIconsInColumns: formValue.allowIconsInColumns,
      styleSettings: this.data?.tableProps.styleSettings,
    };

    this.closed.emit({
      tableProps,
      cancelled: false,
    });
  }

  cancel(): void {
    this.closed.emit({
      tableProps: this.data?.tableProps || {
        columns: createDefaultTableData().columns,
        rows: createDefaultTableData().rows,
      },
      cancelled: true,
    });
  }

  closeDialog(): void {
    this.cancel();
  }
}

