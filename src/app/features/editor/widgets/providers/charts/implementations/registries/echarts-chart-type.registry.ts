import { BaseChartTypeRegistry } from './base-chart-type-registry';
import { EChartsChartTypeHandler } from '../../interfaces/handlers/echarts-chart-type-handler.interface';
import {
  EChartsBarChartHandler,
  EChartsColumnChartHandler,
  EChartsLineChartHandler,
  EChartsAreaChartHandler,
  EChartsPieChartHandler,
  EChartsDonutChartHandler,
  EChartsScatterChartHandler,
  EChartsStackedBarChartHandler,
  EChartsStackedColumnChartHandler,
  EChartsStackedBarLineChartHandler,
} from '../handlers/echarts';

export class EChartsChartTypeRegistry extends BaseChartTypeRegistry<EChartsChartTypeHandler> {
  constructor() {
    super();
    this.register(new EChartsBarChartHandler());
    this.register(new EChartsColumnChartHandler());
    this.register(new EChartsLineChartHandler());
    this.register(new EChartsAreaChartHandler());
    this.register(new EChartsPieChartHandler());
    this.register(new EChartsDonutChartHandler());
    this.register(new EChartsScatterChartHandler());
    this.register(new EChartsStackedBarChartHandler());
    this.register(new EChartsStackedColumnChartHandler());
    this.register(new EChartsStackedBarLineChartHandler());
  }
}

let registryInstance: EChartsChartTypeRegistry | null = null;

export function getEChartsChartTypeRegistry(): EChartsChartTypeRegistry {
  if (!registryInstance) {
    registryInstance = new EChartsChartTypeRegistry();
  }
  return registryInstance;
}

