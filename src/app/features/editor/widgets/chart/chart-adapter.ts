export interface ChartAdapter {
  id: string;
  label: string;
  render(container: HTMLElement, props: unknown): ChartInstance | void;
  destroy?(instance: ChartInstance): void;
}

export interface ChartInstance {
  destroy?: () => void;
}

