import { Injectable } from '@angular/core';

import { ChartRegistryService } from './chart-registry.service';
import {
  PlaceholderChartAdapter,
  ChartJsChartAdapter,
  EChartsChartAdapter,
} from '../providers/adapters';

@Injectable({
  providedIn: 'root',
})
export class ChartRegistryInitializer {
  constructor(private readonly registry: ChartRegistryService) {
    this.registry.register(new PlaceholderChartAdapter());
    this.registry.register(new ChartJsChartAdapter());
    this.registry.register(new EChartsChartAdapter());
  }
}

