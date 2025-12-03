/**
 * Chart Type Registries Module
 * 
 * This module provides the base interfaces and implementations for chart type registries.
 * All provider-specific chart type registries extend the base registry and handler interfaces
 * for consistent behavior across different chart libraries.
 */

export { ChartTypeHandler } from './chart-type-handler.interface';
export { ChartTypeRegistry } from './chart-type-registry.interface';
export { BaseChartTypeRegistry } from './base-chart-type-registry';
export { HighchartsChartTypeRegistry, getHighchartsChartTypeRegistry } from './highcharts-chart-type.registry';
export { ChartJsChartTypeRegistry, getChartJsChartTypeRegistry } from './chartjs-chart-type.registry';

