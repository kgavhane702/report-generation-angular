import { ChartConfiguration } from 'chart.js';
import { ChartSeries } from '../../../../../../models/chart-data.model';
import { ChartJsChartTypeHandler } from '../../../interfaces/handlers/chartjs-chart-type-handler.interface';

export class ChartJsDonutChartHandler implements ChartJsChartTypeHandler {
  readonly chartType = 'donut';
  readonly chartJsType: ChartConfiguration['type'] = 'doughnut';

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
    const firstSeries = series[0] || { name: '', data: [] };
    const chartLabels = labels || firstSeries.data.map((_: number, i: number) => `Item ${i + 1}`);
    const defaultColors = this.getDefaultColors();
    
    const datasets = [{
      label: firstSeries.name,
      data: firstSeries.data,
      backgroundColor: firstSeries.data.map((_: number, index: number) => 
        colors?.[index] || defaultColors[index % defaultColors.length]
      ),
      borderColor: '#fff',
      borderWidth: 2,
    }];

    return {
      type: 'doughnut',
      data: {
        labels: chartLabels,
        datasets,
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
        elements: {
          arc: {
            cutout: '60%',
          },
        },
      },
    } as ChartConfiguration;
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


