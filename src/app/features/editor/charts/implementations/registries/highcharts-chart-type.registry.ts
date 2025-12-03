import { BaseChartTypeRegistry } from './base-chart-type-registry';
import { HighchartsChartTypeHandler } from '../../interfaces/handlers/highcharts-chart-type-handler.interface';
import {
  BarChartHandler,
  ColumnChartHandler,
  LineChartHandler,
  AreaChartHandler,
  PieChartHandler,
  DonutChartHandler,
  ScatterChartHandler,
  StackedBarChartHandler,
  StackedColumnChartHandler,
} from '../handlers/highcharts';

export class HighchartsChartTypeRegistry extends BaseChartTypeRegistry<HighchartsChartTypeHandler> {
  constructor() {
    super();
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

let registryInstance: HighchartsChartTypeRegistry | null = null;

export function getHighchartsChartTypeRegistry(): HighchartsChartTypeRegistry {
  if (!registryInstance) {
    registryInstance = new HighchartsChartTypeRegistry();
  }
  return registryInstance;
}
