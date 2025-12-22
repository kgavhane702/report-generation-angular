import { ChartConfiguration } from 'chart.js';
import { ChartSeries } from '../../../../../../../../models/chart-data.model';
import { ChartJsChartTypeHandler } from '../../../contracts/handlers/chartjs-chart-type-handler.interface';

export class ChartJsStackedOverlappedBarLineChartHandler implements ChartJsChartTypeHandler {
  readonly chartType = 'stackedOverlappedBarLine';
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

    // Collect all bar datasets to compute the stacked bar value at each index
    const barSeries = series.filter(s => (s.type || 'bar') === 'bar');

    // Find the highest bar value
    const maxBarValue = Math.max(...barSeries.flatMap(s => s.data as number[]));

    // Prepare datasets, storing original line values for tooltip
    const datasets = series.map((s, index) => {
      const seriesType = s.type || (index === 0 ? 'bar' : 'line');
      const isBar = seriesType === 'bar';
      const color = s.color || colors?.[index] || defaultColors[index % defaultColors.length];

      let data = s.data;
      const extra: any = {};

      if (!isBar) {
        // Offset line by the stacked bar value at each index
        data = (s.data as number[]).map((v) => (maxBarValue + 2) + (v || 0));
        // Store original values for tooltip
        extra._originalLineValues = s.data;
      }

      return {
        label: s.name,
        data,
        type: seriesType as 'bar' | 'line',
        stack: isBar ? 'total' : 'overlap',
        backgroundColor: isBar ? this.addAlpha(color, 0.5) : 'transparent',
        borderColor: color,
        borderWidth: isBar ? 1 : 2,
        ...extra,
      };
    });

    return {
      type: 'bar',
      data: {
        labels: labels || [],
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
          tooltip: {
            callbacks: {
              label: function (context) {
                const dataset: any = context.dataset;
                // For line, show original value if available
                if (dataset.type === 'line' && dataset._originalLineValues) {
                  const original = dataset._originalLineValues[context.dataIndex];
                  return `${dataset.label}: ${original}`;
                }
                // For bar, show value as usual
                return `${dataset.label}: ${context.parsed.y}`;
              },
            },
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
            stacked: false,
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
