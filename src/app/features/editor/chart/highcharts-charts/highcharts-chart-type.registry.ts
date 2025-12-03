import { HighchartsChartTypeHandler } from './highcharts-chart-type.interface';
import { BarChartHandler } from './bar-chart.handler';
import { ColumnChartHandler } from './column-chart.handler';
import { LineChartHandler } from './line-chart.handler';
import { AreaChartHandler } from './area-chart.handler';
import { PieChartHandler } from './pie-chart.handler';
import { DonutChartHandler } from './donut-chart.handler';
import { ScatterChartHandler } from './scatter-chart.handler';
import { StackedBarChartHandler } from './stacked-bar-chart.handler';
import { StackedColumnChartHandler } from './stacked-column-chart.handler';

/**
 * Registry for Highcharts chart type handlers.
 * Dynamically loads and provides chart type handlers based on chart type.
 */
export class HighchartsChartTypeRegistry {
  private readonly handlers = new Map<string, HighchartsChartTypeHandler>();

  constructor() {
    // Register all chart type handlers
    this.register(new BarChartHandler());
    this.register(new ColumnChartHandler());
    this.register(new LineChartHandler());
    this.register(new AreaChartHandler());
    this.register(new PieChartHandler());
    this.register(new DonutChartHandler());
    this.register(new ScatterChartHandler());
    this.register(new StackedBarChartHandler());
    this.register(new StackedColumnChartHandler());
  }

  /**
   * Register a chart type handler
   */
  private register(handler: HighchartsChartTypeHandler): void {
    this.handlers.set(handler.chartType, handler);
  }

  /**
   * Get a chart type handler by chart type
   */
  getHandler(chartType: string): HighchartsChartTypeHandler | undefined {
    return this.handlers.get(chartType);
  }

  /**
   * Get all registered chart types
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.handlers.keys());
  }
}

// Singleton instance
let registryInstance: HighchartsChartTypeRegistry | null = null;

/**
 * Get the singleton instance of the chart type registry
 */
export function getChartTypeRegistry(): HighchartsChartTypeRegistry {
  if (!registryInstance) {
    registryInstance = new HighchartsChartTypeRegistry();
  }
  return registryInstance;
}

