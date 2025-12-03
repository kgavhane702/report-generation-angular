import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { ChartAdapter, ChartInstance } from './chart-adapter';
import { ChartWidgetProps } from '../../../../models/widget.model';
import { ChartData } from '../../../../models/chart-data.model';
import { getChartJsChartTypeRegistry } from '../chart-type-registries/chartjs-chart-type.registry';

// Register all Chart.js components
Chart.register(...registerables);

/**
 * Chart.js adapter implementing ChartAdapter interface.
 * This adapter is loosely coupled - it only depends on the ChartAdapter interface
 * and can be easily replaced with another chart library adapter.
 */
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

    // Ensure container has dimensions
    const width = container.clientWidth || 400;
    const height = container.clientHeight || 300;

    // Clear container
    container.innerHTML = '';
    
    // Create canvas element
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);

    // Convert provider-agnostic ChartData to Chart.js configuration
    const config = this.convertToChartJsConfig(chartData, width, height);

    // Create Chart.js instance
    const chart = new Chart(canvas, config);

    return {
      destroy() {
        if (chart && chart.destroy) {
          chart.destroy();
        }
        container.innerHTML = '';
      },
      // Store chart instance for potential updates
      chartInstance: chart,
    } as ChartInstance & { chartInstance: Chart };
  }

  /**
   * Convert provider-agnostic ChartData to Chart.js configuration
   */
  private convertToChartJsConfig(
    data: ChartData,
    width: number,
    height: number
  ): ChartConfiguration {
    // Get the chart type handler for this chart type
    const handler = this.chartTypeRegistry.getHandler(data.chartType);
    
    if (!handler) {
      // Fallback to column chart if handler not found
      const defaultHandler = this.chartTypeRegistry.getHandler('column');
      if (!defaultHandler) {
        throw new Error(`No chart handler found for type: ${data.chartType}`);
      }
      return this.buildConfig(data, defaultHandler);
    }

    return this.buildConfig(data, handler);
  }

  /**
   * Build Chart.js configuration using the provided chart type handler
   */
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
      data.colors
    );

    return config;
  }
}

