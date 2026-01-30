import { ChangeDetectionStrategy, Component, Input, ViewEncapsulation, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GuidesService, type GuideLine, type SpacingGuide } from '../../../core/services/guides.service';
import { UIStateService } from '../../../core/services/ui-state.service';

@Component({
  selector: 'app-guides-overlay',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './guides-overlay.component.html',
  styleUrls: ['./guides-overlay.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class GuidesOverlayComponent {
  @Input({ required: true }) pageId!: string;
  @Input({ required: true }) widthPx!: number;
  @Input({ required: true }) heightPx!: number;

  private readonly guides = inject(GuidesService);
  private readonly uiState = inject(UIStateService);

  readonly activeGuides = computed<GuideLine[]>(() => {
    if (!this.uiState.isInteracting()) return [];
    const st = this.guides.state();
    if (!st) return [];
    if (st.pageId !== this.pageId) return [];
    return st.guides ?? [];
  });

  readonly spacingGuides = computed<SpacingGuide[]>(() => {
    if (!this.uiState.isInteracting()) return [];
    const st = this.guides.state();
    if (!st) return [];
    if (st.pageId !== this.pageId) return [];
    return st.spacingGuides ?? [];
  });

  /** Track function for guide lines */
  trackGuide(index: number, guide: GuideLine): string {
    return `${guide.orientation}_${guide.posPx}_${guide.fromPx}_${guide.toPx}`;
  }

  /** Track function for spacing guides */
  trackSpacing(index: number, guide: SpacingGuide): string {
    return `${guide.orientation}_${guide.posPx}_${guide.fromPx}_${guide.toPx}`;
  }
}


