/**
 * Chart Adapters Module
 * 
 * This module exports all chart adapter interfaces and implementations.
 * Chart adapters bridge the gap between the generic chart system and
 * specific chart library implementations (Highcharts, Chart.js, etc.).
 */

export { ChartAdapter, ChartInstance } from './chart-adapter';
export { HighchartsChartAdapter } from './highcharts-chart.adapter';
export { ChartJsChartAdapter } from './chartjs-chart.adapter';
export { PlaceholderChartAdapter } from './placeholder-chart.adapter';

