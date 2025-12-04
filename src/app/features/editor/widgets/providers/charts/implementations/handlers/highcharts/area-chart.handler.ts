import * as Highcharts from 'highcharts';
import { ChartSeries } from '../../../../../../../../models/chart-data.model';
import { HighchartsChartTypeHandler } from '../../../interfaces/handlers/highcharts-chart-type-handler.interface';

export class AreaChartHandler implements HighchartsChartTypeHandler {
  readonly chartType = 'area';
  readonly highchartsType: Highcharts.ChartOptions['type'] = 'area';

  convertSeries(
    series: ChartSeries[],
    originalChartType: string
  ): Highcharts.SeriesOptionsType[] {
    return series.map((s) => {
      const areaSeries: Highcharts.SeriesAreaOptions = {
        name: s.name,
        data: s.data,
        type: 'area',
      };

      if (s.color) {
        areaSeries.color = s.color;
      }

      return areaSeries;
    });
  }

  getPlotOptions(): Highcharts.PlotOptions {
    return {
      area: {
        fillOpacity: 0.5,
      },
    };
  }
}



