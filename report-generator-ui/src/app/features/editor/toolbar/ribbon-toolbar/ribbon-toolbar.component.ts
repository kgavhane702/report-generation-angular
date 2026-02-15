import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';

import { EditorStateService } from '../../../../core/services/editor-state.service';
import { UIStateService } from '../../../../core/services/ui-state.service';
import { DocumentService } from '../../../../core/services/document.service';
import { SlideDesignService } from '../../../../core/slide-design/slide-design.service';
import { SLIDE_LAYOUT_OPTIONS } from '../../../../core/slide-design/slide-design.config';
import { SlideLayoutType, SlideThemeDefinition, SlideThemeId } from '../../../../core/slide-design/slide-design.model';
import type { WidgetType } from '../../../../models/widget.model';

type RibbonTabId = 'home' | 'insert' | 'context';

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

  readonly activeTab = signal<RibbonTabId>('home');
  readonly addSlideDialogOpen = signal(false);
  readonly designDialogOpen = signal(false);
  readonly dialogSelectedLayout = signal<SlideLayoutType>('title_and_content');
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
      { id: 'home', label: 'Home' },
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

  setTheme(themeId: SlideThemeId): void {
    if (this.documentLocked()) return;
    this.slideDesign.updateTheme(themeId);
  }

  setDefaultLayout(layout: string): void {
    if (this.documentLocked()) return;
    this.slideDesign.updateDefaultLayout(layout as SlideLayoutType);
  }

  addSlide(layout: SlideLayoutType): void {
    if (this.documentLocked()) return;

    const subsectionId = this.editorState.activeSubsectionId();
    if (!subsectionId) return;

    const pageId = this.documentService.addPage(subsectionId, { slideLayoutType: layout });
    if (pageId) {
      this.editorState.setActivePage(pageId);
    }
  }

  openAddSlideDialog(): void {
    if (this.documentLocked()) return;
    this.dialogSelectedLayout.set(this.defaultLayout());
    this.addSlideDialogOpen.set(true);
  }

  closeAddSlideDialog(): void {
    this.addSlideDialogOpen.set(false);
  }

  pickDialogLayout(layout: SlideLayoutType): void {
    if (this.documentLocked()) return;
    this.dialogSelectedLayout.set(layout);
    this.addSlide(layout);
    this.addSlideDialogOpen.set(false);
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
}
