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
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
  inject,
  effect,
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
import { ChartRenderRegistry } from '../../../../core/services/chart-render-registry.service';

@Component({
  selector: 'app-chart-widget',
  templateUrl: './chart-widget.component.html',
  styleUrls: ['./chart-widget.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChartWidgetComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) widget!: WidgetModel;
  @Input() subsectionId?: string;
  @Input() pageId?: string;
  @Output() chartPropsChange = new EventEmitter<Partial<ChartWidgetProps>>();
  
  @ViewChild('container', { static: true }) containerRef!: ElementRef<HTMLDivElement>;

  private instance?: ChartInstance;
  private readonly registry = inject(ChartRegistryService);
  private readonly renderRegistry = inject(ChartRenderRegistry);
  private readonly cdr = inject(ChangeDetectorRef);
  
  showDialog = false;
  dialogData?: ChartConfigDialogData;
  
  // Flag to track if chart is rendered
  private isChartRendered = false;
  
  // Store pending changes that haven't been saved yet
  private pendingChartData?: ChartData;

  constructor() {
    // React to export mode changes
    effect(() => {
      const isExportMode = this.renderRegistry.exportMode();
      // Only force render if:
      // 1. Export mode is active
      // 2. Chart hasn't been rendered yet
      // 3. Widget is available (inputs have been set)
      if (isExportMode && !this.isChartRendered && this.widget) {
        console.log('[ChartWidget] Export mode effect triggered for:', this.widget.id);
        // Force re-render when export mode is activated
        this.forceRender();
      }
    });
  }

  ngOnInit(): void {
    // Register this chart with the render registry
    console.log('[ChartWidget] ngOnInit - registering:', this.widget.id, 'subsection:', this.subsectionId);
    this.renderRegistry.register(this.widget.id, this.subsectionId, this.pageId);
  }

  ngAfterViewInit(): void {
    console.log('[ChartWidget] ngAfterViewInit:', this.widget.id);
    // Use microtask to ensure DOM is ready
    queueMicrotask(() => {
      if (this.containerRef?.nativeElement) {
        console.log('[ChartWidget] Container available, rendering:', this.widget.id);
        this.renderChart();
      } else {
        // Container not available - mark as error to prevent hanging
        console.error('[ChartWidget] Container NOT available:', this.widget.id);
        this.renderRegistry.markError(this.widget.id, 'Container element not available');
      }
    });
  }
  
  /**
   * Force render the chart - used during export to ensure chart is rendered
   * even if component is not visible
   */
  private forceRender(): void {
    if (this.containerRef?.nativeElement) {
      this.renderRegistry.markRendering(this.widget.id);
      this.renderChart();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['widget']) {
      if (changes['widget'].firstChange) {
        // First change is handled by ngAfterViewInit, skip here
        return;
      } else {
        const previousWidget = changes['widget'].previousValue as WidgetModel;
        const currentWidget = changes['widget'].currentValue as WidgetModel;

        if (previousWidget && previousWidget.id !== currentWidget.id) {
          // Widget ID changed - unregister old, register new
          this.renderRegistry.unregister(previousWidget.id);
          this.renderRegistry.register(currentWidget.id, this.subsectionId, this.pageId);
          
          // Clear pending data for the old widget
          this.pendingChartData = undefined;
          this.isChartRendered = false;
          
          if (this.instance) {
            this.instance.destroy?.();
            this.instance = undefined;
          }
          if (this.containerRef?.nativeElement) {
            this.containerRef.nativeElement.innerHTML = '';
          }
          
          // Schedule re-render
          queueMicrotask(() => {
            if (this.containerRef?.nativeElement) {
              this.renderChart();
            } else {
              this.renderRegistry.markError(currentWidget.id, 'Container not available after widget change');
            }
          });
          return;
        }

        if (this.hasChartDataChanged(previousWidget, currentWidget)) {
          // Widget data was updated from parent - clear pending data since it's now saved
          this.pendingChartData = undefined;
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
      prevData.xAxisLabel !== currData.xAxisLabel ||
      prevData.yAxisLabel !== currData.yAxisLabel ||
      prevData.showLegend !== currData.showLegend ||
      prevData.legendPosition !== currData.legendPosition ||
      prevData.showAxisLines !== currData.showAxisLines ||
      prevData.showValueLabels !== currData.showValueLabels ||
      prevData.valueLabelPosition !== currData.valueLabelPosition ||
      JSON.stringify(prevData.series) !== JSON.stringify(currData.series) ||
      JSON.stringify(prevData.labels) !== JSON.stringify(currData.labels)
    );
  }

  ngOnDestroy(): void {
    // Unregister from render registry
    console.log('[ChartWidget] ngOnDestroy - unregistering:', this.widget.id);
    this.renderRegistry.unregister(this.widget.id);
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

    this.dialogData = {
      chartData: clonedChartData,
      widgetId: this.widget.id,
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
      // Emit chart props change event
      this.chartPropsChange.emit({
        chartType: result.chartData.chartType,
        data: result.chartData,
      });
    }

    this.cdr.markForCheck();
  }

  private renderChart(): void {
    console.log('[ChartWidget] renderChart called:', this.widget.id);
    
    if (!this.containerRef?.nativeElement) {
      console.error('[ChartWidget] Container not available in renderChart:', this.widget.id);
      this.renderRegistry.markError(this.widget.id, 'Container not available');
      return;
    }

    const containerWidth = this.containerRef.nativeElement.clientWidth;
    const containerHeight = this.containerRef.nativeElement.clientHeight;
    console.log('[ChartWidget] Container dimensions:', this.widget.id, containerWidth, 'x', containerHeight);

    // Mark as rendering
    this.renderRegistry.markRendering(this.widget.id);

    // Destroy existing instance
    if (this.instance) {
      this.instance.destroy?.();
    }

    const providerId = this.chartProps.provider || 'echarts';
    const adapter = this.registry.getAdapter(providerId);

    if (!adapter) {
      const availableAdapters = this.registry.listAdapters();
      console.error('[ChartWidget] No adapter for:', providerId, 'widget:', this.widget.id);
      this.containerRef.nativeElement.innerHTML = `
        <div style="padding: 20px; text-align: center; color: #dc2626;">
          No chart adapter registered for "${providerId}".<br/>
          Available: ${availableAdapters.map(a => a.id).join(', ') || 'none'}
        </div>
      `;
      this.renderRegistry.markError(this.widget.id, `No adapter for ${providerId}`);
      return;
    }

    try {
      console.log('[ChartWidget] Calling adapter.render:', this.widget.id);
      console.log('[ChartWidget] Chart props:', JSON.stringify(this.chartProps, null, 2));
      this.instance = adapter.render(
        this.containerRef.nativeElement,
        this.chartProps
      ) as ChartInstance;
      
      // Mark chart as successfully rendered
      this.isChartRendered = true;
      console.log('[ChartWidget] Chart rendered, marking as rendered:', this.widget.id);
      
      // Use microtask to ensure ECharts has finished initial render
      queueMicrotask(() => {
        this.renderRegistry.markRendered(this.widget.id);
        console.log('[ChartWidget] Marked as rendered:', this.widget.id);
      });
    } catch (error) {
      console.error('[ChartWidget] Render error:', this.widget.id, error);
      this.containerRef.nativeElement.innerHTML = `
        <div style="padding: 20px; text-align: center; color: #dc2626;">
          Chart rendering error. Double-click to configure.<br/>
          Error: ${error instanceof Error ? error.message : String(error)}
        </div>
      `;
      this.renderRegistry.markError(
        this.widget.id, 
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private updateChart(): void {
    this.renderChart();
  }

  private get chartProps(): ChartWidgetProps {
    return this.widget.props as ChartWidgetProps;
  }
}
