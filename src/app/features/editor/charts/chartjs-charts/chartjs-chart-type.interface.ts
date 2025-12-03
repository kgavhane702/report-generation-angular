import { ChartConfiguration } from 'chart.js';
import { ChartSeries } from '../../../../models/chart-data.model';
import { ChartTypeHandler } from '../chart-type-registries/chart-type-handler.interface';

/**
 * Interface for Chart.js chart type handlers.
 * Each chart type (bar, column, line, pie, etc.) implements this interface
 * to provide its specific chart configuration conversion.
 */
export interface ChartJsChartTypeHandler extends ChartTypeHandler {

  /**
   * The mapped Chart.js chart type
   */
  readonly chartJsType: ChartConfiguration['type'];

  /**
   * Convert provider-agnostic ChartData to Chart.js configuration
   */
  convertToChartJsConfig(
    series: ChartSeries[],
    labels: string[] | undefined,
    title?: string,
    xAxisLabel?: string,
    yAxisLabel?: string,
    showLegend?: boolean,
    legendPosition?: 'top' | 'bottom' | 'left' | 'right',
    colors?: string[]
  ): ChartConfiguration;
}
