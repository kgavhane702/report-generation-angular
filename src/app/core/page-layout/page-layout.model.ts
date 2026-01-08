import type { PageSize } from '../../models/document.model';

export type PageLayoutPresetId = 'ppt_widescreen' | 'docx_a4';

export interface PageLayoutPreset {
  id: PageLayoutPresetId;
  label: string;
  description: string;
  pageSize: PageSize;
}


