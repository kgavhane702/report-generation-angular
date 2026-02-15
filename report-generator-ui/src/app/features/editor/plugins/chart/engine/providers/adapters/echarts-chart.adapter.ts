import * as echarts from 'echarts';
import { ChartAdapter, ChartInstance } from '../../contracts/adapters/chart-adapter.interface';
import { ChartWidgetProps } from '../../../../../../../models/widget.model';
import { ChartData, filterChartDataByLabelVisibility } from '../../../../../../../models/chart-data.model';
import { getEChartsChartTypeRegistry } from '../../type-registries/echarts-chart-type.registry';
import { formatNumber } from '../../utils/number-format.util';
import { toEChartsMultiline, wrapTextByChars } from '../../utils/text-wrap.util';
import { computeFontScale, computeFontsPx, estimateMaxCharsForWidth } from '../../utils/layout-metrics.util';

export class EChartsChartAdapter implements ChartAdapter {
  readonly id = 'echarts';
  readonly label = 'ECharts';
  private readonly chartTypeRegistry = getEChartsChartTypeRegistry();

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
    const defaultTextColor = resolveChartTextColor(container);
    container.innerHTML = '';
    const filteredData = filterChartDataByLabelVisibility(chartData);

    // Production-friendly empty state: show a prompt instead of rendering an empty chart.
    if (!this.hasRenderableData(filteredData)) {
      container.innerHTML =
        '<div style="padding: 20px; text-align: center; color: #666;">No data connected. Double-click to configure and import data.</div>';
      return {
        destroy() {
          container.innerHTML = '';
        },
      };
    }

    const renderer = chartProps.renderMode === 'svg' ? 'svg' : 'canvas';
    const devicePixelRatio = computeEffectiveDevicePixelRatio(container);
    const chart = echarts.init(container, undefined, { renderer, devicePixelRatio });
    const option = this.convertToEChartsOption(filteredData, width, height);

    // Export mode: disable animation so series render is complete/stable immediately,
    // avoiding "axes only" captures.
    if (exporting) {
      (option as any).animation = false;
      (option as any).animationDuration = 0;
      (option as any).animationDurationUpdate = 0;
    }
    chart.setOption(option);

    // Apply presentation (fonts/wrapping/formatting) once we have a base option.
    this.applyPresentation(chart, option, filteredData, width, height, defaultTextColor);

    // Handle resize
    let resizeTimer: any = null;
    const resizeObserver = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const w = container.clientWidth || 400;
        const h = container.clientHeight || 300;
        this.applyPresentation(chart, option, filteredData, w, h, defaultTextColor);
        chart.resize({ devicePixelRatio: computeEffectiveDevicePixelRatio(container) } as any);
      }, 80);
    });
    resizeObserver.observe(container);

    return {
      destroy() {
        resizeObserver.disconnect();
        if (resizeTimer) clearTimeout(resizeTimer);
        if (chart && chart.dispose) {
          chart.dispose();
        }
        container.innerHTML = '';
      },
      chartInstance: chart,
    } as ChartInstance & { chartInstance: echarts.ECharts };
  }

  private hasRenderableData(data: ChartData): boolean {
    const series = data.series ?? [];
    if (series.length === 0) return false;
    return series.some((s) => Array.isArray(s.data) && s.data.length > 0);
  }

  private convertToEChartsOption(
    data: ChartData,
    width: number,
    height: number
  ): echarts.EChartsOption {
    const handler = this.chartTypeRegistry.getHandler(data.chartType);
    
    if (!handler) {
      const defaultHandler = this.chartTypeRegistry.getHandler('column');
      if (!defaultHandler) {
        throw new Error(`No chart handler found for type: ${data.chartType}`);
      }
      return this.buildOption(data, defaultHandler);
    }

    return this.buildOption(data, handler);
  }

  private buildOption(
    data: ChartData,
    handler: ReturnType<typeof this.chartTypeRegistry.getHandler>
  ): echarts.EChartsOption {
    if (!handler) {
      throw new Error('Chart handler is required');
    }

    return handler.convertToEChartsOption(
      data.series,
      data.labels,
      data.title,
      data.xAxisLabel,
      data.yAxisLabel,
      data.showLegend,
      data.legendPosition,
      data.colors,
      data.showAxisLines,
      data.showValueLabels,
      data.valueLabelPosition
    );
  }

  private applyPresentation(
    chart: echarts.ECharts,
    baseOption: echarts.EChartsOption,
    data: ChartData,
    width: number,
    height: number,
    defaultTextColor: string
  ): void {
    const scale = computeFontScale(width, height, data.typography);
    const fonts = computeFontsPx(scale);

    const labelWrap = data.labelWrap ?? { enabled: true, maxLines: 2, mode: 'word' as const };
    const chartNumberFormat = data.numberFormat;
    const styles = data.textStyles ?? {};

    const seriesData = data.series ?? [];
    const baseSeries = (baseOption as any)?.series as any[] | undefined;

    const patch: echarts.EChartsOption = {
      textStyle: {
        fontSize: fonts.axis,
        color: defaultTextColor,
      },
      title: (baseOption as any)?.title
        ? {
            show: true,
            textStyle: {
              fontSize: fonts.title,
              ...pickTextStyle(styles.title, defaultTextColor),
            },
          }
        : undefined,
      legend: (baseOption as any)?.legend
        ? {
            show: data.showLegend !== false,
            // Avoid truncation/ellipsis in legend: we wrap via formatter and also force break overflow.
            width: Math.max(120, Math.floor(width * 0.9)),
            textStyle: {
              fontSize: fonts.legend,
              ...pickTextStyle(styles.legend, defaultTextColor),
              overflow: 'break',
              ellipsis: '',
            },
            formatter: labelWrap.enabled
              ? (name: string) => {
                  const maxWidthPx = Math.max(120, Math.floor(width * 0.35));
                  const maxChars = estimateMaxCharsForWidth(maxWidthPx, fonts.legend);
                  return toEChartsMultiline(wrapTextByChars(name, maxChars, { maxLines: labelWrap.maxLines, mode: labelWrap.mode }));
                }
              : undefined,
          }
        : undefined,
      tooltip: this.buildTooltipPatch(baseOption, chartNumberFormat, seriesData),
      xAxis: this.buildAxisPatch((baseOption as any)?.xAxis, data, width, height, fonts, defaultTextColor),
      yAxis: this.buildAxisPatch((baseOption as any)?.yAxis, data, width, height, fonts, defaultTextColor),
      series: Array.isArray(baseSeries)
        ? baseSeries.map((s, idx) => this.buildSeriesPatch(s, idx, data, fonts, defaultTextColor))
        : undefined,
    };

    // Avoid adding empty objects that could override handler defaults unintentionally.
    chart.setOption(patch, { notMerge: false, lazyUpdate: true });
  }

  private buildAxisPatch(
    axis: any,
    data: ChartData,
    width: number,
    height: number,
    fonts: { axis: number },
    defaultTextColor: string
  ): any {
    if (!axis) return undefined;

    const patchOne = (a: any): any => {
      const type = a?.type ?? 'value';
      const axisStyle = data.textStyles?.axis ?? {};
      const out: any = {
        axisLabel: {
          fontSize: fonts.axis,
          ...pickTextStyle(axisStyle, defaultTextColor),
          // Never show ellipsis for axis labels.
          ellipsis: '',
        },
        nameTextStyle: {
          fontSize: fonts.axis,
          ...pickTextStyle(axisStyle, defaultTextColor),
          ellipsis: '',
        },
      };

      if (type === 'value') {
        out.axisLabel.formatter = (val: any) => formatNumber(val, data.numberFormat);
        return out;
      }

      if (type === 'category') {
        // Always avoid ellipsis for category labels.
        // If wrapping is enabled, we apply a multi-line formatter.
        // If wrapping is disabled, we still force overflow='break' so ECharts never truncates with '...'.
        const labels = Array.isArray(a?.data) ? a.data : data.labels ?? [];
        const labelCount = Math.max(1, labels.length || 1);
        const maxWidthPx = Math.max(60, Math.floor((width * 0.9) / Math.min(labelCount, 10)));
        const maxChars = estimateMaxCharsForWidth(maxWidthPx, fonts.axis);

        if (data.labelWrap?.enabled ?? true) {
          out.axisLabel.formatter = (val: any) => {
            return toEChartsMultiline(
              wrapTextByChars(val, maxChars, {
                maxLines: data.labelWrap?.maxLines ?? 2,
                mode: data.labelWrap?.mode ?? 'word',
              })
            );
          };
        }

        out.axisLabel.width = maxWidthPx;
        out.axisLabel.overflow = 'break';
        out.axisLabel.ellipsis = '';
        out.axisLabel.hideOverlap = false;

        // Show all labels for small category counts; otherwise let ECharts auto-skip.
        out.axisLabel.interval = labelCount <= 12 ? 0 : 'auto';
      }

      return out;
    };

    return Array.isArray(axis) ? axis.map(patchOne) : patchOne(axis);
  }

  private buildTooltipPatch(baseOption: echarts.EChartsOption, chartNumberFormat: ChartData['numberFormat'], seriesData: ChartData['series']): any {
    const tooltip: any = (baseOption as any)?.tooltip;
    if (!tooltip) return undefined;

    const baseSeries: any[] = Array.isArray((baseOption as any)?.series) ? ((baseOption as any).series as any[]) : [];

    // If a handler defines a custom formatter AND it's one of our "offset" combo charts,
    // replace it with a formatted tooltip that uses original values + per-series formatting.
    if (typeof tooltip.formatter === 'function' && baseSeries.some((s) => Array.isArray((s as any)?._originalLineValues))) {
      return {
        ...tooltip,
        formatter: (params: any) => {
          const items = Array.isArray(params) ? params : [params];
          const header = items[0]?.axisValueLabel ?? items[0]?.name ?? '';
          let html = header ? `${header}<br/>` : '';

          for (const item of items) {
            const seriesIndex = item?.seriesIndex;
            const seriesName = item?.seriesName ?? '';
            const spec = seriesData?.[seriesIndex]?.numberFormat ?? seriesData?.find((s) => s.name === seriesName)?.numberFormat ?? chartNumberFormat;

            let raw = item?.value ?? item?.data;
            const s = baseSeries?.[seriesIndex];
            if (s && Array.isArray((s as any)._originalLineValues)) {
              raw = (s as any)._originalLineValues?.[item?.dataIndex];
            }

            const formatted = formatNumber(extractNumeric(raw), spec);
            const marker = item?.color
              ? `<span style="display:inline-block;margin-right:6px;border-radius:10px;width:9px;height:9px;background-color:${item.color};"></span>`
              : '';
            html += `${marker}${seriesName}: ${formatted}<br/>`;
          }

          return html;
        },
      };
    }

    // If handler already defines a custom formatter function, preserve it.
    if (typeof tooltip.formatter === 'function') {
      return { ...tooltip };
    }

    // If handler uses known string templates, replace with a function so we can format {c}.
    if (typeof tooltip.formatter === 'string') {
      const fmt = tooltip.formatter;
      if (fmt === '{a} <br/>{b}: {c} ({d}%)' || fmt === '{b}: {c} ({d}%)') {
        return {
          ...tooltip,
          formatter: (params: any) => {
            const seriesName = params?.seriesName ?? '';
            const name = params?.name ?? params?.data?.name ?? '';
            const value = params?.value ?? params?.data?.value;
            const percent = params?.percent ?? params?.data?.percent;
            const formatted = formatNumber(value, seriesData?.[0]?.numberFormat ?? chartNumberFormat);
            const left = fmt.startsWith('{a}') ? `${seriesName} <br/>` : '';
            const pct = typeof percent === 'number' ? ` (${percent}%)` : '';
            return `${left}${name}: ${formatted}${pct}`;
          },
        };
      }
    }

    // If no custom formatter is provided, build a consistent tooltip using per-series formatting.
    if (tooltip.formatter == null && tooltip.trigger === 'axis') {
      return {
        ...tooltip,
        formatter: (params: any) => {
          const items = Array.isArray(params) ? params : [params];
          const header = items[0]?.axisValueLabel ?? items[0]?.name ?? '';
          let html = header ? `${header}<br/>` : '';

          for (const item of items) {
            const seriesName = item?.seriesName ?? '';
            const spec = seriesData?.find((s) => s.name === seriesName)?.numberFormat ?? chartNumberFormat;
            const formatted = formatNumber(extractNumeric(item?.value ?? item?.data), spec);
            const marker = item?.color
              ? `<span style="display:inline-block;margin-right:6px;border-radius:10px;width:9px;height:9px;background-color:${item.color};"></span>`
              : '';
            html += `${marker}${seriesName}: ${formatted}<br/>`;
          }

          return html;
        },
      };
    }

    // Default: rely on valueFormatter if ECharts uses built-in tooltip rendering.
    return {
      ...tooltip,
      valueFormatter: (val: any) => formatNumber(extractNumeric(val), chartNumberFormat),
    };
  }

  private buildSeriesPatch(
    baseSeries: any,
    index: number,
    data: ChartData,
    fonts: { valueLabel: number },
    defaultTextColor: string
  ): any {
    const series = (data.series ?? [])[index];
    const chartShow = data.showValueLabels !== false;
    const show = typeof series?.showValueLabels === 'boolean' ? series.showValueLabels : chartShow;
    const position = (series?.valueLabelPosition ?? data.valueLabelPosition) as any;

    const labelWrap = data.labelWrap ?? { enabled: true, maxLines: 2, mode: 'word' as const };
    const valueLabelStyle = series?.valueLabelTextStyle ?? data.textStyles?.valueLabel ?? {};

    const out: any = {
      label: {
        ...(baseSeries?.label ?? {}),
        show,
        fontSize: fonts.valueLabel,
        ...pickTextStyle(valueLabelStyle, defaultTextColor),
        // Never show ellipsis in series labels.
        ellipsis: '',
        overflow: 'break',
      },
    };

    if (position) {
      // For pie/donut, ECharts uses 'inside' or 'outside' (others accept inside/top/...).
      if (baseSeries?.type === 'pie') {
        out.label.position = position === 'inside' ? 'inside' : 'outside';
      } else {
        out.label.position = position;
      }
    }

    // If handler used a string template, replace it with a function so we can format numbers consistently.
    const fmt = out.label?.formatter ?? baseSeries?.label?.formatter;
    if (typeof fmt === 'string') {
      // Common patterns: '{c}' or '{b}: {c} ({d}%)'
      out.label.formatter = (params: any) => {
        const seriesFmt = series?.numberFormat ?? data.numberFormat;
        if (baseSeries?.type === 'pie') {
          const name = params?.name ?? '';
          const value = params?.value ?? params?.data?.value;
          const percent = params?.percent ?? params?.data?.percent;
          const formatted = formatNumber(value, seriesFmt);
          if (fmt.includes('{d}%')) {
            const pct = typeof percent === 'number' ? ` (${percent}%)` : '';
            return labelWrap.enabled
              ? toEChartsMultiline(wrapTextByChars(`${name}: ${formatted}${pct}`, 30, { maxLines: labelWrap.maxLines, mode: labelWrap.mode }))
              : `${name}: ${formatted}${pct}`;
          }
          return `${name}: ${formatted}`;
        }

        const value = params?.value ?? params?.data;
        return formatNumber(extractNumeric(value), seriesFmt);
      };
    }

    // If the handler used a formatter function and it returns a number, format it consistently.
    if (typeof fmt === 'function') {
      const original = fmt;
      out.label.formatter = (params: any) => {
        const res = original(params);
        if (typeof res === 'number') {
          const seriesFmt = series?.numberFormat ?? data.numberFormat;
          return formatNumber(res, seriesFmt);
        }
        return res;
      };
    }

    return out;
  }
}

function extractNumeric(value: any): any {
  if (Array.isArray(value)) {
    // ECharts scatter often provides [x, y]; we want y.
    if (value.length === 0) return value;
    return value[value.length - 1];
  }
  return value;
}

function pickTextStyle(style: any, fallbackColor?: string): { color?: string; fontWeight?: 'bold' } {
  const out: any = {};
  const color = (style?.color ?? '').toString().trim();
  if (color) out.color = color;
  else if (fallbackColor) out.color = fallbackColor;
  if (style?.bold === true) out.fontWeight = 'bold' as const;
  return out;
}

function resolveChartTextColor(container: HTMLElement): string {
  const cs = getComputedStyle(container);
  const reverse = cs.getPropertyValue('--slide-reverse-color').trim();
  if (reverse) return reverse;
  const foreground = cs.getPropertyValue('--slide-foreground').trim();
  if (foreground) return foreground;
  return '#0f172a';
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

