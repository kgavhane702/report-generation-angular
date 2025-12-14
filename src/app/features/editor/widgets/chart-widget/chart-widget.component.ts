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
  @Output() chartPropsChange = new EventEmitter<Partial<ChartWidgetProps>>();
  
  @ViewChild('container', { static: true }) containerRef!: ElementRef<HTMLDivElement>;

  private instance?: ChartInstance;
  private readonly registry = inject(ChartRegistryService);
  private readonly cdr = inject(ChangeDetectorRef);
  
  showDialog = false;
  dialogData?: ChartConfigDialogData;
  
  // Store pending changes that haven't been saved yet
  private pendingChartData?: ChartData;
  private pendingProvider?: string;

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
          // Widget changed - clear pending data for the old widget
          this.pendingChartData = undefined;
          this.pendingProvider = undefined;
          
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
          // Widget data was updated from parent - clear pending data since it's now saved
          this.pendingChartData = undefined;
          this.pendingProvider = undefined;
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
    // Use pendingChartData if available (most recent unsaved changes), otherwise use widget data
    const sourceChartData = this.pendingChartData || (this.chartProps.data as ChartData);
    
    const chartData = sourceChartData || {
      chartType: 'column',
      labels: [],
      series: [],
    };

    // Create a deep copy to ensure Angular detects changes and dialog always gets fresh data
    const clonedChartData = this.deepCloneChartData(chartData);

    // Use pending provider if available, otherwise use widget provider
    const provider = this.pendingProvider || this.chartProps.provider;

    this.dialogData = {
      chartData: clonedChartData,
      widgetId: this.widget.id,
      provider: provider,
    };
    this.showDialog = true;
    this.cdr.markForCheck();
  }
  
  private deepCloneChartData(data: ChartData): ChartData {
    return {
      ...data,
      labels: data.labels ? [...data.labels] : [],
      series: data.series ? data.series.map(series => ({
        ...series,
        data: series.data ? [...series.data] : [],
      })) : [],
    };
  }

  closeConfigDialog(result: ChartConfigDialogResult): void {
    this.showDialog = false;
    this.dialogData = undefined;

    if (!result.cancelled) {
      // Store pending changes immediately so they're available when dialog reopens
      this.pendingChartData = result.chartData;
      if (result.provider) {
        this.pendingProvider = result.provider;
      }
      
      // Emit chart props change event
      this.chartPropsChange.emit({
        chartType: result.chartData.chartType,
        data: result.chartData,
        provider: result.provider,
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
