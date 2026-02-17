import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule, NgStyle } from '@angular/common';

import { SlideDesignService } from '../../../../core/slide-design/slide-design.service';
import { DocumentService } from '../../../../core/services/document.service';
import { EditorStateService } from '../../../../core/services/editor-state.service';
import { SlideThemeDefinition, SlideThemeVariant } from '../../../../core/slide-design/slide-design.model';
import { getSlideThemeById } from '../../../../core/slide-design/slide-design.config';
import { DesignVariantChipsComponent } from '../design-variant-chips/design-variant-chips.component';

@Component({
  selector: 'app-slide-theme-selector',
  standalone: true,
  imports: [CommonModule, NgStyle, DesignVariantChipsComponent],
  templateUrl: './slide-theme-selector.component.html',
  styleUrls: ['./slide-theme-selector.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SlideThemeSelectorComponent {
  @Input() mode: 'set-default' | 'pick' = 'set-default';
  @Output() themeSelected = new EventEmitter<SlideThemeDefinition['id']>();
  @Output() variantSelected = new EventEmitter<{ themeId: SlideThemeDefinition['id']; variantId: string }>();

  private readonly slideDesign = inject(SlideDesignService);
  private readonly documentService = inject(DocumentService);
  private readonly editorState = inject(EditorStateService);

  readonly themes = this.slideDesign.themes;
  readonly activeThemeId = this.slideDesign.activeThemeId;
  readonly activePage = this.editorState.activePage;
  readonly documentLocked = this.documentService.documentLocked;

  selectTheme(themeId: SlideThemeDefinition['id']): void {
    if (this.documentLocked()) return;
    this.slideDesign.updateTheme(themeId);
    if (this.mode === 'pick') {
      this.themeSelected.emit(themeId);
    }
  }

  selectVariant(themeId: SlideThemeDefinition['id'], variantId: string, event: MouseEvent): void {
    event.stopPropagation();
    if (this.documentLocked() || this.mode !== 'pick') return;

    const pageId = this.activePage()?.id;
    if (!pageId) return;

    if (this.activeThemeId() !== themeId) {
      this.slideDesign.updateTheme(themeId);
    }

    this.documentService.updatePageDesign(pageId, {
      slideVariantId: variantId,
    });

    this.variantSelected.emit({ themeId, variantId });
  }

  isVariantActive(themeId: SlideThemeDefinition['id'], variantId: string): boolean {
    if (this.activeThemeId() !== themeId) return false;
    const pageVariantId = this.activePage()?.slideVariantId?.trim().toLowerCase();
    if (!pageVariantId) {
      const theme = getSlideThemeById(themeId);
      return theme.variants[0]?.id.toLowerCase() === variantId.toLowerCase();
    }
    return pageVariantId === variantId.toLowerCase();
  }

  selectedVariantIdForTheme(themeId: SlideThemeDefinition['id']): string | null {
    if (this.activeThemeId() !== themeId) return null;
    const pageVariantId = this.activePage()?.slideVariantId?.trim();
    if (pageVariantId && pageVariantId.length > 0) {
      return pageVariantId;
    }
    const theme = getSlideThemeById(themeId);
    return theme.variants[0]?.id ?? null;
  }

  onVariantChipPicked(themeId: SlideThemeDefinition['id'], payload: { variantId: string; event: MouseEvent }): void {
    this.selectVariant(themeId, payload.variantId, payload.event);
  }

  /** Style for the preview thumbnail (theme primary variant). */
  previewStyle(theme: SlideThemeDefinition): Record<string, string> {
    const variant = theme.variants[0];
    return this.variantToStyle(variant);
  }

  /** Title font family from the theme primary variant */
  previewTitleFontFamily(theme: SlideThemeDefinition): string {
    const variant = theme.variants[0];
    return variant.titleFontFamily || variant.fontFamily || "'Inter', sans-serif";
  }

  private variantToStyle(variant: SlideThemeVariant): Record<string, string> {
    return {
      background: variant.surfaceBackground,
      color: variant.surfaceForeground,
      fontFamily: variant.fontFamily || "'Inter', sans-serif",
      '--thumb-foreground': variant.surfaceForeground,
      '--thumb-accent': variant.accentColor || variant.surfaceForeground,
      '--thumb-accent-soft': `${variant.accentColor || variant.surfaceForeground}44`,
      '--thumb-foreground-soft': `${variant.surfaceForeground}30`,
      '--thumb-title-font': variant.titleFontFamily || variant.fontFamily || "'Inter', sans-serif",
    };
  }

  activeTheme(): SlideThemeDefinition {
    return getSlideThemeById(this.activeThemeId());
  }
}
