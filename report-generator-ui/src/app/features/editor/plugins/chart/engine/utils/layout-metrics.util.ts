import type { ChartTypographySpec } from '../../../../../../models/chart-data.model';

export interface ChartFontSizesPx {
  title: number;
  axis: number;
  legend: number;
  valueLabel: number;
}

export interface ChartLayoutMetrics {
  scale: number;
  fontsPx: ChartFontSizesPx;
}

export function computeFontScale(containerWidthPx: number, containerHeightPx: number, typography?: ChartTypographySpec): number {
  const t: ChartTypographySpec = typography ?? {
    responsive: true,
    scaleFactor: 1.25,
  };

  const factor = clamp(Number.isFinite(t.scaleFactor) ? t.scaleFactor : 1.25, 0.2, 3);

  const w = Math.max(1, containerWidthPx || 1);
  const h = Math.max(1, containerHeightPx || 1);

  // Fixed baseline to avoid exposing baseWidth/baseHeight in UI.
  const baseW = 600;
  const baseH = 400;

  const responsiveScale = t.responsive === false ? 1 : clamp(Math.min(w / baseW, h / baseH), 0.6, 1.0);
  return clamp(responsiveScale * factor, 0.5, 1.5);
}

export function computeFontsPx(scale: number, base?: Partial<ChartFontSizesPx>): ChartFontSizesPx {
  const b: ChartFontSizesPx = {
    title: base?.title ?? 14,
    axis: base?.axis ?? 11,
    legend: base?.legend ?? 11,
    valueLabel: base?.valueLabel ?? 11,
  };

  const s = Number.isFinite(scale) ? scale : 1;
  return {
    title: Math.max(12, roundPx(b.title * s)),
    axis: Math.max(10, roundPx(b.axis * s)),
    legend: Math.max(10, roundPx(b.legend * s)),
    valueLabel: Math.max(10, roundPx(b.valueLabel * s)),
  };
}

/**
 * Estimate how many characters fit in the given pixel width for a given font size.
 * Heuristic: average character width ≈ 0.55 × fontSize (works reasonably for Latin fonts).
 */
export function estimateMaxCharsForWidth(maxWidthPx: number, fontSizePx: number): number {
  const w = Math.max(1, maxWidthPx || 1);
  const fs = Math.max(1, fontSizePx || 1);
  return Math.max(4, Math.floor(w / (fs * 0.55)));
}

function roundPx(px: number): number {
  return Math.max(1, Math.round(px));
}

function clamp(value: number, min: number, max: number): number {
  const v = Number.isFinite(value) ? value : 1;
  const lo = Number.isFinite(min) ? min : 0.6;
  const hi = Number.isFinite(max) ? max : 1.0;
  return Math.max(lo, Math.min(hi, v));
}


