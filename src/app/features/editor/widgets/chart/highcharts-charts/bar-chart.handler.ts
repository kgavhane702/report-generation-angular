import * as Highcharts from 'highcharts';
import { ChartSeries } from '../../../../../models/chart-data.model';
import { HighchartsChartTypeHandler } from './highcharts-chart-type.interface';

export class BarChartHandler implements HighchartsChartTypeHandler {
  readonly chartType = 'bar';
  readonly highchartsType: Highcharts.ChartOptions['type'] = 'bar';

  convertSeries(
    series: ChartSeries[],
    originalChartType: string
  ): Highcharts.SeriesOptionsType[] {
    return series.map((s) => {
      const barSeries: Highcharts.SeriesBarOptions = {
        name: s.name,
        data: s.data,
        type: 'bar',
      };

      if (s.color) {
        barSeries.color = s.color;
      }

      return barSeries;
    });
  }

  getPlotOptions(): Highcharts.PlotOptions {
    return {
      bar: {
        dataLabels: {
          enabled: false,
        },
      },
    };
  }
}

