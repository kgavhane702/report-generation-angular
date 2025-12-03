import * as Highcharts from 'highcharts';
import { ChartSeries } from '../../../../../../models/chart-data.model';
import { HighchartsChartTypeHandler } from '../../../interfaces/handlers/highcharts-chart-type-handler.interface';

export class LineChartHandler implements HighchartsChartTypeHandler {
  readonly chartType = 'line';
  readonly highchartsType: Highcharts.ChartOptions['type'] = 'line';

  convertSeries(
    series: ChartSeries[],
    originalChartType: string
  ): Highcharts.SeriesOptionsType[] {
    return series.map((s) => {
      const lineSeries: Highcharts.SeriesLineOptions = {
        name: s.name,
        data: s.data,
        type: 'line',
      };

      if (s.color) {
        lineSeries.color = s.color;
      }

      return lineSeries;
    });
  }

  getPlotOptions(): Highcharts.PlotOptions {
    return {};
  }
}



