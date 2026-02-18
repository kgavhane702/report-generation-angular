import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';

import { EditorStateService } from '../../../../core/services/editor-state.service';
import { UIStateService } from '../../../../core/services/ui-state.service';
import { DocumentService } from '../../../../core/services/document.service';
import { SlideDesignService } from '../../../../core/slide-design/slide-design.service';
import { SLIDE_LAYOUT_OPTIONS } from '../../../../core/slide-design/slide-design.theme-config';
import { SlideLayoutType, SlideThemeDefinition, SlideThemeId } from '../../../../core/slide-design/slide-design.model';
import { SlideTemplateService } from '../../../../core/slide-design/slide-template.service';
import type { WidgetType } from '../../../../models/widget.model';

type RibbonTabId = 'design' | 'insert' | 'context';

interface RibbonTab {
  id: RibbonTabId;
  label: string;
  isContext?: boolean;
}

@Component({
  selector: 'app-ribbon-toolbar',
  templateUrl: './ribbon-toolbar.component.html',
  styleUrls: ['./ribbon-toolbar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RibbonToolbarComponent {
  private readonly editorState = inject(EditorStateService);
  private readonly uiState = inject(UIStateService);
  private readonly documentService = inject(DocumentService);
  private readonly slideDesign = inject(SlideDesignService);
  private readonly slideTemplates = inject(SlideTemplateService);

  readonly activeTab = signal<RibbonTabId>('design');
  readonly quickAddDialogOpen = signal(false);
  readonly designDialogOpen = signal(false);
  readonly dialogSelectedLayout = signal<SlideLayoutType>('title_body');
  readonly documentLocked = this.documentService.documentLocked;
  readonly themes = this.slideDesign.themes;
  readonly activeThemeId = this.slideDesign.activeThemeId;
  readonly layouts = SLIDE_LAYOUT_OPTIONS;
  readonly defaultLayout = this.slideDesign.defaultLayoutType;

  private readonly widgetLabelMap: Partial<Record<WidgetType, string>> = {
    table: 'Table',
    chart: 'Chart',
    image: 'Image',
    object: 'Shape',
    connector: 'Connector',
    editastra: 'Text',
  };

  readonly contextLabel = computed(() => {
    if (this.uiState.dragSelecting()) return null;
    const selectedCount = this.uiState.selectedWidgetIds().size;
    if (selectedCount !== 1) return null;
    const widget = this.editorState.activeWidget();
    const type = widget?.type;
    if (!type) return null;
    return this.widgetLabelMap[type] ?? 'Format';
  });

  readonly hasContextTab = computed(() => !!this.contextLabel());

  readonly tabs = computed<RibbonTab[]>(() => {
    const baseTabs: RibbonTab[] = [
      { id: 'design', label: 'Design' },
      { id: 'insert', label: 'Insert' },
    ];

    const contextLabel = this.contextLabel();
    if (contextLabel) {
      baseTabs.push({ id: 'context', label: contextLabel, isContext: true });
    }

    return baseTabs;
  });

  private previousHasContext = false;

  constructor() {
    effect(() => {
      const hasContext = this.hasContextTab();
      // Only auto-switch to context when widget becomes newly selected
      if (hasContext && !this.previousHasContext) {
        this.activeTab.set('context');
      } else if (!hasContext && this.activeTab() === 'context') {
        this.activeTab.set('insert');
      }
      this.previousHasContext = hasContext;
    }, { allowSignalWrites: true });
  }

  setActiveTab(tab: RibbonTabId): void {
    this.activeTab.set(tab);
  }

  isTabActive(tab: RibbonTabId): boolean {
    return this.activeTab() === tab;
  }

  tabIcon(tab: RibbonTabId): string {
    switch (tab) {
      case 'design':
        return 'design_tab_svgrepo';
      case 'insert':
        return 'insert_tab_svgrepo';
      case 'context':
        return 'tune';
      default:
        return 'label';
    }
  }

  setTheme(themeId: SlideThemeId): void {
    if (this.documentLocked()) return;
    this.slideDesign.updateTheme(themeId);
  }

  setDefaultLayout(layout: string): void {
    if (this.documentLocked()) return;
    this.slideDesign.updateDefaultLayout(layout as SlideLayoutType);
  }

  quickAdd(layout: SlideLayoutType): void {
    if (this.documentLocked()) return;

    const pageId = this.editorState.activePageId();
    if (!pageId) return;

    const page = this.editorState.activePage();
    const pageSize = this.documentService.pageSize;
    const orientation = page?.orientation ?? 'landscape';
    const activeTheme = this.slideDesign.activeTheme();
    const activeVariantId = page?.slideVariantId?.trim().toLowerCase();
    const variant = (activeVariantId
      ? activeTheme.variants.find((v) => v.id.toLowerCase() === activeVariantId)
      : undefined) ?? this.slideDesign.resolveVariant(layout);

    const widgets = this.slideTemplates.createTemplateWidgets({
      layout,
      pageSize,
      orientation,
      variant,
    });

    if (widgets.length > 0) {
      this.documentService.addWidgets(pageId, widgets);
    }
  }

  openQuickAddDialog(): void {
    if (this.documentLocked()) return;
    this.dialogSelectedLayout.set(this.defaultLayout());
    this.quickAddDialogOpen.set(true);
  }

  closeQuickAddDialog(): void {
    this.quickAddDialogOpen.set(false);
  }

  pickDialogLayout(layout: SlideLayoutType): void {
    if (this.documentLocked()) return;
    this.dialogSelectedLayout.set(layout);
    this.quickAdd(layout);
    this.quickAddDialogOpen.set(false);
  }

  openDesignDialog(): void {
    if (this.documentLocked()) return;
    this.designDialogOpen.set(true);
  }

  closeDesignDialog(): void {
    this.designDialogOpen.set(false);
  }

  onThemePicked(_themeId: SlideThemeDefinition['id']): void {
    if (this.documentLocked()) return;
    this.designDialogOpen.set(false);
  }

  onVariantPicked(): void {
    if (this.documentLocked()) return;
    this.designDialogOpen.set(false);
  }
}
