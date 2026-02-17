import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule, NgStyle } from '@angular/common';

import { SlideThemeVariant } from '../../../../core/slide-design/slide-design.model';

@Component({
  selector: 'app-design-variant-chips',
  standalone: true,
  imports: [CommonModule, NgStyle],
  templateUrl: './design-variant-chips.component.html',
  styleUrls: ['./design-variant-chips.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesignVariantChipsComponent {
  @Input({ required: true }) variants: ReadonlyArray<SlideThemeVariant> = [];
  @Input() selectedVariantId: string | null = null;
  @Input() disabled = false;
  @Input() mode: 'display' | 'pick' = 'pick';
  @Input() showZoom = true;

  @Output() variantSelected = new EventEmitter<{ variantId: string; event: MouseEvent }>();

  onVariantClick(variantId: string, event: MouseEvent): void {
    event.stopPropagation();
    if (this.disabled || this.mode !== 'pick') return;
    this.variantSelected.emit({ variantId, event });
  }

  isVariantActive(variantId: string): boolean {
    if (!this.selectedVariantId) return false;
    return this.selectedVariantId.trim().toLowerCase() === variantId.trim().toLowerCase();
  }

  variantChipPreviewStyle(variant: SlideThemeVariant): Record<string, string> {
    return {
      background: variant.surfaceBackground,
      '--variant-mini-foreground': variant.surfaceForeground,
      '--variant-mini-accent': variant.accentColor || variant.surfaceForeground,
    };
  }
}
