import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { ChartAdapter, ChartInstance } from '../../contracts/adapters/chart-adapter.interface';
import { ChartWidgetProps } from '../../../../../../../models/widget.model';
import { ChartData, filterChartDataByLabelVisibility } from '../../../../../../../models/chart-data.model';
import { getChartJsChartTypeRegistry } from '../../type-registries/chartjs-chart-type.registry';
import { formatNumber } from '../../utils/number-format.util';
import { computeFontScale, computeFontsPx, estimateMaxCharsForWidth } from '../../utils/layout-metrics.util';
import { wrapTextByChars } from '../../utils/text-wrap.util';
import { reportUiChartJsValueLabelsPlugin } from './chartjs-presentation.plugin';

Chart.register(...registerables);

export class ChartJsChartAdapter implements ChartAdapter {
  readonly id = 'chartjs';
  readonly label = 'Chart.js';
  private readonly chartTypeRegistry = getChartJsChartTypeRegistry();

  render(container: HTMLElement, props: unknown): ChartInstance {
    const chartProps = props as ChartWidgetProps;
    const exporting = (props as any)?.__exporting === true;
    const chartData = chartProps.data as ChartData | undefined;
    
    if (!chartData) {
      container.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">No chart data</div>';
      return { destroy: () => {} };
    }

    const width = container.clientWidth || 400;
    const height = container.clientHeight || 300;
    const presentation = resolveChartPresentation(container);
    const defaultTextColor = presentation.defaultTextColor;
    container.innerHTML = '';
    const filteredData = filterChartDataByLabelVisibility(chartData);

    // Production-friendly empty state: show a prompt instead of rendering an empty chart.
    if (!this.hasRenderableData(filteredData)) {
      container.innerHTML =
        `<div style="padding: 20px; text-align: center; color: ${defaultTextColor};">No data connected. Double-click to configure and import data.</div>`;
      return {
        destroy() {
          container.innerHTML = '';
        },
      };
    }

    const canvas = document.createElement('canvas');
    container.appendChild(canvas);
    const config = this.convertToChartJsConfig(filteredData, width, height, presentation);

    // Export mode: disable animation so we capture fully drawn charts (not axes only).
    if (exporting) {
      config.options = config.options ?? {};
      (config.options as any).animation = false;
      (config.options as any).animations = false;
      (config.options as any).responsiveAnimationDuration = 0;
    }

    // Compensate for editor zoom (canvas is scaled via CSS transform on the viewport).
    // Oversample the backing store so text/lines remain crisp under scaling.
    const effectiveDpr = computeEffectiveDevicePixelRatio(container);
    config.options = config.options ?? {};
    (config.options as any).devicePixelRatio = effectiveDpr;

    const chart = new Chart(canvas, config);

    return {
      destroy() {
        if (chart && chart.destroy) {
          chart.destroy();
        }
        container.innerHTML = '';
      },
      chartInstance: chart,
    } as ChartInstance & { chartInstance: Chart };
  }

  private hasRenderableData(data: ChartData): boolean {
    const series = data.series ?? [];
    if (series.length === 0) return false;
    return series.some((s) => Array.isArray(s.data) && s.data.length > 0);
  }

  private convertToChartJsConfig(
    data: ChartData,
    width: number,
    height: number,
    presentation: ChartPresentation
  ): ChartConfiguration {
    const handler = this.chartTypeRegistry.getHandler(data.chartType);
    
    if (!handler) {
      const defaultHandler = this.chartTypeRegistry.getHandler('column');
      if (!defaultHandler) {
        throw new Error(`No chart handler found for type: ${data.chartType}`);
      }
      return this.buildConfig(data, defaultHandler, presentation);
    }

    return this.buildConfig(data, handler, presentation);
  }

  private buildConfig(
    data: ChartData,
    handler: ReturnType<typeof this.chartTypeRegistry.getHandler>,
    presentation: ChartPresentation
  ): ChartConfiguration {
    if (!handler) {
      throw new Error('Chart handler is required');
    }

    const config = handler.convertToChartJsConfig(
      data.series,
      data.labels,
      data.title,
      data.xAxisLabel,
      data.yAxisLabel,
      data.showLegend,
      data.legendPosition,
      data.colors,
      data.showValueLabels,
      data.valueLabelPosition
    );

    // Apply showAxisLines setting
    const showAxisLines = data.showAxisLines === true;
    if (config.options && config.options.scales) {
      const xScale = config.options.scales['x'];
      const yScale = config.options.scales['y'];
      
      if (xScale) {
        xScale.grid = {
          display: showAxisLines,
          color: showAxisLines ? presentation.gridColor : 'transparent',
        };
        // Axis line (border) is controlled through ticks.border
        if (xScale.ticks) {
          (xScale.ticks as any).drawBorder = showAxisLines;
        } else {
          xScale.ticks = {
            drawBorder: showAxisLines,
          } as any;
        }
      }
      
      if (yScale) {
        yScale.grid = {
          display: showAxisLines,
          color: showAxisLines ? presentation.gridColor : 'transparent',
        };
        // Axis line (border) is controlled through ticks.border
        if (yScale.ticks) {
          (yScale.ticks as any).drawBorder = showAxisLines;
        } else {
          yScale.ticks = {
            drawBorder: showAxisLines,
          } as any;
        }
      }
    }

    this.applyPresentation(config, data, presentation);

    return config;
  }

  private getDatalabelsAnchor(position: string): string {
    switch (position) {
      case 'top': return 'end';
      case 'bottom': return 'start';
      case 'left': return 'end';
      case 'right': return 'start';
      case 'inside': return 'center';
      default: return 'end';
    }
  }

  private getDatalabelsAlign(position: string): string {
    switch (position) {
      case 'top': return 'top';
      case 'bottom': return 'bottom';
      case 'left': return 'left';
      case 'right': return 'right';
      case 'inside': return 'center';
      default: return 'top';
    }
  }

  private applyPresentation(config: ChartConfiguration, data: ChartData, presentation: ChartPresentation): void {
    if (!config.options) config.options = {};
    if (!config.options.plugins) (config.options as any).plugins = {};

    const defaultTextColor = presentation.defaultTextColor;
    (config.options as any).font = {
      ...((config.options as any).font ?? {}),
      family: presentation.fontFamily,
      size: Math.round(11 * presentation.fontScale),
    };
    (config.options as any).color = defaultTextColor;

    // Provide chartData to our custom plugins/callbacks via options.
    (config.options.plugins as any).reportUiPresentation = {
      chartData: data,
      defaultTextColor,
      defaultFontFamily: presentation.fontFamily,
    };

    // Ensure our value-label plugin is applied.
    const plugins = (config.plugins ?? []) as any[];
    if (!plugins.includes(reportUiChartJsValueLabelsPlugin)) {
      (config as any).plugins = [...plugins, reportUiChartJsValueLabelsPlugin];
    }

    // Scriptable fonts for responsive typography.
    const fontFor = (kind: 'title' | 'axis' | 'legend' | 'valueLabel') => {
      return (ctx: any) => {
        const scale = computeFontScale(ctx?.chart?.width ?? 0, ctx?.chart?.height ?? 0, data.typography);
        const fonts = computeFontsPx(scale);
        const size = Math.max(1, Math.round(fonts[kind] * presentation.fontScale));
        const weight =
          kind === 'title'
            ? (data.textStyles?.title?.bold ? 'bold' : undefined)
            : kind === 'legend'
              ? (data.textStyles?.legend?.bold ? 'bold' : undefined)
              : kind === 'axis'
                ? (data.textStyles?.axis?.bold ? 'bold' : undefined)
                : (data.textStyles?.valueLabel?.bold ? 'bold' : undefined);
        const family = kind === 'title' ? presentation.titleFontFamily : presentation.fontFamily;
        return { size, weight, family };
      };
    };

    // Title / Legend fonts
    const pluginsOpt: any = config.options.plugins;
    if (pluginsOpt.title) {
      pluginsOpt.title.font = fontFor('title');
      pluginsOpt.title.color = data.textStyles?.title?.color ?? pluginsOpt.title.color ?? defaultTextColor;
    }
    if (pluginsOpt.legend?.labels) {
      pluginsOpt.legend.labels.font = fontFor('legend');
      pluginsOpt.legend.labels.color = data.textStyles?.legend?.color ?? pluginsOpt.legend.labels.color ?? defaultTextColor;
    }
    if (pluginsOpt.tooltip) {
      pluginsOpt.tooltip.titleFont = fontFor('axis');
      pluginsOpt.tooltip.bodyFont = fontFor('axis');

      const prior = pluginsOpt.tooltip.callbacks ?? {};
      pluginsOpt.tooltip.callbacks = {
        ...prior,
        label: (context: any) => {
          const dataset: any = context.dataset;
          const datasetLabel = dataset?.label ?? '';
          const series = (data.series ?? [])[context.datasetIndex];
          const spec = series?.numberFormat ?? data.numberFormat;

          // Prefer original values when present (combo charts).
          const v = dataset?._originalLineValues?.[context.dataIndex] ?? extractParsedNumeric(context.parsed);
          return `${datasetLabel}: ${formatNumber(v, spec)}`;
        },
      };
    }

    // Scales: tick formatting + wrapping + responsive fonts
    const scales: any = config.options.scales ?? {};
    for (const scaleId of Object.keys(scales)) {
      const s = scales[scaleId];
      if (!s) continue;

      s.ticks = s.ticks ?? {};
      s.title = s.title ?? {};

      s.ticks.font = fontFor('axis');
      s.title.font = fontFor('axis');
      s.ticks.color = data.textStyles?.axis?.color ?? s.ticks.color ?? defaultTextColor;
      s.title.color = data.textStyles?.axis?.color ?? s.title.color ?? defaultTextColor;

      // Ensure we don't auto-rotate into unreadable angles on small widgets.
      s.ticks.maxRotation = 0;
      s.ticks.minRotation = 0;

      // Use a callback that can handle both category and numeric scales.
      s.ticks.callback = function (value: any, index: number, ticks: any[]) {
        const scale = this as any;
        const type = scale?.type;

        // Category labels: wrap when enabled.
        if (type === 'category') {
          const label = scale.getLabelForValue ? scale.getLabelForValue(value) : String(value ?? '');
          if (data.labelWrap?.enabled === false) return label;

          const chart = scale.chart;
          const scaleFactor = computeFontScale(chart?.width ?? 0, chart?.height ?? 0, data.typography);
          const fonts = computeFontsPx(scaleFactor);

          const labelCount = Math.max(1, ticks?.length || 1);
          const maxWidthPx = Math.max(
            60,
            Math.floor(((scale?.isHorizontal?.() ? scale.width : scale.width) * 0.9) / Math.min(labelCount, 10))
          );
          const maxChars = estimateMaxCharsForWidth(maxWidthPx, fonts.axis);
          return wrapTextByChars(label, maxChars, {
            maxLines: data.labelWrap?.maxLines ?? 2,
            mode: data.labelWrap?.mode ?? 'word',
          });
        }

        // Numeric ticks
        return formatNumber(value, data.numberFormat);
      };
    }
  }
}

interface ChartPresentation {
  defaultTextColor: string;
  fontFamily: string;
  titleFontFamily: string;
  fontScale: number;
  gridColor: string;
}

function resolveChartPresentation(container: HTMLElement): ChartPresentation {
  const cs = getComputedStyle(container);
  const chartText = cs.getPropertyValue('--slide-chart-text').trim();
  const foreground = cs.getPropertyValue('--slide-foreground').trim();
  const reverse = cs.getPropertyValue('--slide-reverse-color').trim();
  const defaultTextColor = chartText || foreground || reverse || '#0f172a';
  const fontFamily =
    cs.getPropertyValue('--slide-font-family').trim() ||
    cs.fontFamily ||
    "'Inter', sans-serif";
  const titleFontFamily = cs.getPropertyValue('--slide-title-font-family').trim() || fontFamily;
  const baseFontPx = parsePx(cs.fontSize) || 16;
  const fontScale = clamp(baseFontPx / 16, 0.75, 1.35);

  return {
    defaultTextColor,
    fontFamily,
    titleFontFamily,
    fontScale,
    gridColor: withAlpha(defaultTextColor, 0.22),
  };
}

function withAlpha(color: string, alpha: number): string {
  const hex = color.trim();
  const m = /^#([A-Fa-f0-9]{6})$/.exec(hex);
  if (!m) {
    return `rgba(148, 163, 184, ${alpha})`;
  }
  const value = m[1];
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function parsePx(value: string | null | undefined): number {
  if (!value) return NaN;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : NaN;
}

function extractParsedNumeric(parsed: any): any {
  if (parsed == null) return parsed;
  if (typeof parsed === 'number') return parsed;
  if (typeof parsed === 'object') {
    if (Number.isFinite(parsed.y)) return parsed.y;
    if (Number.isFinite(parsed.x)) return parsed.x;
    if (Number.isFinite(parsed.r)) return parsed.r;
  }
  return parsed;
}


function computeEffectiveDevicePixelRatio(container: HTMLElement): number {
  const base = typeof window !== 'undefined' && Number.isFinite(window.devicePixelRatio) ? window.devicePixelRatio : 1;
  const zoom = estimateTransformScale(container);
  const factor = Math.max(zoom, 1 / zoom);
  return clamp(base * factor, 1, 4);
}

function estimateTransformScale(el: HTMLElement): number {
  const cw = el.clientWidth;
  const ch = el.clientHeight;
  const rect = el.getBoundingClientRect();

  const sx = cw > 0 ? rect.width / cw : 1;
  const sy = ch > 0 ? rect.height / ch : 1;

  const s = Math.max(sx, sy);
  return Number.isFinite(s) && s > 0 ? clamp(s, 0.1, 10) : 1;
}

function clamp(value: number, min: number, max: number): number {
  const v = Number.isFinite(value) ? value : min;
  return Math.max(min, Math.min(max, v));
}
