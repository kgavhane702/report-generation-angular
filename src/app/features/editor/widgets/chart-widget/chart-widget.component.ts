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
  ChartWidgetProps,
  WidgetModel,
} from '../../../../models/widget.model';
import { ChartRegistryService } from '../chart/registry/chart-registry.service';
import { ChartInstance } from '../chart/adapters/chart-adapter';
import { ChartData } from '../../../../models/chart-data.model';
import {
  ChartConfigDialogComponent,
  ChartConfigDialogData,
  ChartConfigDialogResult,
} from '../chart/chart-config/chart-config-dialog.component';

@Component({
  selector: 'app-chart-widget',
  templateUrl: './chart-widget.component.html',
  styleUrls: ['./chart-widget.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChartWidgetComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) widget!: WidgetModel;
  @Output() chartPropsChange = new EventEmitter<Partial<ChartWidgetProps>>();
  
  @ViewChild('container', { static: true }) containerRef!: ElementRef<HTMLDivElement>;

  private instance?: ChartInstance;
  private readonly registry = inject(ChartRegistryService);
  private readonly cdr = inject(ChangeDetectorRef);
  
  showDialog = false;
  dialogData?: ChartConfigDialogData;

  ngAfterViewInit(): void {
    // Render chart after view init
    // Use setTimeout to ensure DOM is ready
    setTimeout(() => {
      if (this.containerRef?.nativeElement) {
        this.renderChart();
      }
    }, 0);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['widget']) {
      if (changes['widget'].firstChange) {
        // First change - render chart
        // Use setTimeout to ensure view is initialized
        setTimeout(() => {
          if (this.containerRef?.nativeElement) {
            this.renderChart();
          }
        }, 0);
      } else {
        const previousWidget = changes['widget'].previousValue as WidgetModel;
        const currentWidget = changes['widget'].currentValue as WidgetModel;
        
        // If widget ID changed, it's a completely different widget - destroy old and re-render
        if (previousWidget && previousWidget.id !== currentWidget.id) {
        // Destroy old chart instance
        if (this.instance) {
          this.instance.destroy?.();
          this.instance = undefined;
        }
          // Clear container
          if (this.containerRef?.nativeElement) {
            this.containerRef.nativeElement.innerHTML = '';
          }
          // Re-render with new widget
          setTimeout(() => {
            if (this.containerRef?.nativeElement) {
              this.renderChart();
            }
          }, 0);
          return;
        }
        
        // Only update if chart-specific properties changed
        // Avoid re-rendering when position, size, or other unrelated properties change
        if (this.hasChartDataChanged(previousWidget, currentWidget)) {
          this.updateChart();
        }
      }
    }
  }

  /**
   * Check if chart data/properties actually changed (not just position/size)
   */
  private hasChartDataChanged(previous: WidgetModel, current: WidgetModel): boolean {
    // If widget IDs differ, it's a different widget
    if (previous.id !== current.id) {
      return true;
    }

    const prevProps = previous.props as ChartWidgetProps;
    const currProps = current.props as ChartWidgetProps;

    // Check if chart-specific properties changed
    if (prevProps.provider !== currProps.provider) {
      return true;
    }

    if (prevProps.chartType !== currProps.chartType) {
      return true;
    }

    // Deep compare chart data
    const prevData = prevProps.data as ChartData;
    const currData = currProps.data as ChartData;

    if (!prevData && !currData) {
      return false;
    }

    if (!prevData || !currData) {
      return true;
    }

    // Compare chart data structure
    if (prevData.chartType !== currData.chartType) {
      return true;
    }

    if (prevData.title !== currData.title) {
      return true;
    }

    // Compare series
    if (JSON.stringify(prevData.series) !== JSON.stringify(currData.series)) {
      return true;
    }

    // Compare labels
    if (JSON.stringify(prevData.labels) !== JSON.stringify(currData.labels)) {
      return true;
    }

    // Chart data hasn't changed - only position/size/zIndex might have
    return false;
  }

  ngOnDestroy(): void {
    this.instance?.destroy?.();
  }

  onDoubleClick(event: MouseEvent): void {
    event.stopPropagation();
    this.openConfigDialog();
  }

  openConfigDialog(): void {
    const chartData = (this.chartProps.data as ChartData) || {
      chartType: 'column',
      labels: [],
      series: [],
    };

    this.dialogData = {
      chartData,
      widgetId: this.widget.id,
    };
    this.showDialog = true;
    this.cdr.markForCheck();
  }

  closeConfigDialog(result: ChartConfigDialogResult): void {
    this.showDialog = false;
    this.dialogData = undefined;

    if (!result.cancelled) {
      // Emit chart props change event
      this.chartPropsChange.emit({
        chartType: result.chartData.chartType,
        data: result.chartData,
      });
    }

    this.cdr.markForCheck();
  }

  private renderChart(): void {
    if (!this.containerRef?.nativeElement) {
      return;
    }

    // Destroy existing instance
    if (this.instance) {
      this.instance.destroy?.();
    }

    const providerId = this.chartProps.provider || 'highcharts';
    const adapter = this.registry.getAdapter(providerId);
    
    if (!adapter) {
      // Debug: log available adapters
      const availableAdapters = this.registry.listAdapters();
      console.warn('Chart adapter not found:', {
        requested: providerId,
        available: availableAdapters.map(a => a.id),
        allAdapters: availableAdapters,
      });
      
      this.containerRef.nativeElement.innerHTML = `
        <div style="padding: 20px; text-align: center; color: #dc2626;">
          No chart adapter registered for "${providerId}".<br/>
          Available: ${availableAdapters.map(a => a.id).join(', ') || 'none'}
        </div>
      `;
      return;
    }

    try {
      this.instance = adapter.render(
        this.containerRef.nativeElement,
        this.chartProps
      ) as ChartInstance;
    } catch (error) {
      console.error('Chart rendering error:', error);
      this.containerRef.nativeElement.innerHTML = `
        <div style="padding: 20px; text-align: center; color: #dc2626;">
          Chart rendering error. Double-click to configure.<br/>
          Error: ${error instanceof Error ? error.message : String(error)}
        </div>
      `;
    }
  }

  private updateChart(): void {
    // Re-render on changes for simplicity
    // In the future, we can optimize to update in place
    this.renderChart();
  }

  private get chartProps(): ChartWidgetProps {
    return this.widget.props as ChartWidgetProps;
  }
}
