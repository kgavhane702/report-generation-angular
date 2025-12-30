import type { ChartNumberFormatSpec, ChartNumberScale } from '../../../../../../models/chart-data.model';

export interface ScaledNumber {
  scaledValue: number;
  suffix: '' | 'K' | 'M' | 'B';
  appliedScale: Exclude<ChartNumberScale, 'auto'>;
}

export function scaleNumber(value: number, scale: ChartNumberScale): ScaledNumber {
  const abs = Math.abs(value);

  const pickAuto = (): Exclude<ChartNumberScale, 'auto'> => {
    if (abs >= 1_000_000_000) return 'billion';
    if (abs >= 1_000_000) return 'million';
    if (abs >= 1_000) return 'thousand';
    return 'none';
  };

  const applied: Exclude<ChartNumberScale, 'auto'> = scale === 'auto' ? pickAuto() : scale;

  switch (applied) {
    case 'billion':
      return { scaledValue: value / 1_000_000_000, suffix: 'B', appliedScale: applied };
    case 'million':
      return { scaledValue: value / 1_000_000, suffix: 'M', appliedScale: applied };
    case 'thousand':
      return { scaledValue: value / 1_000, suffix: 'K', appliedScale: applied };
    case 'none':
    default:
      return { scaledValue: value, suffix: '', appliedScale: 'none' };
  }
}

export function formatNumber(value: unknown, spec?: ChartNumberFormatSpec): string {
  if (value == null) return '';
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return '';

  const effective: ChartNumberFormatSpec = spec ?? {
    scale: 'auto',
    decimals: 1,
    useGrouping: true,
  };

  const { scaledValue, suffix } = scaleNumber(n, effective.scale);

  const formatter = new Intl.NumberFormat(effective.locale, {
    useGrouping: effective.useGrouping,
    minimumFractionDigits: clampInt(effective.decimals, 0, 8),
    maximumFractionDigits: clampInt(effective.decimals, 0, 8),
  });

  return `${formatter.format(scaledValue)}${suffix}`;
}

function clampInt(value: number, min: number, max: number): number {
  const n = Number.isFinite(value) ? Math.trunc(value) : 0;
  return Math.max(min, Math.min(max, n));
}


