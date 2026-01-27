import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';

import { AppState } from '../../store/app.state';
import { DocumentSelectors } from '../../store/document/document.selectors';
import { DocumentService } from '../services/document.service';
import {
  DEFAULT_PAGE_LAYOUT_PRESET_ID,
  PAGE_LAYOUT_PRESETS,
  getPageLayoutPreset,
} from './page-layout.config';
import type { PageLayoutPreset, PageLayoutPresetId } from './page-layout.model';
import type { PageSize } from '../../models/document.model';

@Injectable({ providedIn: 'root' })
export class PageLayoutService {
  private readonly store = inject(Store<AppState>);
  private readonly documentService = inject(DocumentService);

  readonly presets: ReadonlyArray<PageLayoutPreset> = PAGE_LAYOUT_PRESETS;

  private readonly metadata = toSignal(
    this.store.select(DocumentSelectors.selectDocumentMetadata),
    { initialValue: {} as Record<string, unknown> }
  );

  readonly presetId = toSignal(
    this.store.select(DocumentSelectors.selectPageLayoutPresetId),
    { initialValue: undefined as unknown as string | undefined }
  );

  private readonly pageSize = toSignal(
    this.store.select(DocumentSelectors.selectPageSize),
    { initialValue: { widthMm: 254, heightMm: 190.5, dpi: 96 } }
  );

  readonly preset = computed<PageLayoutPreset>(() => {
    const raw = this.presetId() ?? '';
    const coerced = this.coercePresetId(raw);

    // If metadata doesn't have a preset id yet, infer one from the current pageSize.
    // This makes imported documents behave correctly without requiring metadata.
    if (!this.presetId()) {
      return this.inferPresetFromPageSize(this.pageSize());
    }

    return getPageLayoutPreset(coerced);
  });

  setPreset(id: PageLayoutPresetId): void {
    const preset = getPageLayoutPreset(id);

    // 1) Persist selection (metadata)
    this.documentService.updateDocumentMetadata({
      ...this.metadata(),
      pageLayoutPresetId: preset.id,
    });

    // 2) Apply concrete page size to the document
    this.documentService.updatePageSize(preset.pageSize);
  }

  private coercePresetId(id: string): PageLayoutPresetId {
    const allowed = new Set<PageLayoutPresetId>(['ppt_widescreen', 'docx_a4']);
    return allowed.has(id as PageLayoutPresetId) ? (id as PageLayoutPresetId) : DEFAULT_PAGE_LAYOUT_PRESET_ID;
  }

  private inferPresetFromPageSize(pageSize: PageSize): PageLayoutPreset {
    // Compare on sorted (max/min) dimensions so orientation doesn't matter.
    const a = [Math.max(pageSize.widthMm, pageSize.heightMm), Math.min(pageSize.widthMm, pageSize.heightMm)];

    let best = getPageLayoutPreset(DEFAULT_PAGE_LAYOUT_PRESET_ID);
    let bestScore = Number.POSITIVE_INFINITY;

    for (const preset of this.presets) {
      const p = preset.pageSize;
      const b = [Math.max(p.widthMm, p.heightMm), Math.min(p.widthMm, p.heightMm)];
      const score = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs((pageSize.dpi ?? 96) - (p.dpi ?? 96));
      if (score < bestScore) {
        bestScore = score;
        best = preset;
      }
    }

    return best;
  }
}


