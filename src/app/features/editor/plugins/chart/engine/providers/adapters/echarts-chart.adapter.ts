import * as echarts from 'echarts';
import { ChartAdapter, ChartInstance } from '../../contracts/adapters/chart-adapter.interface';
import { ChartWidgetProps } from '../../../../../../../models/widget.model';
import { ChartData } from '../../../../../../../models/chart-data.model';
import { getEChartsChartTypeRegistry } from '../../type-registries/echarts-chart-type.registry';

export class EChartsChartAdapter implements ChartAdapter {
  readonly id = 'echarts';
  readonly label = 'ECharts';
  private readonly chartTypeRegistry = getEChartsChartTypeRegistry();

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
    
    const chart = echarts.init(container);
    const option = this.convertToEChartsOption(chartData, width, height);
    chart.setOption(option);

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      chart.resize();
    });
    resizeObserver.observe(container);

    return {
      destroy() {
        resizeObserver.disconnect();
        if (chart && chart.dispose) {
          chart.dispose();
        }
        container.innerHTML = '';
      },
      chartInstance: chart,
    } as ChartInstance & { chartInstance: echarts.ECharts };
  }

  private convertToEChartsOption(
    data: ChartData,
    width: number,
    height: number
  ): echarts.EChartsOption {
    const handler = this.chartTypeRegistry.getHandler(data.chartType);
    
    if (!handler) {
      const defaultHandler = this.chartTypeRegistry.getHandler('column');
      if (!defaultHandler) {
        throw new Error(`No chart handler found for type: ${data.chartType}`);
      }
      return this.buildOption(data, defaultHandler);
    }

    return this.buildOption(data, handler);
  }

  private buildOption(
    data: ChartData,
    handler: ReturnType<typeof this.chartTypeRegistry.getHandler>
  ): echarts.EChartsOption {
    if (!handler) {
      throw new Error('Chart handler is required');
    }

    return handler.convertToEChartsOption(
      data.series,
      data.labels,
      data.title,
      data.xAxisLabel,
      data.yAxisLabel,
      data.showLegend,
      data.legendPosition,
      data.colors,
      data.showAxisLines,
      data.showValueLabels,
      data.valueLabelPosition
    );
  }
}

