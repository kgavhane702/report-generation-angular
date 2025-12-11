import { EChartsOption } from 'echarts';
import { ChartSeries } from '../../../../../../../../models/chart-data.model';
import { EChartsChartTypeHandler } from '../../../interfaces/handlers/echarts-chart-type-handler.interface';

export class EChartsStackedColumnChartHandler implements EChartsChartTypeHandler {
  readonly chartType = 'stackedColumn';
  readonly echartsType = 'bar';

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
  ): EChartsOption {
    const defaultColors = this.getDefaultColors();
    const chartLabels = labels || [];

    return {
      title: title ? {
        text: title,
        left: 'center',
      } : undefined,
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
        },
      },
      legend: {
        show: showLegend !== false,
        data: series.map(s => s.name),
        orient: legendPosition === 'left' || legendPosition === 'right' ? 'vertical' : 'horizontal',
        left: legendPosition === 'left' ? 'left' : legendPosition === 'right' ? 'right' : 'center',
        top: legendPosition === 'top' ? 'top' : legendPosition === 'bottom' ? 'bottom' : 'bottom',
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: chartLabels,
        name: xAxisLabel,
        nameLocation: 'middle',
        nameGap: 30,
        axisLine: {
          show: showAxisLines === true,
        },
        axisTick: {
          show: showAxisLines === true,
        },
        splitLine: {
          show: false,
        },
      },
      yAxis: {
        type: 'value',
        name: yAxisLabel,
        nameLocation: 'middle',
        nameGap: 50,
        axisLine: {
          show: showAxisLines === true,
        },
        axisTick: {
          show: showAxisLines === true,
        },
        splitLine: {
          show: showAxisLines === true,
          lineStyle: {
            color: '#e6e6e6',
          },
        },
      },
      series: series.map((s, index) => ({
        name: s.name,
        type: 'bar',
        stack: 'total',
        data: s.data,
        itemStyle: {
          color: s.color || colors?.[index] || defaultColors[index % defaultColors.length],
        },
        label: {
          show: showValueLabels !== false,
          position: this.getLabelPositionForStackedColumn(valueLabelPosition),
          formatter: '{c}',
          distance: valueLabelPosition === 'inside' ? 0 : 5,
          // Ensure labels are visible when inside
          color: valueLabelPosition === 'inside' ? '#fff' : undefined,
          fontWeight: valueLabelPosition === 'inside' ? 'bold' : undefined,
        },
      })),
    };
  }

  private getDefaultColors(): string[] {
    return [
      '#7CB5EC',
      '#434348',
      '#90ED7D',
      '#F7A35C',
      '#8085E9',
      '#F15C80',
      '#E4D354',
      '#2B908F',
      '#F45B5B',
      '#91E8E1',
    ];
  }

  private getLabelPosition(
    position?: 'inside' | 'top' | 'bottom' | 'left' | 'right',
    defaultPosition: string = 'top'
  ): string {
    if (!position) return defaultPosition;
    return position;
  }

  private getLabelPositionForStackedColumn(
    position?: 'inside' | 'top' | 'bottom' | 'left' | 'right'
  ): string | any {
    if (!position) return 'top'; // Default for vertical stacked columns
    // For vertical stacked columns, 'inside' works but may need special handling
    if (position === 'inside') {
      // Use 'inside' with proper configuration for stacked columns
      return 'inside';
    }
    return position;
  }
}

