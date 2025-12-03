import * as Highcharts from 'highcharts';
import { ChartSeries } from '../../../../../models/chart-data.model';
import { ChartTypeHandler } from './chart-type-handler.interface';

/**
 * Interface for Highcharts chart type handlers.
 * Each chart type (bar, column, pie, etc.) implements this interface
 * to provide its specific series conversion and plot options.
 */
export interface HighchartsChartTypeHandler extends ChartTypeHandler {
  /**
   * The mapped Highcharts chart type
   */
  readonly highchartsType: Highcharts.ChartOptions['type'];

  /**
   * Convert provider-agnostic series to Highcharts series format
   */
  convertSeries(
    series: ChartSeries[],
    originalChartType: string
  ): Highcharts.SeriesOptionsType[];

  /**
   * Get plot options specific to this chart type
   */
  getPlotOptions(): Highcharts.PlotOptions;
}

