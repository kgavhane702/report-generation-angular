import * as Highcharts from 'highcharts';
import { ChartSeries } from '../../../../models/chart-data.model';
import { HighchartsChartTypeHandler } from './highcharts-chart-type.interface';

export class DonutChartHandler implements HighchartsChartTypeHandler {
  readonly chartType = 'donut';
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
        innerSize: '60%', // Makes it a donut chart
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

