import { ChartAdapter, ChartInstance } from './chart-adapter';

export class PlaceholderChartAdapter implements ChartAdapter {
  readonly id = 'placeholder';
  readonly label = 'Placeholder';

  render(container: HTMLElement, props: unknown): ChartInstance {
    container.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.classList.add('placeholder-chart');
    wrapper.innerHTML = `
      <div class="placeholder-chart__title">Chart (${(props as any)?.chartType ?? 'type?'})</div>
      <div class="placeholder-chart__body">
        <span>Adapter ready</span>
      </div>
    `;
    container.appendChild(wrapper);

    return {
      destroy() {
        container.innerHTML = '';
      },
    };
  }
}

