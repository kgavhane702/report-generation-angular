import { ChartTypeRegistry } from './chart-type-registry.interface';
import { ChartTypeHandler } from './chart-type-handler.interface';

/**
 * Base implementation of ChartTypeRegistry.
 * Provides common registry functionality that can be extended
 * by provider-specific implementations.
 */
export abstract class BaseChartTypeRegistry<THandler extends ChartTypeHandler>
  implements ChartTypeRegistry<THandler>
{
  protected readonly handlers = new Map<string, THandler>();

  /**
   * Get a chart type handler by chart type
   */
  getHandler(chartType: string): THandler | undefined {
    return this.handlers.get(chartType);
  }

  /**
   * Get all registered chart types
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Register a chart type handler
   * Subclasses should call this method in their constructor
   */
  protected register(handler: THandler): void {
    this.handlers.set(handler.chartType, handler);
  }
}

