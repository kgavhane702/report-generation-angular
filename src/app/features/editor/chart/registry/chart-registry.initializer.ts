import { Injectable } from '@angular/core';

import { ChartRegistryService } from './chart-registry.service';
import { PlaceholderChartAdapter } from '../adapters/placeholder-chart.adapter';
import { HighchartsChartAdapter } from '../adapters/highcharts-chart.adapter';
import { ChartJsChartAdapter } from '../adapters/chartjs-chart.adapter';

@Injectable({
  providedIn: 'root',
})
export class ChartRegistryInitializer {
  constructor(private readonly registry: ChartRegistryService) {
    // Register placeholder adapter (for fallback)
    this.registry.register(new PlaceholderChartAdapter());
    
    // Register Highcharts adapter
    this.registry.register(new HighchartsChartAdapter());
    
    // Register Chart.js adapter
    this.registry.register(new ChartJsChartAdapter());
    
    // Debug: log registered adapters
    console.log('Chart adapters registered:', this.registry.listAdapters().map(a => a.id));
  }
}

