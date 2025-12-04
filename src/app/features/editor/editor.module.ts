import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { CKEditorModule } from '@ckeditor/ckeditor5-angular';

import { EditorShellComponent } from './editor-shell/editor-shell.component';
import { EditorToolbarComponent } from './toolbar/editor-toolbar.component';
import { EditorBreadcrumbComponent } from './breadcrumb/editor-breadcrumb.component';
import { PageOutlineComponent } from './page-outline/page-outline.component';
import { PageCanvasComponent } from './page-canvas/page-canvas.component';
import { PageComponent } from './page/page.component';
import { WidgetContainerComponent } from './widgets/widget-container/widget-container.component';
import { TextWidgetComponent } from './widgets/text-widget/text-widget.component';
import { ChartWidgetComponent } from './widgets/chart-widget/chart-widget.component';
import { TableWidgetComponent } from './widgets/table-widget/table-widget.component';
import { ImageWidgetComponent } from './widgets/image-widget/image-widget.component';
import { InspectorPanelComponent } from './inspector/inspector-panel.component';
import { ChartRegistryInitializer } from './charts/registry';
import { ChartConfigDialogComponent } from './charts/chart-config/chart-config-dialog.component';
import { TableConfigDialogComponent } from './table/table-config-dialog.component';
import { TableRegistryInitializer } from './table/table-registry.initializer';

@NgModule({
  declarations: [
    EditorShellComponent,
    EditorToolbarComponent,
    EditorBreadcrumbComponent,
    PageOutlineComponent,
    PageCanvasComponent,
    PageComponent,
    WidgetContainerComponent,
    TextWidgetComponent,
    ChartWidgetComponent,
    TableWidgetComponent,
    ImageWidgetComponent,
    InspectorPanelComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    DragDropModule,
    CKEditorModule,
    ChartConfigDialogComponent,
    TableConfigDialogComponent,
  ],
  exports: [EditorShellComponent],
  providers: [ChartRegistryInitializer, TableRegistryInitializer],
})
export class EditorModule {}

