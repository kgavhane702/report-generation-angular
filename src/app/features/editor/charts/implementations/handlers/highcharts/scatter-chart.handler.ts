import * as Highcharts from 'highcharts';
import { ChartSeries } from '../../../../../../models/chart-data.model';
import { HighchartsChartTypeHandler } from '../../../interfaces/handlers/highcharts-chart-type-handler.interface';

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
        data: s.data.map((value: number, index: number) => [index, value]),
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
