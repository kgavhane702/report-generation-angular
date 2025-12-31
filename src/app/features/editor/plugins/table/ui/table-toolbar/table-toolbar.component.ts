import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { TableToolbarService, TableSectionOptions } from '../../../../../../core/services/table-toolbar.service';
import { EditorStateService } from '../../../../../../core/services/editor-state.service';
import { TableWidgetProps } from '../../../../../../models/widget.model';

import { EditastraToolbarComponent } from '../../../editastra/ui/editastra-toolbar/editastra-toolbar.component';
import { EDITASTRA_SHARED_FORMATTING_PLUGINS } from '../../../editastra/ui/editastra-toolbar/editastra-toolbar.plugins';

import { ColorPickerComponent, ColorOption } from '../../../../../../shared/components/color-picker/color-picker.component';
import { BorderPickerComponent, BorderValue } from '../../../../../../shared/components/border-picker/border-picker.component';

/**
 * TableToolbarComponent
 *
 * Table-specific toolbar:
 * - Table structure + options (split/merge/insert/delete, section toggles)
 * - Cell-level styling (fill, border, format painter)
 * - Embeds shared text formatting plugins from Editastra (single source of truth)
 */
@Component({
  selector: 'app-table-toolbar',
  standalone: true,
  imports: [CommonModule, FormsModule, EditastraToolbarComponent, ColorPickerComponent, BorderPickerComponent],
  templateUrl: './table-toolbar.component.html',
  styleUrls: ['./table-toolbar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableToolbarComponent {
  private readonly toolbarService = inject(TableToolbarService);
  private readonly editorState = inject(EditorStateService);

  /** Shared formatting plugins (stored in Editastra) */
  readonly sharedFormattingPlugins = EDITASTRA_SHARED_FORMATTING_PLUGINS;

  /** Computed: is the active widget a table? */
  readonly isTableWidgetActive = computed(() => this.editorState.activeWidget()?.type === 'table');

  /** Computed: active table widget props (if table is selected) */
  readonly activeTableProps = computed<TableWidgetProps | null>(() => {
    const w = this.editorState.activeWidget();
    return w?.type === 'table' ? (w.props as TableWidgetProps) : null;
  });

  /** Computed: table options from the active widget props */
  readonly tableOptionsFromWidget = computed(() => {
    const props = this.activeTableProps();
    return {
      headerRow: !!props?.headerRow,
      firstColumn: !!props?.firstColumn,
      totalRow: !!props?.totalRow,
      lastColumn: !!props?.lastColumn,
    };
  });

  splitDialogOpen = false;
  splitRows = 2;
  splitCols = 2;
  splitMax = 20;

  // Highlight and fill palette (includes transparent)
  readonly highlightFillPalette: ColorOption[] = [
    { value: '', label: 'Transparent' },
    { value: '#fff59d', label: 'Yellow' },
    { value: '#ffccbc', label: 'Orange' },
    { value: '#c5e1a5', label: 'Green' },
    { value: '#b3e5fc', label: 'Light Blue' },
    { value: '#ce93d8', label: 'Purple' },
    { value: '#f8bbd0', label: 'Pink' },
    { value: '#ffffff', label: 'White' },
    { value: '#f3f4f6', label: 'Light Gray' },
    { value: '#9ca3af', label: 'Gray' },
    { value: '#1f2937', label: 'Dark Gray' },
    { value: '#000000', label: 'Black' },
  ];

  // Defaults for custom inputs
  cellFillColor = '';
  borderColor = '';
  borderWidth = 1;
  borderStyle: 'solid' | 'dashed' | 'dotted' | 'none' = 'solid';

  get tableOptions() {
    return this.tableOptionsFromWidget();
  }

  get isFormatPainterActive(): boolean {
    return false;
  }

  get hasActiveCell(): boolean {
    return this.toolbarService.activeCell !== null;
  }

  /** Table is active if the selected widget is a table (from EditorStateService) */
  get hasActiveTable(): boolean {
    return this.isTableWidgetActive();
  }

  /** Get the active table widget id from EditorStateService */
  get activeTableWidgetId(): string | null {
    const w = this.editorState.activeWidget();
    return w?.type === 'table' ? w.id : null;
  }

  private emitTableOptionsPatch(patch: Partial<TableSectionOptions>): void {
    const widgetId = this.activeTableWidgetId;
    if (!widgetId) return;

    // Start from the current widget props so toggles stay isolated per widget.
    const base = this.tableOptions;
    const nextOptions: TableSectionOptions = {
      headerRow: patch.headerRow ?? base.headerRow,
      firstColumn: patch.firstColumn ?? base.firstColumn,
      totalRow: patch.totalRow ?? base.totalRow,
      lastColumn: patch.lastColumn ?? base.lastColumn,
    };

    this.toolbarService.setTableOptions(nextOptions, widgetId);
  }

  onToggleHeaderRow(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.emitTableOptionsPatch({ headerRow: checked });
  }

  onToggleFirstColumn(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.emitTableOptionsPatch({ firstColumn: checked });
  }

  onToggleTotalRow(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.emitTableOptionsPatch({ totalRow: checked });
  }

  onToggleLastColumn(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.emitTableOptionsPatch({ lastColumn: checked });
  }

  openSplitDialog(event: MouseEvent): void {
    event.preventDefault();
    this.splitDialogOpen = true;
  }

  closeSplitDialog(event?: MouseEvent): void {
    if (event) event.preventDefault();
    this.splitDialogOpen = false;
  }

  confirmSplit(event: MouseEvent): void {
    event.preventDefault();
    const rows = Math.max(1, Math.min(this.splitMax, Math.trunc(Number(this.splitRows))));
    const cols = Math.max(1, Math.min(this.splitMax, Math.trunc(Number(this.splitCols))));
    this.splitRows = rows;
    this.splitCols = cols;
    this.toolbarService.requestSplitCell({ rows, cols });
    this.splitDialogOpen = false;
  }

  onMergeClick(event: MouseEvent): void {
    event.preventDefault();
    this.toolbarService.requestMergeCells();
  }

  onUnmergeClick(event: MouseEvent): void {
    event.preventDefault();
    this.toolbarService.requestUnmerge();
  }

  onCellFillSelected(color: string): void {
    if (!this.hasActiveCell) return;
    this.cellFillColor = color;
    this.toolbarService.applyCellBackgroundColor(color);
  }

  onBorderValueChange(value: BorderValue): void {
    if (!this.hasActiveCell) return;
    this.borderColor = value.color;
    this.borderWidth = value.width;
    this.borderStyle = value.style;

    // Transparent => clear custom border and fall back to default cell border.
    if (!value.color || value.style === 'none') {
      this.toolbarService.applyCellBorder({ color: null, width: null, style: null });
      return;
    }

    this.toolbarService.applyCellBorder({
      color: value.color,
      width: Math.max(1, Math.min(20, Math.trunc(Number(value.width) || 1))),
      style: value.style,
    });
  }

  // Format painter removed for now.

  onInsertRowAbove(event: MouseEvent): void {
    event.preventDefault();
    if (!this.hasActiveCell) return;
    this.toolbarService.requestInsert({ axis: 'row', placement: 'before' });
  }

  onInsertRowBelow(event: MouseEvent): void {
    event.preventDefault();
    if (!this.hasActiveCell) return;
    this.toolbarService.requestInsert({ axis: 'row', placement: 'after' });
  }

  onInsertColLeft(event: MouseEvent): void {
    event.preventDefault();
    if (!this.hasActiveCell) return;
    this.toolbarService.requestInsert({ axis: 'col', placement: 'before' });
  }

  onInsertColRight(event: MouseEvent): void {
    event.preventDefault();
    if (!this.hasActiveCell) return;
    this.toolbarService.requestInsert({ axis: 'col', placement: 'after' });
  }

  onDeleteRow(event: MouseEvent): void {
    event.preventDefault();
    if (!this.hasActiveCell) return;
    this.toolbarService.requestDelete({ axis: 'row' });
  }

  onDeleteCol(event: MouseEvent): void {
    event.preventDefault();
    if (!this.hasActiveCell) return;
    this.toolbarService.requestDelete({ axis: 'col' });
  }
}


