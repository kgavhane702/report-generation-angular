import { Injectable } from '@angular/core';

import { ChartRegistryService } from './chart-registry.service';
import {
  PlaceholderChartAdapter,
  HighchartsChartAdapter,
  ChartJsChartAdapter,
} from '../implementations/adapters';

@Injectable({
  providedIn: 'root',
})
export class ChartRegistryInitializer {
  constructor(private readonly registry: ChartRegistryService) {
    this.registry.register(new PlaceholderChartAdapter());
    this.registry.register(new HighchartsChartAdapter());
    this.registry.register(new ChartJsChartAdapter());
  }
}

