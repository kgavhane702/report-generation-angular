import { ChangeDetectionStrategy, Component, Input, ViewEncapsulation, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GuidesService, type GuideLine } from '../../../core/services/guides.service';

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

  readonly activeGuides = computed<GuideLine[]>(() => {
    const st = this.guides.state();
    if (!st) return [];
    if (st.pageId !== this.pageId) return [];
    return st.guides ?? [];
  });
}


