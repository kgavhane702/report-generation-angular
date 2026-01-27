import { ChartTypeRegistry } from '../contracts/registries/chart-type-registry.interface';
import { ChartTypeHandler } from '../contracts/handlers/chart-type-handler.interface';

export abstract class BaseChartTypeRegistry<THandler extends ChartTypeHandler>
  implements ChartTypeRegistry<THandler>
{
  protected readonly handlers = new Map<string, THandler>();

  getHandler(chartType: string): THandler | undefined {
    return this.handlers.get(chartType);
  }

  getRegisteredTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  protected register(handler: THandler): void {
    this.handlers.set(handler.chartType, handler);
  }
}
