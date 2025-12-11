import { EChartsOption } from 'echarts';
import { ChartSeries } from '../../../../../../../../models/chart-data.model';
import { EChartsChartTypeHandler } from '../../../interfaces/handlers/echarts-chart-type-handler.interface';

export class EChartsPieChartHandler implements EChartsChartTypeHandler {
  readonly chartType = 'pie';
  readonly echartsType = 'pie';

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
    const firstSeries = series[0] || { name: '', data: [] };
    const chartLabels = labels || firstSeries.data.map((_: number, i: number) => `Item ${i + 1}`);
    const defaultColors = this.getDefaultColors();

    return {
      title: title ? {
        text: title,
        left: 'center',
      } : undefined,
      tooltip: {
        trigger: 'item',
        formatter: '{a} <br/>{b}: {c} ({d}%)',
      },
      legend: {
        show: showLegend !== false,
        orient: legendPosition === 'left' || legendPosition === 'right' ? 'vertical' : 'horizontal',
        left: legendPosition === 'left' ? 'left' : legendPosition === 'right' ? 'right' : 'center',
        top: legendPosition === 'top' ? 'top' : legendPosition === 'bottom' ? 'bottom' : 'bottom',
        data: chartLabels,
      },
      series: [
        {
          name: firstSeries.name,
          type: 'pie',
          radius: '50%',
          data: firstSeries.data.map((value: number, index: number) => ({
            value: value,
            name: chartLabels[index] || `Item ${index + 1}`,
            itemStyle: {
              color: colors?.[index] || defaultColors[index % defaultColors.length],
            },
          })),
          label: {
            show: showValueLabels !== false,
            position: this.getLabelPosition(valueLabelPosition, 'inside') as any,
            formatter: '{b}: {c} ({d}%)',
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)',
            },
          },
        },
      ],
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
    // For pie charts, 'top'/'bottom'/'left'/'right' map to 'outside'
    if (position === 'inside') return 'inside';
    return 'outside';
  }
}

