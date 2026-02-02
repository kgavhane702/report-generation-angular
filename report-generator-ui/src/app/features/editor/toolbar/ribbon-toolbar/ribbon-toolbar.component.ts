import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';

import { EditorStateService } from '../../../../core/services/editor-state.service';
import { UIStateService } from '../../../../core/services/ui-state.service';
import type { WidgetType } from '../../../../models/widget.model';

type RibbonTabId = 'insert' | 'context';

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

  readonly activeTab = signal<RibbonTabId>('insert');

  private readonly widgetLabelMap: Partial<Record<WidgetType, string>> = {
    text: 'Text',
    table: 'Table',
    chart: 'Chart',
    image: 'Image',
    object: 'Shape',
    connector: 'Connector',
    editastra: 'Editastra',
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
      { id: 'insert', label: 'Insert' },
    ];

    const contextLabel = this.contextLabel();
    if (contextLabel) {
      baseTabs.push({ id: 'context', label: contextLabel, isContext: true });
    }

    return baseTabs;
  });

  constructor() {
    effect(() => {
      if (!this.hasContextTab() && this.activeTab() === 'context') {
        this.activeTab.set('insert');
      }
    });
  }

  setActiveTab(tab: RibbonTabId): void {
    this.activeTab.set(tab);
  }

  isTabActive(tab: RibbonTabId): boolean {
    return this.activeTab() === tab;
  }
}
