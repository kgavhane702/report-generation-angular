import * as Highcharts from 'highcharts';
import { ChartSeries } from '../../../../models/chart-data.model';
import { HighchartsChartTypeHandler } from './highcharts-chart-type.interface';

export class ColumnChartHandler implements HighchartsChartTypeHandler {
  readonly chartType = 'column';
  readonly highchartsType: Highcharts.ChartOptions['type'] = 'column';

  convertSeries(
    series: ChartSeries[],
    originalChartType: string
  ): Highcharts.SeriesOptionsType[] {
    return series.map((s) => {
      const columnSeries: Highcharts.SeriesColumnOptions = {
        name: s.name,
        data: s.data,
        type: 'column',
      };

      if (s.color) {
        columnSeries.color = s.color;
      }

      return columnSeries;
    });
  }

  getPlotOptions(): Highcharts.PlotOptions {
    return {
      column: {
        dataLabels: {
          enabled: false,
        },
      },
    };
  }
}

