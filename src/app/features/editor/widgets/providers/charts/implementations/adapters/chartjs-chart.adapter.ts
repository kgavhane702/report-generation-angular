import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { ChartAdapter, ChartInstance } from '../../interfaces/adapters/chart-adapter.interface';
import { ChartWidgetProps } from '../../../../../../../models/widget.model';
import { ChartData } from '../../../../../../../models/chart-data.model';
import { getChartJsChartTypeRegistry } from '../registries/chartjs-chart-type.registry';

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
    const config = this.convertToChartJsConfig(chartData, width, height);
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
      data.colors
    );

    return config;
  }
}


