/**
 * Base interface for chart type handlers.
 * Each chart library provider (Highcharts, Chart.js, etc.) extends this
 * with provider-specific handler interfaces.
 */
export interface ChartTypeHandler {
  /**
   * The chart type identifier (e.g., 'bar', 'column', 'pie')
   * This is provider-agnostic and shared across all chart libraries.
   */
  readonly chartType: string;
}

