import { EChartsOption } from 'echarts';
import { ChartSeries } from '../../../../../../../../models/chart-data.model';
import { EChartsChartTypeHandler } from '../../../interfaces/handlers/echarts-chart-type-handler.interface';

export class EChartsScatterChartHandler implements EChartsChartTypeHandler {
  readonly chartType = 'scatter';
  readonly echartsType = 'scatter';

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
        trigger: 'item',
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
        type: 'value',
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
          show: showAxisLines === true,
          lineStyle: {
            color: '#e6e6e6',
          },
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
        type: 'scatter',
        data: s.data.map((value: number, idx: number) => [idx, value]),
        itemStyle: {
          color: s.color || colors?.[index] || defaultColors[index % defaultColors.length],
        },
        symbolSize: 8,
        label: {
          show: showValueLabels === true,
          position: this.getLabelPosition(valueLabelPosition, 'inside') as any,
          formatter: '{c}',
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
    defaultPosition: string = 'inside'
  ): string {
    if (!position) return defaultPosition;
    return position;
  }
}

