import { ChartJsChartTypeHandler } from './chartjs-chart-type.interface';
import { ChartJsBarChartHandler } from './bar-chart.handler';
import { ChartJsColumnChartHandler } from './column-chart.handler';
import { ChartJsLineChartHandler } from './line-chart.handler';
import { ChartJsAreaChartHandler } from './area-chart.handler';
import { ChartJsPieChartHandler } from './pie-chart.handler';
import { ChartJsDonutChartHandler } from './donut-chart.handler';
import { ChartJsScatterChartHandler } from './scatter-chart.handler';
import { ChartJsStackedBarChartHandler } from './stacked-bar-chart.handler';
import { ChartJsStackedColumnChartHandler } from './stacked-column-chart.handler';

/**
 * Registry for Chart.js chart type handlers.
 * Dynamically loads and provides chart type handlers based on chart type.
 */
export class ChartJsChartTypeRegistry {
  private readonly handlers = new Map<string, ChartJsChartTypeHandler>();

  constructor() {
    // Register all chart type handlers
    this.register(new ChartJsBarChartHandler());
    this.register(new ChartJsColumnChartHandler());
    this.register(new ChartJsLineChartHandler());
    this.register(new ChartJsAreaChartHandler());
    this.register(new ChartJsPieChartHandler());
    this.register(new ChartJsDonutChartHandler());
    this.register(new ChartJsScatterChartHandler());
    this.register(new ChartJsStackedBarChartHandler());
    this.register(new ChartJsStackedColumnChartHandler());
  }

  /**
   * Register a chart type handler
   */
  private register(handler: ChartJsChartTypeHandler): void {
    this.handlers.set(handler.chartType, handler);
  }

  /**
   * Get a chart type handler by chart type
   */
  getHandler(chartType: string): ChartJsChartTypeHandler | undefined {
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
let registryInstance: ChartJsChartTypeRegistry | null = null;

/**
 * Get the singleton instance of the chart type registry
 */
export function getChartJsChartTypeRegistry(): ChartJsChartTypeRegistry {
  if (!registryInstance) {
    registryInstance = new ChartJsChartTypeRegistry();
  }
  return registryInstance;
}

