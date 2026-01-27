import { PageSize } from '../../models/document.model';

export type PageOrientation = 'portrait' | 'landscape';

/**
 * Compute oriented page dimensions (in mm) from a base PageSize.
 *
 * Important: This intentionally mirrors the backend logic (min/max) so UI sizing
 * matches export sizing.
 */
export function getOrientedPageSizeMm(
  pageSize: PageSize,
  orientation: PageOrientation = 'landscape'
): { widthMm: number; heightMm: number } {
  const baseWidth = pageSize.widthMm ?? 0;
  const baseHeight = pageSize.heightMm ?? 0;

  const min = Math.min(baseWidth, baseHeight);
  const max = Math.max(baseWidth, baseHeight);

  if (orientation === 'portrait') {
    return { widthMm: min, heightMm: max };
  }
  return { widthMm: max, heightMm: min };
}

export function mmToPx(mm: number, dpi: number): number {
  const inches = mm / 25.4;
  return Math.round(inches * dpi);
}


