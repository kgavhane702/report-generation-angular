import { ChartTypeHandler } from './chart-type-handler.interface';

/**
 * Base interface for chart type registries.
 * All provider-specific registries should implement this interface
 * to ensure consistent behavior across different chart libraries.
 */
export interface ChartTypeRegistry<THandler extends ChartTypeHandler = ChartTypeHandler> {
  /**
   * Get a chart type handler by chart type
   * @param chartType The chart type identifier (e.g., 'bar', 'column', 'pie')
   * @returns The handler for the chart type, or undefined if not found
   */
  getHandler(chartType: string): THandler | undefined;

  /**
   * Get all registered chart types
   * @returns Array of registered chart type identifiers
   */
  getRegisteredTypes(): string[];
}

