import * as Highcharts from 'highcharts';
import { ChartSeries } from '../../../../../models/chart-data.model';
import { HighchartsChartTypeHandler } from './highcharts-chart-type.interface';

export class ScatterChartHandler implements HighchartsChartTypeHandler {
  readonly chartType = 'scatter';
  readonly highchartsType: Highcharts.ChartOptions['type'] = 'scatter';

  convertSeries(
    series: ChartSeries[],
    originalChartType: string
  ): Highcharts.SeriesOptionsType[] {
    return series.map((s) => {
      const scatterSeries: Highcharts.SeriesScatterOptions = {
        name: s.name,
        data: s.data.map((value, index) => [index, value]), // Convert to [x, y] pairs
        type: 'scatter',
      };

      if (s.color) {
        scatterSeries.color = s.color;
      }

      return scatterSeries;
    });
  }

  getPlotOptions(): Highcharts.PlotOptions {
    return {};
  }
}

