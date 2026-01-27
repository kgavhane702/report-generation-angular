/**
 * Interface for chart adapters.
 * Chart adapters bridge the gap between the generic chart system and
 * specific chart library implementations (Chart.js, ECharts, D3, etc.).
 */
export interface ChartAdapter {
  id: string;
  label: string;
  render(container: HTMLElement, props: unknown): ChartInstance | void;
  destroy?(instance: ChartInstance): void;
}

/**
 * Interface for chart instances returned by adapters.
 * Represents a rendered chart that can be destroyed.
 */
export interface ChartInstance {
  destroy?: () => void;
}

