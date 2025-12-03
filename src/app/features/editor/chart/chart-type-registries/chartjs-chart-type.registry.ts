import { BaseChartTypeRegistry } from './base-chart-type-registry';
import {
  ChartJsChartTypeHandler,
  ChartJsBarChartHandler,
  ChartJsColumnChartHandler,
  ChartJsLineChartHandler,
  ChartJsAreaChartHandler,
  ChartJsPieChartHandler,
  ChartJsDonutChartHandler,
  ChartJsScatterChartHandler,
  ChartJsStackedBarChartHandler,
  ChartJsStackedColumnChartHandler,
} from '../chartjs-charts';

/**
 * Registry for Chart.js chart type handlers.
 * Extends BaseChartTypeRegistry to provide Chart.js-specific chart type handlers.
 */
export class ChartJsChartTypeRegistry extends BaseChartTypeRegistry<ChartJsChartTypeHandler> {
  constructor() {
    super();
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
}

// Singleton instance
let registryInstance: ChartJsChartTypeRegistry | null = null;

/**
 * Get the singleton instance of the Chart.js chart type registry
 */
export function getChartJsChartTypeRegistry(): ChartJsChartTypeRegistry {
  if (!registryInstance) {
    registryInstance = new ChartJsChartTypeRegistry();
  }
  return registryInstance;
}

