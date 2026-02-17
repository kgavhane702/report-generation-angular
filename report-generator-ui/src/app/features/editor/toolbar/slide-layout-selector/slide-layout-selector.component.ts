import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, inject } from '@angular/core';
import { CommonModule, NgStyle, NgSwitch, NgSwitchCase, NgSwitchDefault } from '@angular/common';

import { SlideDesignService } from '../../../../core/slide-design/slide-design.service';
import { DocumentService } from '../../../../core/services/document.service';
import { EditorStateService } from '../../../../core/services/editor-state.service';
import { SLIDE_LAYOUT_OPTIONS } from '../../../../core/slide-design/slide-design.theme-config';
import { SlideLayoutType } from '../../../../core/slide-design/slide-design.model';

@Component({
  selector: 'app-slide-layout-selector',
  standalone: true,
  imports: [CommonModule, NgStyle, NgSwitch, NgSwitchCase, NgSwitchDefault],
  templateUrl: './slide-layout-selector.component.html',
  styleUrls: ['./slide-layout-selector.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SlideLayoutSelectorComponent {
  @Input() mode: 'set-default' | 'pick' = 'set-default';
  @Input() selectedLayout: SlideLayoutType | null = null;
  @Output() layoutSelected = new EventEmitter<SlideLayoutType>();

  private readonly slideDesign = inject(SlideDesignService);
  private readonly documentService = inject(DocumentService);
  private readonly editorState = inject(EditorStateService);

  readonly layouts = SLIDE_LAYOUT_OPTIONS;
  readonly activeLayout = this.slideDesign.defaultLayoutType;
  readonly activeTheme = this.slideDesign.activeTheme;
  readonly activePage = this.editorState.activePage;
  readonly documentLocked = this.documentService.documentLocked;

  private readonly thumbnailFontScale = 0.32;
  private readonly thumbnailFontMin = 5.4;
  private readonly thumbnailFontMax = 12;

  readonly currentSelectedLayout = computed<SlideLayoutType>(() => {
    if (this.mode === 'pick' && this.selectedLayout) {
      return this.selectedLayout;
    }
    return this.activeLayout();
  });

  selectLayout(layout: SlideLayoutType): void {
    if (this.documentLocked()) return;
    if (this.mode === 'pick') {
      this.layoutSelected.emit(layout);
      return;
    }
    this.slideDesign.updateDefaultLayout(layout);
  }

  cardStyle(layout: SlideLayoutType): Record<string, string> {
    const variant = this.previewVariant(layout);
    const accent = variant.accentColor || variant.surfaceForeground;
    const lineColor = this.withAlpha(accent, '40', 'rgba(15, 23, 42, 0.2)');
    const subtitleColor = this.withAlpha(variant.surfaceForeground, 'B0', 'rgba(15, 23, 42, 0.62)');

    return {
      background: variant.surfaceBackground,
      color: variant.surfaceForeground,
      fontFamily: variant.fontFamily || "'Inter', sans-serif",
      '--layout-foreground': variant.surfaceForeground,
      '--layout-accent': variant.accentColor || variant.surfaceForeground,
      '--layout-fill': this.withAlpha(variant.surfaceForeground, '22', 'rgba(15, 23, 42, 0.12)'),
      '--layout-foreground-soft': `${variant.surfaceForeground}30`,
      '--layout-title-font': variant.titleFontFamily || variant.fontFamily || "'Inter', sans-serif",
      '--layout-title-size': `${this.toThumbnailFontPx(variant.titleFontSize || '30px', 8.8)}px`,
      '--layout-heading-size': `${this.toThumbnailFontPx(variant.titleFontSize || '28px', 7.6)}px`,
      '--layout-body-size': `${this.toThumbnailFontPx(variant.fontSize || '16px', 5.6)}px`,
      '--layout-subtitle-size': `${this.toThumbnailFontPx('18px', 5.4)}px`,
      '--layout-title-weight': `${variant.titleFontWeight || 700}`,
      '--layout-heading-weight': `${Math.max(600, Math.min(800, variant.titleFontWeight || 700))}`,
      '--layout-body-weight': '500',
      '--layout-subtitle-color': subtitleColor,
      '--layout-line-color': lineColor,
      '--layout-overlay-soft': variant.overlaySoftColor || 'rgba(255, 255, 255, 0.14)',
      '--layout-overlay-strong': variant.overlayStrongColor || 'rgba(255, 255, 255, 0.2)',
      '--layout-tab': variant.tabColor || variant.accentColor || variant.surfaceForeground,
    } as Record<string, string>;
  }

  thumbClasses(layout: SlideLayoutType): string[] {
    const themeId = this.activeTheme().id;
    const variantId = this.previewVariant(layout).id.toLowerCase();
    const normalizedTheme = themeId.replace(/_/g, '-');
    return [`theme-${normalizedTheme}`, `variant-${variantId}`];
  }

  private previewVariant(layout: SlideLayoutType) {
    if (this.mode === 'pick') {
      const page = this.activePage();
      const activeVariantId = page?.slideVariantId?.trim().toLowerCase();
      if (activeVariantId) {
        const theme = this.activeTheme();
        const matched = theme.variants.find((variant) => variant.id.toLowerCase() === activeVariantId);
        if (matched) {
          return matched;
        }
      }
    }
    return this.slideDesign.resolveVariant(layout);
  }

  private toThumbnailFontPx(input: string, fallback: number): number {
    const parsed = Number.parseFloat(input);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }

    const scaled = parsed * this.thumbnailFontScale;
    return Math.max(this.thumbnailFontMin, Math.min(this.thumbnailFontMax, Number(scaled.toFixed(2))));
  }

  private withAlpha(color: string | undefined, alphaHex: string, fallback: string): string {
    if (!color) return fallback;
    const normalized = color.trim();
    if (/^#([A-Fa-f0-9]{6})$/.test(normalized)) {
      return `${normalized}${alphaHex}`;
    }
    if (/^#([A-Fa-f0-9]{3})$/.test(normalized)) {
      const expanded = `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`;
      return `${expanded}${alphaHex}`;
    }
    return fallback;
  }
}
