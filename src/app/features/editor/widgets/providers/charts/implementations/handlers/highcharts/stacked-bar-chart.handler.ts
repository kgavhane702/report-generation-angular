import * as Highcharts from 'highcharts';
import { ChartSeries } from '../../../../../../../../models/chart-data.model';
import { HighchartsChartTypeHandler } from '../../../interfaces/handlers/highcharts-chart-type-handler.interface';

export class StackedBarChartHandler implements HighchartsChartTypeHandler {
  readonly chartType = 'stackedBar';
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
        stacking: 'normal',
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



