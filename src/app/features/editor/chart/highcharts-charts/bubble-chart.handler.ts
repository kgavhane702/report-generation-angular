import * as Highcharts from 'highcharts';
import { ChartSeries } from '../../../../models/chart-data.model';
import { HighchartsChartTypeHandler } from './highcharts-chart-type.interface';

export class BubbleChartHandler implements HighchartsChartTypeHandler {
  readonly chartType = 'bubble';
  readonly highchartsType: Highcharts.ChartOptions['type'] = 'bubble';

  convertSeries(
    series: ChartSeries[],
    originalChartType: string
  ): Highcharts.SeriesOptionsType[] {
    return series.map((s) => {
      // Bubble charts need [x, y, z] format where z is the bubble size
      // For simplicity, we'll use index as x, value as y, and value as z (size)
      const bubbleSeries: Highcharts.SeriesBubbleOptions = {
        name: s.name,
        data: s.data.map((value, index) => [index, value, value]), // [x, y, z]
        type: 'bubble',
      };

      if (s.color) {
        bubbleSeries.color = s.color;
      }

      return bubbleSeries;
    });
  }

  getPlotOptions(): Highcharts.PlotOptions {
    return {};
  }
}

