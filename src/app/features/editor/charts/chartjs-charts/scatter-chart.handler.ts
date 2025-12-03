import { ChartConfiguration } from 'chart.js';
import { ChartSeries } from '../../../../models/chart-data.model';
import { ChartJsChartTypeHandler } from './chartjs-chart-type.interface';

export class ChartJsScatterChartHandler implements ChartJsChartTypeHandler {
  readonly chartType = 'scatter';
  readonly chartJsType: ChartConfiguration['type'] = 'scatter';

  convertToChartJsConfig(
    series: ChartSeries[],
    labels: string[] | undefined,
    title?: string,
    xAxisLabel?: string,
    yAxisLabel?: string,
    showLegend?: boolean,
    legendPosition?: 'top' | 'bottom' | 'left' | 'right',
    colors?: string[]
  ): ChartConfiguration {
    const defaultColors = this.getDefaultColors();
    
    return {
      type: 'scatter',
      data: {
        datasets: series.map((s, index) => ({
          label: s.name,
          data: s.data.map((value, idx) => ({
            x: idx,
            y: value,
          })),
          backgroundColor: s.color || colors?.[index] || defaultColors[index % defaultColors.length],
          borderColor: s.color || colors?.[index] || defaultColors[index % defaultColors.length],
          borderWidth: 1,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: !!title,
            text: title || '',
          },
          legend: {
            display: showLegend !== false,
            position: legendPosition || 'top',
          },
        },
        scales: {
          x: {
            title: {
              display: !!xAxisLabel,
              text: xAxisLabel || '',
            },
            beginAtZero: true,
          },
          y: {
            title: {
              display: !!yAxisLabel,
              text: yAxisLabel || '',
            },
            beginAtZero: true,
          },
        },
      },
    };
  }

  private getDefaultColors(): string[] {
    return [
      'rgba(124, 181, 236, 0.8)',
      'rgba(67, 67, 72, 0.8)',
      'rgba(144, 237, 125, 0.8)',
      'rgba(247, 163, 92, 0.8)',
      'rgba(128, 133, 233, 0.8)',
      'rgba(241, 92, 128, 0.8)',
      'rgba(228, 211, 84, 0.8)',
      'rgba(43, 144, 143, 0.8)',
      'rgba(244, 91, 91, 0.8)',
      'rgba(145, 232, 225, 0.8)',
    ];
  }
}
