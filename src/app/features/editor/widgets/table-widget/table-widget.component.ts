import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  inject,
} from '@angular/core';

import {
  TableWidgetProps,
  WidgetModel,
} from '../../../../models/widget.model';
import { TableInstance } from '../providers/table/interfaces';
import { TableConfigDialogData, TableConfigDialogResult } from '../providers/table/table-config';
import { TableRegistryService } from '../providers/table/registry';


@Component({
  selector: 'app-table-widget',
  templateUrl: './table-widget.component.html',
  styleUrls: ['./table-widget.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableWidgetComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) widget!: WidgetModel;
  @Output() tablePropsChange = new EventEmitter<Partial<TableWidgetProps>>();

  @ViewChild('container', { static: true }) containerRef!: ElementRef<HTMLDivElement>;

  private instance?: TableInstance;
  private readonly registry = inject(TableRegistryService);
  private readonly cdr = inject(ChangeDetectorRef);

  showDialog = false;
  dialogData?: TableConfigDialogData;

  ngAfterViewInit(): void {
    this.renderTable();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['widget'] && !changes['widget'].firstChange) {
      const previousWidget = changes['widget'].previousValue as WidgetModel;
      const currentWidget = changes['widget'].currentValue as WidgetModel;

      // Only update if table-specific properties changed
      if (this.hasTableDataChanged(previousWidget, currentWidget)) {
        this.updateTable();
      }
    }
  }

  ngOnDestroy(): void {
    this.instance?.destroy?.();
  }

  onDoubleClick(event: MouseEvent): void {
    event.stopPropagation();
    this.openConfigDialog();
  }

  openConfigDialog(): void {
    const tableProps = this.tableProps || {
      columns: [],
      rows: [],
      allowIconsInColumns: true,
    };

    this.dialogData = {
      tableProps,
      widgetId: this.widget.id,
    };
    this.showDialog = true;
    this.cdr.markForCheck();
  }

  closeConfigDialog(result: TableConfigDialogResult): void {
    this.showDialog = false;
    this.dialogData = undefined;

    if (!result.cancelled) {
      // Emit table props change event
      this.tablePropsChange.emit(result.tableProps);
    }

    this.cdr.markForCheck();
  }

  /**
   * Check if table data/properties actually changed (not just position/size)
   */
  private hasTableDataChanged(previous: WidgetModel, current: WidgetModel): boolean {
    // If widget IDs differ, it's a different widget
    if (previous.id !== current.id) {
      return true;
    }

    const prevProps = previous.props as TableWidgetProps;
    const currProps = current.props as TableWidgetProps;

    // Compare columns
    if (JSON.stringify(prevProps.columns) !== JSON.stringify(currProps.columns)) {
      return true;
    }

    // Compare rows
    if (JSON.stringify(prevProps.rows) !== JSON.stringify(currProps.rows)) {
      return true;
    }

    // Compare other table-specific properties
    if (prevProps.allowIconsInColumns !== currProps.allowIconsInColumns) {
      return true;
    }

    if (JSON.stringify(prevProps.styleSettings) !== JSON.stringify(currProps.styleSettings)) {
      return true;
    }

    // Table data hasn't changed - only position/size/zIndex might have
    return false;
  }

  private renderTable(): void {
    if (!this.containerRef?.nativeElement) {
      return;
    }

    // Destroy existing instance
    if (this.instance) {
      this.instance.destroy?.();
    }

    const providerId = this.tableProps.provider || 'html-table';
    const adapter = this.registry.getAdapter(providerId);

    if (!adapter) {
      const availableAdapters = this.registry.listAdapters();
      console.warn('Table adapter not found:', {
        requested: providerId,
        available: availableAdapters.map(a => a.id),
      });

      this.containerRef.nativeElement.innerHTML = `
        <div style="padding: 20px; text-align: center; color: #dc2626;">
          No table adapter registered for "${providerId}".<br/>
          Available: ${availableAdapters.map(a => a.id).join(', ') || 'none'}
        </div>
      `;
      return;
    }

    try {
      this.instance = adapter.render(
        this.containerRef.nativeElement,
        this.tableProps
      ) as TableInstance;
    } catch (error) {
      console.error('Table rendering error:', error);
      this.containerRef.nativeElement.innerHTML = `
        <div style="padding: 20px; text-align: center; color: #dc2626;">
          Table rendering error. Double-click to configure.<br/>
          Error: ${error instanceof Error ? error.message : String(error)}
        </div>
      `;
    }
  }

  private updateTable(): void {
    // Try to update in place if instance supports it
    if (this.instance?.updateData) {
      try {
        this.instance.updateData(this.tableProps);
        return;
      } catch (error) {
        console.warn('In-place update failed, re-rendering:', error);
      }
    }

    // Fall back to full re-render
    this.renderTable();
  }

  private get tableProps(): TableWidgetProps {
    return this.widget.props as TableWidgetProps;
  }
}
