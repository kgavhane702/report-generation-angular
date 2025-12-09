import { ChartConfiguration } from 'chart.js';
import { ChartSeries } from '../../../../../../../../models/chart-data.model';
import { ChartJsChartTypeHandler } from '../../../interfaces/handlers/chartjs-chart-type-handler.interface';

export class ChartJsStackedBarLineChartHandler implements ChartJsChartTypeHandler {
  readonly chartType = 'stackedBarLine';
  readonly chartJsType: ChartConfiguration['type'] = 'line';

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
    
    // For stacked bar/line combo chart:
    // - Each series can specify its type ('bar' or 'line') via series.type
    // - If not specified, defaults: first series = bar, others = line
    // - All datasets use stack: 'combined' to stack them together
    // - Y-axis needs stacked: true
    
    return {
      type: 'line',
      data: {
        labels: labels || [],
        datasets: series.map((s, index) => {
          // Determine series type: use series.type if available, otherwise default
          const seriesType = s.type || (index === 0 ? 'bar' : 'line');
          const isBar = seriesType === 'bar';
          const color = s.color || colors?.[index] || defaultColors[index % defaultColors.length];
          
          return {
            label: s.name,
            data: s.data,
            type: seriesType as 'bar' | 'line',
            stack: 'combined',
            backgroundColor: isBar 
              ? this.addAlpha(color, 0.5) 
              : 'transparent',
            borderColor: color,
            borderWidth: isBar ? 1 : 2,
            tension: isBar ? undefined : 0.1,
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
            stacked: true,
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

  private addAlpha(color: string, alpha: number): string {
    // Convert rgb(r, g, b) to rgba(r, g, b, alpha)
    if (color.startsWith('rgb(')) {
      return color.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
    }
    // If already rgba or hex, try to convert
    if (color.startsWith('rgba(')) {
      return color;
    }
    // For hex colors, convert to rgba
    if (color.startsWith('#')) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    // Fallback: wrap in rgba
    return `rgba(${color}, ${alpha})`;
  }
}
