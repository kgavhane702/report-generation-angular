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
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subject, takeUntil } from 'rxjs';

import {
  TableWidgetProps,
  TableColumn,
  TableRow,
} from '../../../../models/widget.model';
import {
  TableStyleSettings,
  CellStyle,
  IconStyle,
  ColumnStyle,
  RowStyle,
} from '../../../../models/table-style.model';
import { TableTemplatesService } from './table-templates.service';
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
  private readonly templatesService = inject(TableTemplatesService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroy$ = new Subject<void>();

  @Input() data?: TableConfigDialogData;
  @Output() closed = new EventEmitter<TableConfigDialogResult>();

  readonly cellTypes: Array<'text' | 'number' | 'currency' | 'icon'> = [
    'text',
    'number',
    'currency',
    'icon',
  ];

  readonly alignments: Array<'left' | 'center' | 'right' | 'justify'> = ['left', 'center', 'right', 'justify'];
  readonly verticalAlignments: Array<'top' | 'middle' | 'bottom'> = ['top', 'middle', 'bottom'];
  readonly iconPositions: Array<'before' | 'after' | 'below' | 'above' | 'only'> = ['before', 'after', 'below', 'above', 'only'];
  readonly fontWeights: Array<'normal' | 'bold' | 'bolder' | 'lighter' | number> = ['normal', 'bold', 'bolder', 'lighter'];
  readonly fontStyles: Array<'normal' | 'italic' | 'oblique'> = ['normal', 'italic', 'oblique'];
  readonly borderStyles: Array<'solid' | 'dashed' | 'dotted' | 'none'> = ['solid', 'dashed', 'dotted', 'none'];
  readonly templates = this.templatesService.getTemplates();
  readonly availableIcons = this.templatesService.getAvailableIcons();
  
  form!: FormGroup;
  csvFormControl = this.fb.control('');
  showCsvImport = false;
  editingCellId: string | null = null;
  editingCellValue = '';
  activeTab: 'data' | 'table-style' | 'header-style' | 'column-style' | 'row-style' | 'icons' | 'templates' = 'data';
  selectedTemplate: string | null = null;
  selectedColumnIndex: number | null = 0;
  selectedRowIndex: number | null = 0;
  selectedIconColumnIndex: number | null = 0;
  showIconPicker = false;

  ngOnInit(): void {
    const tableProps = this.data?.tableProps || {
      columns: createDefaultTableData().columns,
      rows: createDefaultTableData().rows,
      allowIconsInColumns: true,
    };
    this.initializeForm(tableProps);
    
    // Initialize selected template if one exists
    if (tableProps.template) {
      this.selectedTemplate = tableProps.template;
    }
    
    // Initialize selected indices
    if (this.columnsFormArray.length > 0) {
      this.selectedColumnIndex = 0;
      this.selectedIconColumnIndex = 0;
    } else {
      this.selectedColumnIndex = null;
      this.selectedIconColumnIndex = null;
    }
    if (this.rowsFormArray.length > 0) {
      this.selectedRowIndex = 0;
    } else {
      this.selectedRowIndex = null;
    }
    
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeForm(tableProps: TableWidgetProps): void {
    const styleSettings = tableProps.styleSettings || {};
    
    this.form = this.fb.group({
      allowIconsInColumns: [tableProps.allowIconsInColumns !== false],
      template: [tableProps.template || ''],
      columns: this.fb.array(
        tableProps.columns.map((col) => this.createColumnFormGroup(col))
      ),
      rows: this.fb.array(
        tableProps.rows.map((row) => this.createRowFormGroup(row))
      ),
      // Table styling
      tableStyle: this.fb.group({
        backgroundColor: [styleSettings.backgroundColor || '#ffffff'],
        borderColor: [styleSettings.borderColor || '#000000'],
        borderWidth: [styleSettings.borderWidth ?? 1],
        borderStyle: [styleSettings.borderStyle || 'solid'],
        cellPadding: [styleSettings.cellPadding ?? 8],
        cellSpacing: [styleSettings.cellSpacing ?? 0],
        fontFamily: [styleSettings.fontFamily || 'Arial, sans-serif'],
        fontSize: [styleSettings.fontSize ?? 14],
        textColor: [styleSettings.textColor || '#000000'],
      }),
      // Header styling
      headerStyle: this.fb.group({
        showRowHeaders: [styleSettings.showRowHeaders ?? false],
        rowHeaderWidth: [styleSettings.rowHeaderWidth ?? 100],
        headerBackgroundColor: [styleSettings.headerBackgroundColor || '#f3f4f6'],
        headerTextColor: [styleSettings.headerTextColor || '#1f2937'],
        headerBorderColor: [styleSettings.headerBorderColor || ''],
        headerBorderWidth: [styleSettings.headerBorderWidth ?? 0],
        headerFontFamily: [styleSettings.headerStyle?.fontFamily || ''],
        headerFontSize: [styleSettings.headerStyle?.fontSize ?? 14],
        headerFontWeight: [styleSettings.headerStyle?.fontWeight || 'bold'],
        headerFontStyle: [styleSettings.headerStyle?.fontStyle || 'normal'],
        headerTextAlign: [styleSettings.headerStyle?.textAlign || 'left'],
        headerVerticalAlign: [styleSettings.headerStyle?.verticalAlign || 'middle'],
      }),
      // Row header styling
      rowHeaderStyle: this.fb.group({
        rowHeaderBackgroundColor: [styleSettings.rowHeaderBackgroundColor || '#f3f4f6'],
        rowHeaderTextColor: [styleSettings.rowHeaderStyle?.textColor || '#1f2937'],
        rowHeaderFontFamily: [styleSettings.rowHeaderStyle?.fontFamily || ''],
        rowHeaderFontSize: [styleSettings.rowHeaderStyle?.fontSize ?? 14],
        rowHeaderFontWeight: [styleSettings.rowHeaderStyle?.fontWeight || 'bold'],
      }),
      // Alternating colors
      alternatingColors: this.fb.group({
        alternateRowColor: [styleSettings.alternateRowColor || '#f9fafb'],
        alternateColumnColor: [styleSettings.alternateColumnColor || ''],
      }),
      // Body styling
      bodyStyle: this.fb.group({
        bodyFontFamily: [styleSettings.bodyStyle?.fontFamily || ''],
        bodyFontSize: [styleSettings.bodyStyle?.fontSize ?? 14],
        bodyFontWeight: [styleSettings.bodyStyle?.fontWeight || 'normal'],
        bodyTextColor: [styleSettings.bodyStyle?.textColor || ''],
        bodyBackgroundColor: [styleSettings.bodyStyle?.backgroundColor || ''],
      }),
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
      verticalAlign: [column.verticalAlign || 'middle'],
      isHeader: [column.isHeader ?? false],
      // Column styling
      backgroundColor: [column.backgroundColor || ''],
      textColor: [column.textColor || ''],
      fontFamily: [column.fontFamily || ''],
      fontSize: [column.fontSize ?? 14],
      fontWeight: [column.fontWeight || 'normal'],
      fontStyle: [column.fontStyle || 'normal'],
      borderColor: [column.borderColor || ''],
      borderWidth: [column.borderWidth ?? 0],
      borderStyle: [column.borderStyle || 'none'],
      padding: [column.padding ?? 8],
      // Icon configuration
      icon: this.fb.group({
        name: [column.icon?.name || ''],
        svg: [column.icon?.svg || ''],
        url: [column.icon?.url || ''],
        position: [column.icon?.position || 'before'],
        size: [column.icon?.size ?? 16],
        color: [column.icon?.color || ''],
        margin: [column.icon?.margin ?? 4],
        backgroundColor: [column.icon?.backgroundColor || ''],
        borderRadius: [column.icon?.borderRadius ?? 0],
        padding: [column.icon?.padding ?? 0],
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
      // Row styling
      isHeader: [row.isHeader ?? false],
      backgroundColor: [row.backgroundColor || ''],
      height: [row.height || null],
      minHeight: [row.minHeight || null],
      verticalAlign: [row.verticalAlign || 'middle'],
      fontFamily: [row.fontFamily || ''],
      fontSize: [row.fontSize || null],
      fontWeight: [row.fontWeight || 'normal'],
      fontStyle: [row.fontStyle || 'normal'],
      textColor: [row.textColor || ''],
      borderColor: [row.borderColor || ''],
      borderWidth: [row.borderWidth ?? 0],
      borderStyle: [row.borderStyle || 'none'],
      padding: [row.padding || null],
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

  getColumnFormGroup(index: number): FormGroup | null {
    if (index < 0 || index >= this.columnsFormArray.length) {
      return null;
    }
    return this.columnsFormArray.at(index) as FormGroup;
  }

  getRowFormGroup(index: number): FormGroup | null {
    if (index < 0 || index >= this.rowsFormArray.length) {
      return null;
    }
    return this.rowsFormArray.at(index) as FormGroup;
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

  setActiveTab(tab: 'data' | 'table-style' | 'header-style' | 'column-style' | 'row-style' | 'icons' | 'templates'): void {
    this.activeTab = tab;
  }

  applyTemplate(templateId: string): void {
    const { styleSettings, columnSuggestions } = this.templatesService.applyTemplateWithColumns(templateId);

    this.selectedTemplate = templateId;
    
    // Update the template form control
    this.form.patchValue({ template: templateId });
    
    // Apply template styles to form
    const tableStyleGroup = this.form.get('tableStyle') as FormGroup;
    const headerStyleGroup = this.form.get('headerStyle') as FormGroup;
    const rowHeaderStyleGroup = this.form.get('rowHeaderStyle') as FormGroup;
    const alternatingColorsGroup = this.form.get('alternatingColors') as FormGroup;
    const bodyStyleGroup = this.form.get('bodyStyle') as FormGroup;

    // Apply table-level styles
    if (tableStyleGroup) {
      const tableStyleUpdates: any = {};
      if (styleSettings.backgroundColor !== undefined) tableStyleUpdates.backgroundColor = styleSettings.backgroundColor;
      if (styleSettings.borderColor !== undefined) tableStyleUpdates.borderColor = styleSettings.borderColor;
      if (styleSettings.borderWidth !== undefined) tableStyleUpdates.borderWidth = styleSettings.borderWidth;
      if (styleSettings.borderStyle !== undefined) tableStyleUpdates.borderStyle = styleSettings.borderStyle;
      if (styleSettings.cellPadding !== undefined) tableStyleUpdates.cellPadding = styleSettings.cellPadding;
      if (styleSettings.cellSpacing !== undefined) tableStyleUpdates.cellSpacing = styleSettings.cellSpacing;
      if (styleSettings.fontFamily !== undefined) tableStyleUpdates.fontFamily = styleSettings.fontFamily;
      if (styleSettings.fontSize !== undefined) tableStyleUpdates.fontSize = styleSettings.fontSize;
      if (styleSettings.textColor !== undefined) tableStyleUpdates.textColor = styleSettings.textColor;
      tableStyleGroup.patchValue(tableStyleUpdates);
    }

    // Apply header styles
    if (headerStyleGroup) {
      const headerStyleUpdates: any = {};
      if (styleSettings.headerBackgroundColor !== undefined) headerStyleUpdates.headerBackgroundColor = styleSettings.headerBackgroundColor;
      if (styleSettings.headerTextColor !== undefined) headerStyleUpdates.headerTextColor = styleSettings.headerTextColor;
      if (styleSettings.headerBorderColor !== undefined) headerStyleUpdates.headerBorderColor = styleSettings.headerBorderColor;
      if (styleSettings.headerBorderWidth !== undefined) headerStyleUpdates.headerBorderWidth = styleSettings.headerBorderWidth;
      if (styleSettings.showRowHeaders !== undefined) headerStyleUpdates.showRowHeaders = styleSettings.showRowHeaders;
      if (styleSettings.rowHeaderWidth !== undefined) headerStyleUpdates.rowHeaderWidth = styleSettings.rowHeaderWidth;
      
      // Apply nested headerStyle properties
      // Note: headerStyle.textColor takes precedence over headerTextColor if both exist
      if (styleSettings.headerStyle) {
        if (styleSettings.headerStyle.fontFamily !== undefined) headerStyleUpdates.headerFontFamily = styleSettings.headerStyle.fontFamily;
        if (styleSettings.headerStyle.fontSize !== undefined) headerStyleUpdates.headerFontSize = styleSettings.headerStyle.fontSize;
        if (styleSettings.headerStyle.fontWeight !== undefined) headerStyleUpdates.headerFontWeight = styleSettings.headerStyle.fontWeight;
        if (styleSettings.headerStyle.fontStyle !== undefined) headerStyleUpdates.headerFontStyle = styleSettings.headerStyle.fontStyle;
        if (styleSettings.headerStyle.textAlign !== undefined) headerStyleUpdates.headerTextAlign = styleSettings.headerStyle.textAlign;
        if (styleSettings.headerStyle.verticalAlign !== undefined) headerStyleUpdates.headerVerticalAlign = styleSettings.headerStyle.verticalAlign;
        // Only override headerTextColor if headerStyle.textColor is explicitly set
        if (styleSettings.headerStyle.textColor !== undefined) {
          headerStyleUpdates.headerTextColor = styleSettings.headerStyle.textColor;
        }
      }
      
      headerStyleGroup.patchValue(headerStyleUpdates);
    }

    // Apply row header styles
    if (rowHeaderStyleGroup && styleSettings.rowHeaderStyle) {
      const rowHeaderStyleUpdates: any = {};
      if (styleSettings.rowHeaderBackgroundColor !== undefined) rowHeaderStyleUpdates.rowHeaderBackgroundColor = styleSettings.rowHeaderBackgroundColor;
      if (styleSettings.rowHeaderStyle.fontFamily !== undefined) rowHeaderStyleUpdates.rowHeaderFontFamily = styleSettings.rowHeaderStyle.fontFamily;
      if (styleSettings.rowHeaderStyle.fontSize !== undefined) rowHeaderStyleUpdates.rowHeaderFontSize = styleSettings.rowHeaderStyle.fontSize;
      if (styleSettings.rowHeaderStyle.fontWeight !== undefined) rowHeaderStyleUpdates.rowHeaderFontWeight = styleSettings.rowHeaderStyle.fontWeight;
      if (styleSettings.rowHeaderStyle.textColor !== undefined) rowHeaderStyleUpdates.rowHeaderTextColor = styleSettings.rowHeaderStyle.textColor;
      rowHeaderStyleGroup.patchValue(rowHeaderStyleUpdates);
    }

    // Apply alternating colors
    if (alternatingColorsGroup) {
      const alternatingColorsUpdates: any = {};
      if (styleSettings.alternateRowColor !== undefined) alternatingColorsUpdates.alternateRowColor = styleSettings.alternateRowColor;
      if (styleSettings.alternateColumnColor !== undefined) alternatingColorsUpdates.alternateColumnColor = styleSettings.alternateColumnColor;
      alternatingColorsGroup.patchValue(alternatingColorsUpdates);
    }

    // Apply body styles
    if (bodyStyleGroup && styleSettings.bodyStyle) {
      const bodyStyleUpdates: any = {};
      if (styleSettings.bodyStyle.fontFamily !== undefined) bodyStyleUpdates.bodyFontFamily = styleSettings.bodyStyle.fontFamily;
      if (styleSettings.bodyStyle.fontSize !== undefined) bodyStyleUpdates.bodyFontSize = styleSettings.bodyStyle.fontSize;
      if (styleSettings.bodyStyle.fontWeight !== undefined) bodyStyleUpdates.bodyFontWeight = styleSettings.bodyStyle.fontWeight;
      if (styleSettings.bodyStyle.textColor !== undefined) bodyStyleUpdates.bodyTextColor = styleSettings.bodyStyle.textColor;
      if (styleSettings.bodyStyle.backgroundColor !== undefined) bodyStyleUpdates.bodyBackgroundColor = styleSettings.bodyStyle.backgroundColor;
      bodyStyleGroup.patchValue(bodyStyleUpdates);
    }

    // Apply column suggestions with icons
    if (columnSuggestions && columnSuggestions.length > 0) {
      // Clear existing columns
      this.columnsFormArray.clear();
      this.rowsFormArray.clear();

      // Add suggested columns with icons
      columnSuggestions.forEach((suggestion) => {
        const iconConfig = suggestion.icon 
          ? this.templatesService.getIconConfigForTemplate(templateId, suggestion.icon as any)
          : null;

        const columnGroup = this.fb.group({
          id: [uuid()],
          title: [suggestion.title, Validators.required],
          widthPx: [suggestion.widthPx || 120, [Validators.required, Validators.min(50)]],
          align: [suggestion.align || 'left', Validators.required],
          cellType: [suggestion.cellType || 'text', Validators.required],
          verticalAlign: ['middle'],
          isHeader: [false],
          backgroundColor: [''],
          textColor: [''],
          fontFamily: [''],
          fontSize: [14],
          fontWeight: ['normal'],
          fontStyle: ['normal'],
          borderColor: [''],
          borderWidth: [0],
          borderStyle: ['none'],
          padding: [8],
          icon: this.fb.group({
            name: [iconConfig?.svg ? '' : ''],
            svg: [iconConfig?.svg || ''],
            url: [suggestion.supportsImage ? '' : ''],
            position: ['before'], // Always 'before' to show text with icon
            size: [iconConfig?.size || 18],
            color: [iconConfig?.color || ''],
            margin: [iconConfig?.margin || 6],
            backgroundColor: [iconConfig?.backgroundColor || ''],
            borderRadius: [iconConfig?.borderRadius || 0],
            padding: [iconConfig?.padding || 0],
          }),
        });

        this.columnsFormArray.push(columnGroup);
      });

      // Add default rows
      for (let i = 0; i < 3; i++) {
        const rowCells = Array(columnSuggestions.length).fill('');
        this.rowsFormArray.push(
          this.createRowFormGroup({ id: uuid(), cells: rowCells })
        );
      }
    }
  }

  /**
   * Get icon SVG by name as SafeHtml for rendering
   */
  getIconSvg(iconName: string): SafeHtml {
    const svg = this.templatesService.getIcon(iconName as any) || '';
    if (!svg) {
      return this.sanitizer.bypassSecurityTrustHtml('');
    }
    
    // Ensure SVG has proper viewBox and explicit width/height for rendering
    let processedSvg = svg;
    
    // Add viewBox if missing
    if (!processedSvg.includes('viewBox')) {
      processedSvg = processedSvg.replace('<svg', '<svg viewBox="0 0 24 24"');
    }
    
    // Add explicit width and height if not present (for better rendering)
    if (!processedSvg.includes('width=') && !processedSvg.includes('width="')) {
      processedSvg = processedSvg.replace('<svg', '<svg width="24" height="24"');
    }
    
    // Ensure color is set for stroke-based icons
    if (processedSvg.includes('stroke="currentColor"') || processedSvg.includes('stroke=\'currentColor\'')) {
      // Color will be inherited from parent via CSS
    }
    
    // Bypass security to allow SVG rendering
    return this.sanitizer.bypassSecurityTrustHtml(processedSvg);
  }

  /**
   * Apply icon to selected column
   */
  applyIconToColumn(iconName: string): void {
    if (this.selectedIconColumnIndex === null || this.selectedIconColumnIndex < 0) {
      return;
    }

    const columnGroup = this.getColumnFormGroup(this.selectedIconColumnIndex);
    if (!columnGroup) {
      return;
    }

    const iconGroup = columnGroup.get('icon') as FormGroup;
    if (!iconGroup) {
      return;
    }

    const svg = this.templatesService.getIcon(iconName as any);
    const iconConfig = this.selectedTemplate
      ? this.templatesService.getIconConfigForTemplate(this.selectedTemplate, iconName as any)
      : {
          svg,
          position: 'before' as const,
          size: 18,
          color: '#6366f1',
          margin: 6,
        };

    // Ensure position is 'before' (not 'only') so text is visible
    iconGroup.patchValue({
      svg: iconConfig.svg,
      position: 'before', // Always show text with icon
      size: iconConfig.size,
      color: iconConfig.color,
      margin: iconConfig.margin,
      backgroundColor: iconConfig.backgroundColor || '',
      borderRadius: iconConfig.borderRadius || 0,
      padding: iconConfig.padding || 0,
      url: '', // Clear URL when setting SVG icon
    });

    this.showIconPicker = false;
  }

  /**
   * Apply placeholder image to selected column
   */
  applyPlaceholderImage(type: 'avatar' | 'product' | 'logo' | 'banner'): void {
    if (this.selectedIconColumnIndex === null || this.selectedIconColumnIndex < 0) {
      return;
    }

    const columnGroup = this.getColumnFormGroup(this.selectedIconColumnIndex);
    if (!columnGroup) {
      return;
    }

    const iconGroup = columnGroup.get('icon') as FormGroup;
    if (!iconGroup) {
      return;
    }

    const placeholderUrl = this.templatesService.getPlaceholderImageUrl(type);
    
    // Set image URL but keep position as 'before' so text shows alongside
    iconGroup.patchValue({
      url: placeholderUrl,
      svg: '',
      name: '',
      position: 'before', // Ensure text is visible
    });

    // Don't change cell type - keep it as text so text is visible
    // Images in headers work with any cell type
  }

  /**
   * Auto-suggest icon for a column based on its title
   */
  autoSuggestIconForColumn(columnIndex: number): void {
    const columnGroup = this.getColumnFormGroup(columnIndex);
    if (!columnGroup) {
      return;
    }

    const title = columnGroup.get('title')?.value || '';
    const suggestion = this.templatesService.getIconSuggestion(title);
    
    if (suggestion) {
      const iconGroup = columnGroup.get('icon') as FormGroup;
      if (iconGroup) {
        const iconConfig = this.selectedTemplate
          ? this.templatesService.getIconConfigForTemplate(this.selectedTemplate, this.getIconNameFromSuggestion(title) as any)
          : suggestion;

        iconGroup.patchValue({
          svg: iconConfig.svg,
          position: iconConfig.position,
          size: iconConfig.size,
          color: iconConfig.color,
          margin: iconConfig.margin,
        });
      }
    }
  }

  /**
   * Get icon name from column title suggestion
   */
  private getIconNameFromSuggestion(title: string): string {
    const suggestion = this.templatesService.getIconSuggestion(title);
    if (!suggestion) {
      return '';
    }

    // Find which icon matches the SVG
    for (const iconName of this.availableIcons) {
      const iconSvg = this.templatesService.getIcon(iconName as any);
      if (iconSvg === suggestion.svg) {
        return iconName;
      }
    }

    return '';
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const formValue = this.form.value;
    const tableStyle = formValue.tableStyle || {};
    const headerStyle = formValue.headerStyle || {};
    const rowHeaderStyle = formValue.rowHeaderStyle || {};
    const alternatingColors = formValue.alternatingColors || {};
    const bodyStyle = formValue.bodyStyle || {};

    // Build styleSettings object using new TableStyleSettings structure
    const styleSettings: TableStyleSettings = {
      // Table borders
      borderColor: tableStyle.borderColor || undefined,
      borderWidth: tableStyle.borderWidth ?? undefined,
      borderStyle: tableStyle.borderStyle || undefined,
      
      // Spacing
      cellPadding: tableStyle.cellPadding ?? undefined,
      cellSpacing: tableStyle.cellSpacing ?? undefined,
      
      // Global styles
      fontFamily: tableStyle.fontFamily || undefined,
      fontSize: tableStyle.fontSize ?? undefined,
      textColor: tableStyle.textColor || undefined,
      backgroundColor: tableStyle.backgroundColor || undefined,
      
      // Header styling
      headerBackgroundColor: headerStyle.headerBackgroundColor || undefined,
      headerTextColor: headerStyle.headerTextColor || undefined,
      headerBorderColor: headerStyle.headerBorderColor || undefined,
      headerBorderWidth: headerStyle.headerBorderWidth ?? undefined,
      headerStyle: {
        fontFamily: headerStyle.headerFontFamily || undefined,
        fontSize: headerStyle.headerFontSize ?? undefined,
        fontWeight: headerStyle.headerFontWeight || undefined,
        fontStyle: headerStyle.headerFontStyle || undefined,
        textColor: headerStyle.headerTextColor || undefined,
        textAlign: headerStyle.headerTextAlign || undefined,
        verticalAlign: headerStyle.headerVerticalAlign || undefined,
      },
      
      // Row header styling
      showRowHeaders: headerStyle.showRowHeaders ?? undefined,
      rowHeaderWidth: headerStyle.rowHeaderWidth ?? undefined,
      rowHeaderBackgroundColor: rowHeaderStyle.rowHeaderBackgroundColor || undefined,
      rowHeaderStyle: {
        fontFamily: rowHeaderStyle.rowHeaderFontFamily || undefined,
        fontSize: rowHeaderStyle.rowHeaderFontSize ?? undefined,
        fontWeight: rowHeaderStyle.rowHeaderFontWeight || undefined,
        textColor: rowHeaderStyle.rowHeaderTextColor || undefined,
      },
      
      // Alternating colors
      alternateRowColor: alternatingColors.alternateRowColor || undefined,
      alternateColumnColor: alternatingColors.alternateColumnColor || undefined,
      
      // Body styling
      bodyStyle: {
        fontFamily: bodyStyle.bodyFontFamily || undefined,
        fontSize: bodyStyle.bodyFontSize ?? undefined,
        fontWeight: bodyStyle.bodyFontWeight || undefined,
        textColor: bodyStyle.bodyTextColor || undefined,
        backgroundColor: bodyStyle.bodyBackgroundColor || undefined,
      },
    };

    const tableProps: TableWidgetProps = {
      provider: 'html-table',
      template: formValue.template || undefined,
      columns: formValue.columns.map((col: any) => ({
        id: col.id,
        title: col.title,
        widthPx: col.widthPx,
        align: col.align,
        cellType: col.cellType,
        verticalAlign: col.verticalAlign || undefined,
        isHeader: col.isHeader ?? undefined,
        // Column styling
        backgroundColor: col.backgroundColor || undefined,
        textColor: col.textColor || undefined,
        fontFamily: col.fontFamily || undefined,
        fontSize: col.fontSize ?? undefined,
        fontWeight: col.fontWeight || undefined,
        fontStyle: col.fontStyle || undefined,
        borderColor: col.borderColor || undefined,
        borderWidth: col.borderWidth ?? undefined,
        borderStyle: col.borderStyle || undefined,
        padding: col.padding ?? undefined,
        // Icon configuration
        icon: col.icon?.name || col.icon?.svg || col.icon?.url ? {
          name: col.icon.name || undefined,
          svg: col.icon.svg || undefined,
          url: col.icon.url || undefined,
          position: col.icon.position || undefined,
          size: col.icon.size ?? undefined,
          color: col.icon.color || undefined,
          margin: col.icon.margin ?? undefined,
          backgroundColor: col.icon.backgroundColor || undefined,
          borderRadius: col.icon.borderRadius ?? undefined,
          padding: col.icon.padding ?? undefined,
        } : null,
      })),
      rows: formValue.rows.map((row: any) => ({
        id: row.id,
        cells: row.cells || [],
        // Row styling
        isHeader: row.isHeader ?? undefined,
        backgroundColor: row.backgroundColor || undefined,
        height: row.height || undefined,
        minHeight: row.minHeight || undefined,
        verticalAlign: row.verticalAlign || undefined,
        fontFamily: row.fontFamily || undefined,
        fontSize: row.fontSize ?? undefined,
        fontWeight: row.fontWeight || undefined,
        fontStyle: row.fontStyle || undefined,
        textColor: row.textColor || undefined,
        borderColor: row.borderColor || undefined,
        borderWidth: row.borderWidth ?? undefined,
        borderStyle: row.borderStyle || undefined,
        padding: row.padding ?? undefined,
      })),
      allowIconsInColumns: formValue.allowIconsInColumns,
      styleSettings,
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

  closeDialog(event?: MouseEvent): void {
    // Only close if clicking directly on overlay, not if event came from content
    if (event) {
      const target = event.target as HTMLElement;
      // Check if the click was on the overlay itself (not on content or its children)
      if (target.classList.contains('table-config-dialog__overlay')) {
        this.cancel();
      }
    } else {
      this.cancel();
    }
  }
}

