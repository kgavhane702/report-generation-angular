import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  inject,
} from '@angular/core';
import {
  ChartWidgetProps,
  WidgetModel,
} from '../../../../models/widget.model';
import { ChartRegistryService } from '../providers/charts/registry';
import { ChartInstance } from '../providers/charts/interfaces';
import { ChartData } from '../../../../models/chart-data.model';
import {
  ChartConfigDialogData,
  ChartConfigDialogResult,
} from '../providers/charts/chart-config/chart-config-dialog.component';

@Component({
  selector: 'app-chart-widget',
  templateUrl: './chart-widget.component.html',
  styleUrls: ['./chart-widget.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChartWidgetComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) widget!: WidgetModel;
  
  @ViewChild('container', { static: true }) containerRef!: ElementRef<HTMLDivElement>;

  private instance?: ChartInstance;
  private readonly registry = inject(ChartRegistryService);
  private readonly cdr = inject(ChangeDetectorRef);
  
  showDialog = false;
  dialogData?: ChartConfigDialogData;
  pendingChartData?: ChartData;

  ngAfterViewInit(): void {
    setTimeout(() => {
      if (this.containerRef?.nativeElement) {
        this.renderChart();
      }
    }, 0);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['widget']) {
      if (changes['widget'].firstChange) {
        setTimeout(() => {
          if (this.containerRef?.nativeElement) {
            this.renderChart();
          }
        }, 0);
      } else {
        const previousWidget = changes['widget'].previousValue as WidgetModel;
        const currentWidget = changes['widget'].currentValue as WidgetModel;

        if (previousWidget && previousWidget.id !== currentWidget.id) {
          if (this.instance) {
            this.instance.destroy?.();
            this.instance = undefined;
          }
          if (this.containerRef?.nativeElement) {
            this.containerRef.nativeElement.innerHTML = '';
          }
          setTimeout(() => {
            if (this.containerRef?.nativeElement) {
              this.renderChart();
            }
          }, 0);
          return;
        }

        if (this.hasChartDataChanged(previousWidget, currentWidget)) {
          this.updateChart();
        }
      }
    }
  }

  private hasChartDataChanged(previous: WidgetModel, current: WidgetModel): boolean {
    if (previous.id !== current.id) {
      return true;
    }

    const prevProps = previous.props as ChartWidgetProps;
    const currProps = current.props as ChartWidgetProps;

    if (prevProps.provider !== currProps.provider || prevProps.chartType !== currProps.chartType) {
      return true;
    }

    const prevData = prevProps.data as ChartData;
    const currData = currProps.data as ChartData;

    if (!prevData && !currData) {
      return false;
    }

    if (!prevData || !currData) {
      return true;
    }

    return (
      prevData.chartType !== currData.chartType ||
      prevData.title !== currData.title ||
      JSON.stringify(prevData.series) !== JSON.stringify(currData.series) ||
      JSON.stringify(prevData.labels) !== JSON.stringify(currData.labels)
    );
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
    
    // Store pending chart data for commit on save
    if (!result.cancelled && result.chartData) {
      this.pendingChartData = result.chartData;
      // Update chart preview (but don't save yet)
      this.updateChartPreview();
    }
    
    this.cdr.markForCheck();
  }

  private updateChartPreview(): void {
    if (!this.containerRef?.nativeElement || !this.pendingChartData) {
      return;
    }

    // Destroy existing instance
    if (this.instance) {
      this.instance.destroy?.();
    }

    const providerId = this.chartProps.provider || 'echarts';
    const adapter = this.registry.getAdapter(providerId);

    if (!adapter) {
      return;
    }

    try {
      // Render with pending data for preview
      const previewProps: ChartWidgetProps = {
        ...this.chartProps,
        chartType: this.pendingChartData.chartType,
        data: this.pendingChartData,
      };
      this.instance = adapter.render(
        this.containerRef.nativeElement,
        previewProps
      ) as ChartInstance;
    } catch (error) {
      // Error handled silently
    }
  }

  // Public method to get current state (called by widget-container)
  getCurrentState(): Partial<ChartWidgetProps> {
    const state = this.pendingChartData ? {
      chartType: this.pendingChartData.chartType,
      data: this.pendingChartData,
      provider: this.chartProps.provider,
    } : {
      chartType: this.chartProps.chartType,
      data: this.chartProps.data,
      provider: this.chartProps.provider,
    };
    
    // Clear pending data after getting state (will be saved)
    if (this.pendingChartData) {
      this.pendingChartData = undefined;
    }
    
    return state;
  }

  private renderChart(): void {
    if (!this.containerRef?.nativeElement) {
      return;
    }

    // Destroy existing instance
    if (this.instance) {
      this.instance.destroy?.();
    }

    const providerId = this.chartProps.provider || 'echarts';
    const adapter = this.registry.getAdapter(providerId);

    if (!adapter) {
      const availableAdapters = this.registry.listAdapters();
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
      this.containerRef.nativeElement.innerHTML = `
        <div style="padding: 20px; text-align: center; color: #dc2626;">
          Chart rendering error. Double-click to configure.<br/>
          Error: ${error instanceof Error ? error.message : String(error)}
        </div>
      `;
    }
  }

  private updateChart(): void {
    this.renderChart();
  }

  private get chartProps(): ChartWidgetProps {
    return this.widget.props as ChartWidgetProps;
  }
}
