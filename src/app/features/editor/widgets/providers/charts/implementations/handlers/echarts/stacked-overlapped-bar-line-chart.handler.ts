import { EChartsOption } from 'echarts';
import { ChartSeries } from '../../../../../../../../models/chart-data.model';
import { EChartsChartTypeHandler } from '../../../interfaces/handlers/echarts-chart-type-handler.interface';

export class EChartsStackedOverlappedBarLineChartHandler implements EChartsChartTypeHandler {
  readonly chartType = 'stackedOverlappedBarLine';
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

    // Find the highest bar value among all bar series
    const barSeries = series.filter(s => (s.type || 'bar') === 'bar');
    const maxBarValue = Math.max(
      ...barSeries.flatMap(s => (s.data as number[]).map(v => v ?? 0))
    );

    const lineOffset = maxBarValue + 1;

    // Prepare ECharts series
    const echartsSeries = series.map((s, idx) => {
      const seriesType = s.type || (idx === 0 ? 'bar' : 'line');
      const color = s.color || colors?.[idx] || defaultColors[idx % defaultColors.length];

      if (seriesType === 'bar') {
        return {
          name: s.name,
          type: 'bar' as const,
          stack: 'total',
          data: s.data,
          itemStyle: { color },
          label: {
            show: showValueLabels,
            position: valueLabelPosition || 'top',
            formatter: '{c}',
            distance: valueLabelPosition === 'inside' ? 0 : 5,
            color: valueLabelPosition === 'inside' ? '#fff' : undefined,
            fontWeight: valueLabelPosition === 'inside' ? 'bold' : undefined,
          },
        };
      } else {
        // Offset all line points by (maxBarValue + 1)
        const originalData = s.data as number[];
        const offsetData = originalData.map(v => lineOffset + (v ?? 0));

        return {
          name: s.name,
          type: 'line' as const,
          data: offsetData,
          itemStyle: { color },
          lineStyle: { color, width: 2 },
          label: {
            show: showValueLabels,
            position: valueLabelPosition === 'inside' ? 'top' : (valueLabelPosition || 'top'),
            formatter: (params: any) => originalData[params.dataIndex],
          },
          symbol: 'circle',
          smooth: true,
          _originalLineValues: originalData,
        } as any;
      }
    });

    return {
      title: title ? { text: title, left: 'center' } : undefined,
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          let tooltip = params[0]?.axisValueLabel ? params[0].axisValueLabel + '<br/>' : '';

          params.forEach((item: any) => {
            if (item.seriesType === 'line' && item.seriesIndex != null) {
              const orig = (echartsSeries as any)[item.seriesIndex]._originalLineValues?.[item.dataIndex];
              tooltip += `<span style="display:inline-block;margin-right:5px;border-radius:10px;width:9px;height:9px;background-color:${item.color};"></span>`;
              tooltip += `${item.seriesName}: ${orig ?? item.data}<br/>`;
            } else {
              tooltip += `<span style="display:inline-block;margin-right:5px;border-radius:10px;width:9px;height:9px;background-color:${item.color};"></span>`;
              tooltip += `${item.seriesName}: ${item.data}<br/>`;
            }
          });

          return tooltip;
        },
      },
      legend: {
        show: showLegend,
        data: series.map(s => s.name),
        orient: legendPosition === 'left' || legendPosition === 'right' ? 'vertical' : 'horizontal',
        left: legendPosition === 'left' ? 'left' : legendPosition === 'right' ? 'right' : 'center',
        top: legendPosition === 'top' ? 'top' : legendPosition === 'bottom' ? 'bottom' : 'bottom',
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: chartLabels,
        name: xAxisLabel,
        nameLocation: 'middle',
        nameGap: 30,
        axisLine: { show: showAxisLines === true },
        axisTick: { show: showAxisLines === true },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        name: yAxisLabel,
        nameLocation: 'middle',
        nameGap: 50,
        axisLine: { show: showAxisLines === true },
        axisTick: { show: showAxisLines === true },
        splitLine: { show: showAxisLines === true, lineStyle: { color: '#e6e6e6' } },
      },
      series: echartsSeries as any,
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
}
