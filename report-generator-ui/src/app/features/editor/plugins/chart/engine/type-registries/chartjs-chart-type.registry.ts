import { BaseChartTypeRegistry } from './base-chart-type-registry';
import { ChartJsChartTypeHandler } from '../contracts/handlers/chartjs-chart-type-handler.interface';
import {
  ChartJsBarChartHandler,
  ChartJsColumnChartHandler,
  ChartJsLineChartHandler,
  ChartJsAreaChartHandler,
  ChartJsPieChartHandler,
  ChartJsDonutChartHandler,
  ChartJsScatterChartHandler,
  ChartJsStackedBarChartHandler,
  ChartJsStackedColumnChartHandler,
  ChartJsStackedBarLineChartHandler,
  ChartJsStackedOverlappedBarLineChartHandler,
} from '../providers/handlers/chartjs';

export class ChartJsChartTypeRegistry extends BaseChartTypeRegistry<ChartJsChartTypeHandler> {
  constructor() {
    super();
    this.register(new ChartJsBarChartHandler());
    this.register(new ChartJsColumnChartHandler());
    this.register(new ChartJsLineChartHandler());
    this.register(new ChartJsAreaChartHandler());
    this.register(new ChartJsPieChartHandler());
    this.register(new ChartJsDonutChartHandler());
    this.register(new ChartJsScatterChartHandler());
    this.register(new ChartJsStackedBarChartHandler());
    this.register(new ChartJsStackedColumnChartHandler());
    this.register(new ChartJsStackedBarLineChartHandler());
    this.register(new ChartJsStackedOverlappedBarLineChartHandler());
  }
}

let registryInstance: ChartJsChartTypeRegistry | null = null;

export function getChartJsChartTypeRegistry(): ChartJsChartTypeRegistry {
  if (!registryInstance) {
    registryInstance = new ChartJsChartTypeRegistry();
  }
  return registryInstance;
}
