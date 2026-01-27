import { PageLayoutPreset, PageLayoutPresetId } from './page-layout.model';

/**
 * JSON-like configuration for document layout presets.
 *
 * Note:
 * - Sizes are stored in mm.
 * - Orientation is per-page. Export/UI compute oriented size via min/max.
 */
export const PAGE_LAYOUT_PRESETS: ReadonlyArray<PageLayoutPreset> = [
  {
    id: 'ppt_widescreen',
    label: 'PPT (Widescreen)',
    description: '10 × 7.5 in (PowerPoint widescreen)',
    pageSize: { widthMm: 254, heightMm: 190.5, dpi: 96 },
  },
  {
    id: 'docx_a4',
    label: 'DOCX (A4)',
    description: '210 × 297 mm (A4)',
    pageSize: { widthMm: 210, heightMm: 297, dpi: 96 },
  },
] as const;

export const DEFAULT_PAGE_LAYOUT_PRESET_ID: PageLayoutPresetId = 'ppt_widescreen';

export function getPageLayoutPreset(id: PageLayoutPresetId): PageLayoutPreset {
  const preset = PAGE_LAYOUT_PRESETS.find(p => p.id === id);
  return preset ?? PAGE_LAYOUT_PRESETS[0];
}


