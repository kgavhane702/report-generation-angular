import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule, NgStyle } from '@angular/common';

import { SlideDesignService } from '../../../../core/slide-design/slide-design.service';
import { DocumentService } from '../../../../core/services/document.service';
import { SlideThemeDefinition, SlideThemeVariant } from '../../../../core/slide-design/slide-design.model';
import { getSlideThemeById, resolveVariantForLayout } from '../../../../core/slide-design/slide-design.config';

@Component({
  selector: 'app-slide-theme-selector',
  standalone: true,
  imports: [CommonModule, NgStyle],
  templateUrl: './slide-theme-selector.component.html',
  styleUrls: ['./slide-theme-selector.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SlideThemeSelectorComponent {
  @Input() mode: 'set-default' | 'pick' = 'set-default';
  @Output() themeSelected = new EventEmitter<SlideThemeDefinition['id']>();

  private readonly slideDesign = inject(SlideDesignService);
  private readonly documentService = inject(DocumentService);

  readonly themes = this.slideDesign.themes;
  readonly activeThemeId = this.slideDesign.activeThemeId;
  readonly documentLocked = this.documentService.documentLocked;

  selectTheme(themeId: SlideThemeDefinition['id']): void {
    if (this.documentLocked()) return;
    this.slideDesign.updateTheme(themeId);
    if (this.mode === 'pick') {
      this.themeSelected.emit(themeId);
    }
  }

  /** Style for the preview thumbnail (title slide variant). */
  previewStyle(theme: SlideThemeDefinition): Record<string, string> {
    const variant = resolveVariantForLayout(theme, 'title_slide');
    return this.variantToStyle(variant);
  }

  /** Title font family from the title_slide variant */
  previewTitleFontFamily(theme: SlideThemeDefinition): string {
    const variant = resolveVariantForLayout(theme, 'title_slide');
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
