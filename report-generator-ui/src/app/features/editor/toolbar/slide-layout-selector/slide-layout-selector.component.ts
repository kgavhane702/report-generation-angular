import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, inject } from '@angular/core';
import { CommonModule, NgStyle, NgSwitch, NgSwitchCase, NgSwitchDefault } from '@angular/common';

import { SlideDesignService } from '../../../../core/slide-design/slide-design.service';
import { DocumentService } from '../../../../core/services/document.service';
import { EditorStateService } from '../../../../core/services/editor-state.service';
import { SLIDE_LAYOUT_OPTIONS } from '../../../../core/slide-design/slide-design.config';
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
    return {
      background: variant.surfaceBackground,
      color: variant.surfaceForeground,
      fontFamily: variant.fontFamily || "'Inter', sans-serif",
      '--layout-foreground': variant.surfaceForeground,
      '--layout-accent': variant.accentColor || variant.surfaceForeground,
      '--layout-fill': `${variant.surfaceForeground}22`,
      '--layout-foreground-soft': `${variant.surfaceForeground}30`,
      '--layout-title-font': variant.titleFontFamily || variant.fontFamily || "'Inter', sans-serif",
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
}
