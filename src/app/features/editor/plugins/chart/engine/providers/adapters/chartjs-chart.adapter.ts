import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { ChartAdapter, ChartInstance } from '../../contracts/adapters/chart-adapter.interface';
import { ChartWidgetProps } from '../../../../../../../models/widget.model';
import { ChartData, filterChartDataByLabelVisibility } from '../../../../../../../models/chart-data.model';
import { getChartJsChartTypeRegistry } from '../../type-registries/chartjs-chart-type.registry';

Chart.register(...registerables);

export class ChartJsChartAdapter implements ChartAdapter {
  readonly id = 'chartjs';
  readonly label = 'Chart.js';
  private readonly chartTypeRegistry = getChartJsChartTypeRegistry();

  render(container: HTMLElement, props: unknown): ChartInstance {
    const chartProps = props as ChartWidgetProps;
    const chartData = chartProps.data as ChartData | undefined;
    
    if (!chartData) {
      container.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">No chart data</div>';
      return { destroy: () => {} };
    }

    const width = container.clientWidth || 400;
    const height = container.clientHeight || 300;
    container.innerHTML = '';
    
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);
    const filteredData = filterChartDataByLabelVisibility(chartData);
    const config = this.convertToChartJsConfig(filteredData, width, height);
    const chart = new Chart(canvas, config);

    return {
      destroy() {
        if (chart && chart.destroy) {
          chart.destroy();
        }
        container.innerHTML = '';
      },
      chartInstance: chart,
    } as ChartInstance & { chartInstance: Chart };
  }

  private convertToChartJsConfig(
    data: ChartData,
    width: number,
    height: number
  ): ChartConfiguration {
    const handler = this.chartTypeRegistry.getHandler(data.chartType);
    
    if (!handler) {
      const defaultHandler = this.chartTypeRegistry.getHandler('column');
      if (!defaultHandler) {
        throw new Error(`No chart handler found for type: ${data.chartType}`);
      }
      return this.buildConfig(data, defaultHandler);
    }

    return this.buildConfig(data, handler);
  }

  private buildConfig(
    data: ChartData,
    handler: ReturnType<typeof this.chartTypeRegistry.getHandler>
  ): ChartConfiguration {
    if (!handler) {
      throw new Error('Chart handler is required');
    }

    const config = handler.convertToChartJsConfig(
      data.series,
      data.labels,
      data.title,
      data.xAxisLabel,
      data.yAxisLabel,
      data.showLegend,
      data.legendPosition,
      data.colors,
      data.showValueLabels,
      data.valueLabelPosition
    );

    // Apply showAxisLines setting
    const showAxisLines = data.showAxisLines === true;
    if (config.options && config.options.scales) {
      const xScale = config.options.scales['x'];
      const yScale = config.options.scales['y'];
      
      if (xScale) {
        xScale.grid = {
          display: showAxisLines,
          color: showAxisLines ? '#e6e6e6' : 'transparent',
        };
        // Axis line (border) is controlled through ticks.border
        if (xScale.ticks) {
          (xScale.ticks as any).drawBorder = showAxisLines;
        } else {
          xScale.ticks = {
            drawBorder: showAxisLines,
          } as any;
        }
      }
      
      if (yScale) {
        yScale.grid = {
          display: showAxisLines,
          color: showAxisLines ? '#e6e6e6' : 'transparent',
        };
        // Axis line (border) is controlled through ticks.border
        if (yScale.ticks) {
          (yScale.ticks as any).drawBorder = showAxisLines;
        } else {
          yScale.ticks = {
            drawBorder: showAxisLines,
          } as any;
        }
      }
    }

    // Apply value labels setting through Chart.js plugin configuration
    const showValueLabels = data.showValueLabels !== false;
    const valueLabelPosition = data.valueLabelPosition || 'top';
    
    if (showValueLabels && config.options) {
      if (!config.options.plugins) {
        config.options.plugins = {};
      }
      
      // Configure datalabels plugin if available
      (config.options.plugins as any).datalabels = {
        display: showValueLabels,
        anchor: this.getDatalabelsAnchor(valueLabelPosition),
        align: this.getDatalabelsAlign(valueLabelPosition),
        offset: valueLabelPosition === 'inside' ? 0 : 5,
        formatter: (value: number) => value,
      };
    }

    return config;
  }

  private getDatalabelsAnchor(position: string): string {
    switch (position) {
      case 'top': return 'end';
      case 'bottom': return 'start';
      case 'left': return 'end';
      case 'right': return 'start';
      case 'inside': return 'center';
      default: return 'end';
    }
  }

  private getDatalabelsAlign(position: string): string {
    switch (position) {
      case 'top': return 'top';
      case 'bottom': return 'bottom';
      case 'left': return 'left';
      case 'right': return 'right';
      case 'inside': return 'center';
      default: return 'top';
    }
  }
}


