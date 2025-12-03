import { BaseChartTypeRegistry } from './base-chart-type-registry';
import {
  HighchartsChartTypeHandler,
  BarChartHandler,
  ColumnChartHandler,
  LineChartHandler,
  AreaChartHandler,
  PieChartHandler,
  DonutChartHandler,
  ScatterChartHandler,
  StackedBarChartHandler,
  StackedColumnChartHandler,
} from '../highcharts-charts';

/**
 * Registry for Highcharts chart type handlers.
 * Extends BaseChartTypeRegistry to provide Highcharts-specific chart type handlers.
 */
export class HighchartsChartTypeRegistry extends BaseChartTypeRegistry<HighchartsChartTypeHandler> {
  constructor() {
    super();
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
}

// Singleton instance
let registryInstance: HighchartsChartTypeRegistry | null = null;

/**
 * Get the singleton instance of the Highcharts chart type registry
 */
export function getHighchartsChartTypeRegistry(): HighchartsChartTypeRegistry {
  if (!registryInstance) {
    registryInstance = new HighchartsChartTypeRegistry();
  }
  return registryInstance;
}

