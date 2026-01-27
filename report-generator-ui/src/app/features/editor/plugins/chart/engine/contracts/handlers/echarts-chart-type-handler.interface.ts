import { EChartsOption } from 'echarts';
import { ChartSeries } from '../../../../../../../models/chart-data.model';
import { ChartTypeHandler } from './chart-type-handler.interface';

/**
 * Interface for ECharts chart type handlers.
 * Each chart type (bar, column, line, pie, etc.) implements this interface
 * to provide its specific chart configuration conversion.
 */
export interface EChartsChartTypeHandler extends ChartTypeHandler {
  /**
   * The mapped ECharts chart type
   */
  readonly echartsType: string;

  /**
   * Convert provider-agnostic ChartData to ECharts configuration
   */
  convertToEChartsOption(
    series: ChartSeries[],
    labels: string[] | undefined,
    title?: string,
    xAxisLabel?: string,
    yAxisLabel?: string,
    showLegend?: boolean,
    legendPosition?: 'top' | 'bottom' | 'left' | 'right',
    colors?: string[],
    showAxisLines?: boolean,
    showValueLabels?: boolean,
    valueLabelPosition?: 'inside' | 'top' | 'bottom' | 'left' | 'right'
  ): EChartsOption;
}

