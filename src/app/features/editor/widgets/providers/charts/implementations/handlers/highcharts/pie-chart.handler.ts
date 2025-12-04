import * as Highcharts from 'highcharts';
import { ChartSeries } from '../../../../../../../../models/chart-data.model';
import { HighchartsChartTypeHandler } from '../../../interfaces/handlers/highcharts-chart-type-handler.interface';

export class PieChartHandler implements HighchartsChartTypeHandler {
  readonly chartType = 'pie';
  readonly highchartsType: Highcharts.ChartOptions['type'] = 'pie';

  convertSeries(
    series: ChartSeries[],
    originalChartType: string
  ): Highcharts.SeriesOptionsType[] {
    return series.map((s) => {
      const pieSeries: Highcharts.SeriesPieOptions = {
        name: s.name,
        data: s.data,
        type: 'pie',
      };

      if (s.color) {
        pieSeries.color = s.color;
      }

      return pieSeries;
    });
  }

  getPlotOptions(): Highcharts.PlotOptions {
    return {
      pie: {
        allowPointSelect: true,
        cursor: 'pointer',
        dataLabels: {
          enabled: true,
          format: '<b>{point.name}</b>: {point.percentage:.1f} %',
        },
      },
    };
  }
}



