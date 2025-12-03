import * as Highcharts from 'highcharts';
// Import Highcharts modules - in v12+, they automatically extend Highcharts without initialization
import 'highcharts/modules/exporting';
import 'highcharts/modules/export-data';
import 'highcharts/modules/accessibility';
import { ChartAdapter, ChartInstance } from './chart-adapter'; // Keep direct import to avoid circular dependency
import { ChartWidgetProps } from '../../../../models/widget.model';
import { ChartData } from '../../../../models/chart-data.model';
import { getHighchartsChartTypeRegistry } from '../chart-type-registries/highcharts-chart-type.registry';
import { HighchartsChartTypeHandler } from '../highcharts-charts';

/**
 * Highcharts adapter implementing ChartAdapter interface.
 * This adapter is loosely coupled - it only depends on the ChartAdapter interface
 * and can be easily replaced with another chart library adapter.
 */
export class HighchartsChartAdapter implements ChartAdapter {
  readonly id = 'highcharts';
  readonly label = 'Highcharts';
  private readonly chartTypeRegistry = getHighchartsChartTypeRegistry();

  render(container: HTMLElement, props: unknown): ChartInstance {
    const chartProps = props as ChartWidgetProps;
    const chartData = chartProps.data as ChartData | undefined;
    
    if (!chartData) {
      container.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">No chart data</div>';
      return { destroy: () => {} };
    }

    // Ensure container has dimensions
    const width = container.clientWidth || 400;
    const height = container.clientHeight || 300;

    // Clear container
    container.innerHTML = '';

    // Convert provider-agnostic ChartData to Highcharts options
    const options = this.convertToHighchartsOptions(chartData, width, height);

    // Create Highcharts instance
    const chart = Highcharts.chart(container, options);

    return {
      destroy() {
        if (chart && chart.destroy) {
          chart.destroy();
        }
        container.innerHTML = '';
      },
      // Store chart instance for potential updates
      chartInstance: chart,
    } as ChartInstance & { chartInstance: Highcharts.Chart };
  }

  /**
   * Convert provider-agnostic ChartData to Highcharts configuration options
   */
  private convertToHighchartsOptions(
    data: ChartData,
    width: number,
    height: number
  ): Highcharts.Options {
    // Get the chart type handler for this chart type
    const handler = this.chartTypeRegistry.getHandler(data.chartType);
    
    if (!handler) {
      // Fallback to column chart if handler not found
      const defaultHandler = this.chartTypeRegistry.getHandler('column');
      if (!defaultHandler) {
        throw new Error(`No chart handler found for type: ${data.chartType}`);
      }
      return this.buildOptions(data, defaultHandler, width, height);
    }

    return this.buildOptions(data, handler, width, height);
  }

  /**
   * Build Highcharts options using the provided chart type handler
   */
  private buildOptions(
    data: ChartData,
    handler: HighchartsChartTypeHandler,
    width: number,
    height: number
  ): Highcharts.Options {
    const options: Highcharts.Options = {
      chart: {
        type: handler.highchartsType,
        width: width,
        height: height,
        backgroundColor: 'transparent',
      },
      title: {
        text: data.title || '',
        style: {
          fontSize: '14px',
          fontWeight: 'bold',
        },
      },
      credits: {
        enabled: false, // Remove Highcharts branding
      },
      exporting: {
        enabled: true,
        buttons: {
          contextButton: {
            enabled: true,
            menuItems: [
              'downloadPNG',
              'downloadJPEG',
              'downloadPDF',
              'downloadSVG',
              'separator',
              'downloadCSV',
              'downloadXLS',
              'viewData',
            ],
            symbol: 'menu',
            x: -10,
            y: 5,
          },
        },
        fallbackToExportServer: false, // Use offline exporting only
      },
      legend: {
        enabled: data.showLegend !== false,
        align: data.legendPosition === 'left' || data.legendPosition === 'right' ? data.legendPosition : 'center',
        verticalAlign: data.legendPosition === 'top' || data.legendPosition === 'bottom' ? data.legendPosition : 'top',
        layout: data.legendPosition === 'left' || data.legendPosition === 'right' ? 'vertical' : 'horizontal',
      },
      xAxis: {
        categories: data.labels || [],
        title: {
          text: data.xAxisLabel || '',
        },
      },
      yAxis: {
        title: {
          text: data.yAxisLabel || '',
        },
      },
      series: handler.convertSeries(data.series, data.chartType),
      plotOptions: handler.getPlotOptions(),
      colors: data.colors || this.getDefaultColors(),
    };

    return options;
  }


  /**
   * Get default color palette
   */
  private getDefaultColors(): string[] {
    return [
      '#7cb5ec',
      '#434348',
      '#90ed7d',
      '#f7a35c',
      '#8085e9',
      '#f15c80',
      '#e4d354',
      '#2b908f',
      '#f45b5b',
      '#91e8e1',
    ];
  }
}

