import { ChartConfiguration } from 'chart.js';
import { ChartSeries } from '../../../../../../../../models/chart-data.model';
import { ChartJsChartTypeHandler } from '../../../contracts/handlers/chartjs-chart-type-handler.interface';

export class ChartJsAreaChartHandler implements ChartJsChartTypeHandler {
  readonly chartType = 'area';
  readonly chartJsType: ChartConfiguration['type'] = 'line';

  convertToChartJsConfig(
    series: ChartSeries[],
    labels: string[] | undefined,
    title?: string,
    xAxisLabel?: string,
    yAxisLabel?: string,
    showLegend?: boolean,
    legendPosition?: 'top' | 'bottom' | 'left' | 'right',
    colors?: string[],
    showValueLabels?: boolean,
    valueLabelPosition?: 'inside' | 'top' | 'bottom' | 'left' | 'right'
  ): ChartConfiguration {
    const defaultColors = this.getDefaultColors();
    
    return {
      type: 'line',
      data: {
        labels: labels || [],
        datasets: series.map((s, index) => {
          const baseColor = s.color || colors?.[index] || defaultColors[index % defaultColors.length];
          const bgColor = baseColor.includes('rgba') 
            ? baseColor 
            : baseColor.replace('rgb', 'rgba').replace(')', ', 0.5)');
          
          return {
            label: s.name,
            data: s.data,
            borderColor: baseColor,
            backgroundColor: bgColor,
            borderWidth: 2,
            fill: true,
            tension: 0.1,
          };
        }),
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
      'rgb(124, 181, 236)',
      'rgb(67, 67, 72)',
      'rgb(144, 237, 125)',
      'rgb(247, 163, 92)',
      'rgb(128, 133, 233)',
      'rgb(241, 92, 128)',
      'rgb(228, 211, 84)',
      'rgb(43, 144, 143)',
      'rgb(244, 91, 91)',
      'rgb(145, 232, 225)',
    ];
  }
}


