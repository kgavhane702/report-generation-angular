import { ChangeDetectionStrategy, Component, Type, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { EditorStateService } from '../../../../core/services/editor-state.service';
import type { WidgetType } from '../../../../models/widget.model';

import { TableToolbarComponent } from '../../plugins/table/ui/table-toolbar/table-toolbar.component';
import { ChartToolbarComponent } from '../../plugins/chart/ui/chart-toolbar/chart-toolbar.component';
import { EditastraToolbarComponent } from '../../plugins/editastra/ui/editastra-toolbar/editastra-toolbar.component';
import { ImageToolbarComponent } from '../../plugins/image/ui/image-toolbar/image-toolbar.component';
import { ObjectToolbarComponent } from '../../plugins/object/ui/object-toolbar/object-toolbar.component';
import { ConnectorToolbarComponent } from '../../plugins/connector/ui/connector-toolbar/connector-toolbar.component';

type WidgetToolbarRegistry = Partial<Record<WidgetType, Type<unknown>>>;

/**
 * WidgetToolbarComponent
 *
 * Generic toolbar host for the currently active widget.
 * Uses a registry + ngComponentOutlet so each widget can provide a toolbar implementation
 * without the shell needing widget-specific markup.
 */
@Component({
  selector: 'app-widget-toolbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './widget-toolbar.component.html',
  styleUrls: ['./widget-toolbar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetToolbarComponent {
  private readonly editorState = inject(EditorStateService);

  /** Central registry: widget type -> toolbar component */
  private readonly registry: WidgetToolbarRegistry = {
    table: TableToolbarComponent,
    chart: ChartToolbarComponent,
    editastra: EditastraToolbarComponent,
    image: ImageToolbarComponent,
    object: ObjectToolbarComponent,
    connector: ConnectorToolbarComponent,
  };

  readonly toolbarComponent = computed<Type<unknown> | null>(() => {
    const widget = this.editorState.activeWidget();
    const type = widget?.type;
    if (!type) return null;
    return this.registry[type] ?? null;
  });
}


