import type { Chart, Plugin } from 'chart.js';
import type { ChartData } from '../../../../../../../models/chart-data.model';
import { formatNumber } from '../../utils/number-format.util';
import { computeFontScale, computeFontsPx } from '../../utils/layout-metrics.util';

export interface ReportUiChartJsPresentationPluginOptions {
  chartData: ChartData;
  defaultTextColor?: string;
  defaultFontFamily?: string;
}

export const reportUiChartJsValueLabelsPlugin: Plugin = {
  id: 'reportUiChartJsValueLabels',
  afterDatasetsDraw(chart: Chart) {
    const opts = ((chart.options.plugins as any)?.reportUiPresentation ?? null) as ReportUiChartJsPresentationPluginOptions | null;
    const chartData = opts?.chartData;
    const defaultTextColor = opts?.defaultTextColor || '#0f172a';
    const defaultFontFamily = opts?.defaultFontFamily || 'sans-serif';
    if (!chartData) return;

    const scale = computeFontScale(chart.width, chart.height, chartData.typography);
    const fonts = computeFontsPx(scale);

    const ctx = chart.ctx;
    if (!ctx) return;

    const globalShow = chartData.showValueLabels !== false;
    const globalPos = chartData.valueLabelPosition ?? 'top';

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const fontFamily = (chart.options.font as any)?.family || defaultFontFamily;

    const datasets = chart.data.datasets ?? [];
    for (let di = 0; di < datasets.length; di++) {
      const ds: any = datasets[di];
      const meta = chart.getDatasetMeta(di);
      if (!meta || meta.hidden) continue;

      const series = (chartData.series ?? [])[di];
      const show = typeof series?.showValueLabels === 'boolean' ? series.showValueLabels : globalShow;
      if (!show) continue;

      const pos = (series?.valueLabelPosition ?? globalPos) as any;
      const numberFormat = series?.numberFormat ?? chartData.numberFormat;
      const style = series?.valueLabelTextStyle ?? chartData.textStyles?.valueLabel ?? {};

      const elements: any[] = meta.data as any[];
      for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        if (!el) continue;

        const raw = extractRawValue(ds, i);
        const text = formatNumber(raw, numberFormat);
        if (!text) continue;

        const { x, y, color } = resolveLabelPoint(chart, meta, el, i, pos);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

        const bold = !!style.bold;
        ctx.font = `${bold ? 'bold' : 'normal'} ${fonts.valueLabel}px ${fontFamily || 'sans-serif'}`;

        // Default color behavior: if user set a color, always use it.
        // Otherwise, choose a readable default based on inside/outside.
        if (style.color) {
          ctx.fillStyle = style.color;
        } else {
          ctx.fillStyle = pos === 'inside' ? '#ffffff' : defaultTextColor;
          if (pos === 'inside' && color) {
            ctx.fillStyle = isDarkColor(color) ? '#ffffff' : defaultTextColor;
          }
        }

        ctx.fillText(text, x, y);
      }
    }

    ctx.restore();
  },
};

function extractRawValue(dataset: any, index: number): any {
  if (!dataset) return undefined;

  // Special-case: stackedOverlappedBarLine stores originals on the dataset.
  if (Array.isArray(dataset._originalLineValues)) {
    return dataset._originalLineValues[index];
  }

  const data = dataset.data;
  const v = Array.isArray(data) ? data[index] : undefined;
  if (v == null) return v;
  if (typeof v === 'number') return v;
  if (typeof v === 'object') {
    // Scatter points: {x, y}
    if (typeof v.y === 'number') return v.y;
    if (typeof v.x === 'number') return v.x;
  }
  return v;
}

function resolveLabelPoint(chart: Chart, meta: any, el: any, index: number, position: string): { x: number; y: number; color?: string } {
  const tp = el.tooltipPosition ? el.tooltipPosition() : null;
  const base = tp && Number.isFinite(tp.x) && Number.isFinite(tp.y) ? { x: tp.x, y: tp.y } : { x: el.x, y: el.y };

  const offset = 6;
  const color = (meta?.controller?.getStyle?.(index) as any)?.backgroundColor ?? (meta?.controller?.getStyle?.(index) as any)?.borderColor;

  // Arc elements (pie/doughnut)
  if (typeof el.startAngle === 'number' && typeof el.endAngle === 'number' && typeof el.outerRadius === 'number') {
    const angle = (el.startAngle + el.endAngle) / 2;
    const r = el.outerRadius + (position === 'inside' ? -el.outerRadius * 0.35 : offset);
    return { x: el.x + Math.cos(angle) * r, y: el.y + Math.sin(angle) * r, color };
  }

  // Bar elements provide base + orientation.
  if (typeof el.base === 'number' && typeof el.horizontal === 'boolean') {
    if (position === 'inside') return { x: base.x, y: base.y, color };
    if (el.horizontal) {
      if (position === 'left') return { x: Math.min(el.x, el.base) - offset, y: base.y, color };
      if (position === 'right') return { x: Math.max(el.x, el.base) + offset, y: base.y, color };
      if (position === 'top') return { x: base.x, y: base.y - offset, color };
      if (position === 'bottom') return { x: base.x, y: base.y + offset, color };
      return { x: base.x, y: base.y - offset, color };
    }

    // Vertical bars
    if (position === 'top') return { x: base.x, y: Math.min(el.y, el.base) - offset, color };
    if (position === 'bottom') return { x: base.x, y: Math.max(el.y, el.base) + offset, color };
    if (position === 'left') return { x: base.x - offset, y: base.y, color };
    if (position === 'right') return { x: base.x + offset, y: base.y, color };
    return { x: base.x, y: base.y - offset, color };
  }

  // Points/lines/scatter
  if (position === 'inside') return { x: base.x, y: base.y, color };
  if (position === 'top') return { x: base.x, y: base.y - offset, color };
  if (position === 'bottom') return { x: base.x, y: base.y + offset, color };
  if (position === 'left') return { x: base.x - offset, y: base.y, color };
  if (position === 'right') return { x: base.x + offset, y: base.y, color };
  return { x: base.x, y: base.y - offset, color };
}

function isDarkColor(color: any): boolean {
  if (typeof color !== 'string') return true;
  // Handle rgba/hsla roughly; if unparseable, treat as dark to keep inside labels visible.
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!m) return true;
  const r = Number(m[1]);
  const g = Number(m[2]);
  const b = Number(m[3]);
  // Relative luminance heuristic.
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum < 140;
}


