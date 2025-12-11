import { EChartsOption } from 'echarts';
import { ChartSeries } from '../../../../../../../../models/chart-data.model';
import { EChartsChartTypeHandler } from '../../../interfaces/handlers/echarts-chart-type-handler.interface';

export class EChartsStackedBarLineChartHandler implements EChartsChartTypeHandler {
  readonly chartType = 'stackedBarLine';
  readonly echartsType = 'mixed';

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
          type: 'cross',
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
      series: series.map((s, index) => {
        // Determine series type: use series.type if available, otherwise default
        const seriesType = s.type || (index === 0 ? 'bar' : 'line');
        const isBar = seriesType === 'bar';
        const color = s.color || colors?.[index] || defaultColors[index % defaultColors.length];

        if (isBar) {
          return {
            name: s.name,
            type: 'bar' as const,
            stack: 'total',
            data: s.data,
            itemStyle: {
              color: color,
            },
            label: {
              show: showValueLabels === true,
              position: this.getLabelPosition(valueLabelPosition, 'inside') as any,
              formatter: '{c}',
            },
          };
        } else {
          return {
            name: s.name,
            type: 'line' as const,
            data: s.data,
            itemStyle: {
              color: color,
            },
            lineStyle: {
              color: color,
            },
            areaStyle: {
              color: this.addAlpha(color, 0.1),
            },
            label: {
              show: showValueLabels === true,
              position: this.getLabelPosition(valueLabelPosition, 'top') as any,
              formatter: '{c}',
            },
          };
        }
      }) as any,
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

  private addAlpha(color: string, alpha: number): string {
    // Convert hex to rgba
    if (color.startsWith('#')) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    // If already rgba, replace alpha
    if (color.startsWith('rgba(')) {
      return color.replace(/,\s*[\d.]+\)$/, `, ${alpha})`);
    }
    // If rgb, convert to rgba
    if (color.startsWith('rgb(')) {
      return color.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
    }
    return color;
  }
}

