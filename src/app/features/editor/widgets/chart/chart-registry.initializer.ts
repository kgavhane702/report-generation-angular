import { Injectable } from '@angular/core';

import { ChartRegistryService } from './chart-registry.service';
import { PlaceholderChartAdapter } from './placeholder-chart.adapter';

@Injectable({
  providedIn: 'root',
})
export class ChartRegistryInitializer {
  constructor(private readonly registry: ChartRegistryService) {
    this.registry.register(new PlaceholderChartAdapter());
  }
}

