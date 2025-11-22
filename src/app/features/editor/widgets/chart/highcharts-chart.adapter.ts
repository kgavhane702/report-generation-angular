import * as Highcharts from 'highcharts';
// Import Highcharts modules - in v12+, they automatically extend Highcharts without initialization
import 'highcharts/modules/exporting';
import 'highcharts/modules/export-data';
import 'highcharts/modules/accessibility';
import { ChartAdapter, ChartInstance } from './chart-adapter';
import { ChartWidgetProps } from '../../../../models/widget.model';
import { ChartData, ChartSeries } from '../../../../models/chart-data.model';

/**
 * Highcharts adapter implementing ChartAdapter interface.
 * This adapter is loosely coupled - it only depends on the ChartAdapter interface
 * and can be easily replaced with another chart library adapter.
 */
export class HighchartsChartAdapter implements ChartAdapter {
  readonly id = 'highcharts';
  readonly label = 'Highcharts';

  render(container: HTMLElement, props: unknown): ChartInstance {
    const chartProps = props as ChartWidgetProps;
    const chartData = chartProps.data as ChartData | undefined;
    
    if (!chartData) {
      container.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">No chart data</div>';
      return { destroy: () => {} };
    }

    // Ensure container has dimensions
    const width = container.clientWidth || 400;
    const height = container.clientHeight || 300;

    // Clear container
    container.innerHTML = '';

    // Convert provider-agnostic ChartData to Highcharts options
    const options = this.convertToHighchartsOptions(chartData, width, height);

    // Create Highcharts instance
    const chart = Highcharts.chart(container, options);

    return {
      destroy() {
        if (chart && chart.destroy) {
          chart.destroy();
        }
        container.innerHTML = '';
      },
      // Store chart instance for potential updates
      chartInstance: chart,
    } as ChartInstance & { chartInstance: Highcharts.Chart };
  }

  /**
   * Convert provider-agnostic ChartData to Highcharts configuration options
   */
  private convertToHighchartsOptions(
    data: ChartData,
    width: number,
    height: number
  ): Highcharts.Options {
    const chartType = this.mapChartType(data.chartType);
    
    const options: Highcharts.Options = {
      chart: {
        type: chartType,
        width: width,
        height: height,
        backgroundColor: 'transparent',
      },
      title: {
        text: data.title || '',
        style: {
          fontSize: '14px',
          fontWeight: 'bold',
        },
      },
      credits: {
        enabled: false, // Remove Highcharts branding
      },
      exporting: {
        enabled: true,
        buttons: {
          contextButton: {
            enabled: true,
            menuItems: [
              'downloadPNG',
              'downloadJPEG',
              'downloadPDF',
              'downloadSVG',
              'separator',
              'downloadCSV',
              'downloadXLS',
              'viewData',
            ],
            symbol: 'menu',
            x: -10,
            y: 5,
          },
        },
        fallbackToExportServer: false, // Use offline exporting only
      },
      legend: {
        enabled: data.showLegend !== false,
        align: data.legendPosition === 'left' || data.legendPosition === 'right' ? data.legendPosition : 'center',
        verticalAlign: data.legendPosition === 'top' || data.legendPosition === 'bottom' ? data.legendPosition : 'top',
        layout: data.legendPosition === 'left' || data.legendPosition === 'right' ? 'vertical' : 'horizontal',
      },
      xAxis: {
        categories: data.labels || [],
        title: {
          text: data.xAxisLabel || '',
        },
      },
      yAxis: {
        title: {
          text: data.yAxisLabel || '',
        },
      },
      series: this.convertSeries(data.series, chartType, data.chartType),
      plotOptions: this.getPlotOptions(chartType),
      colors: data.colors || this.getDefaultColors(),
    };

    return options;
  }

  /**
   * Map provider-agnostic chart type to Highcharts chart type
   */
  private mapChartType(type: string): Highcharts.ChartOptions['type'] {
    const typeMap: Record<string, Highcharts.ChartOptions['type']> = {
      bar: 'bar',
      column: 'column',
      line: 'line',
      area: 'area',
      pie: 'pie',
      donut: 'pie', // Highcharts handles donut via innerSize in pie
      scatter: 'scatter',
      bubble: 'bubble',
      stackedBar: 'bar',
      stackedColumn: 'column',
    };

    return typeMap[type] || 'column';
  }

  /**
   * Convert provider-agnostic series to Highcharts series format
   */
  private convertSeries(
    series: ChartSeries[],
    mappedChartType: Highcharts.ChartOptions['type'],
    originalChartType: string
  ): Highcharts.SeriesOptionsType[] {
    const isStacked = originalChartType === 'stackedBar' || originalChartType === 'stackedColumn';
    
    return series.map((s) => {
      const seriesType = (s.type ? this.mapChartType(s.type) : mappedChartType) as any;
      
      let baseSeries: Highcharts.SeriesOptionsType;

      // Handle pie/donut charts specially
      if (seriesType === 'pie') {
        const pieSeries: Highcharts.SeriesPieOptions = {
          name: s.name,
          data: s.data,
          type: 'pie',
        };
        
        if (s.color) {
          pieSeries.color = s.color;
        }
        
        // Handle donut chart (pie with innerSize)
        if (s.type === 'donut' || originalChartType === 'donut') {
          pieSeries.innerSize = '60%';
        }
        
        baseSeries = pieSeries;
      } else if (seriesType === 'bar' || seriesType === 'column') {
        // Handle bar/column charts with optional stacking
        const barColumnSeries: Highcharts.SeriesBarOptions | Highcharts.SeriesColumnOptions = {
          name: s.name,
          data: s.data,
          type: seriesType,
        };
        
        if (s.color) {
          barColumnSeries.color = s.color;
        }
        
        // Handle stacked charts
        if (isStacked) {
          barColumnSeries.stacking = 'normal';
        }
        
        baseSeries = barColumnSeries;
      } else {
        // Handle other chart types (line, area, scatter, etc.)
        const otherSeries: any = {
          name: s.name,
          data: s.data,
          type: seriesType,
        };

        if (s.color) {
          otherSeries.color = s.color;
        }
        
        baseSeries = otherSeries as Highcharts.SeriesOptionsType;
      }

      return baseSeries;
    });
  }

  /**
   * Get plot options for specific chart types
   */
  private getPlotOptions(
    chartType: Highcharts.ChartOptions['type']
  ): Highcharts.PlotOptions {
    const plotOptions: Highcharts.PlotOptions = {};

    if (chartType === 'pie' || chartType === 'donut') {
      plotOptions.pie = {
        allowPointSelect: true,
        cursor: 'pointer',
        dataLabels: {
          enabled: true,
          format: '<b>{point.name}</b>: {point.percentage:.1f} %',
        },
      };
    }

    if (chartType === 'bar' || chartType === 'column') {
      plotOptions.column = {
        dataLabels: {
          enabled: false,
        },
      };
      plotOptions.bar = {
        dataLabels: {
          enabled: false,
        },
      };
    }

    if (chartType === 'area') {
      plotOptions.area = {
        fillOpacity: 0.5,
      };
    }

    return plotOptions;
  }

  /**
   * Get default color palette
   */
  private getDefaultColors(): string[] {
    return [
      '#7cb5ec',
      '#434348',
      '#90ed7d',
      '#f7a35c',
      '#8085e9',
      '#f15c80',
      '#e4d354',
      '#2b908f',
      '#f45b5b',
      '#91e8e1',
    ];
  }
}

