import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { CKEditorModule } from '@ckeditor/ckeditor5-angular';

import { EditorShellComponent } from './editor-shell/editor-shell.component';
import { EditorToolbarComponent } from './toolbar/editor-toolbar/editor-toolbar.component';
import { EditorBreadcrumbComponent } from './breadcrumb/editor-breadcrumb.component';
import { PageOutlineComponent } from './page-outline/page-outline.component';
import { PageCanvasComponent } from './page-canvas/page-canvas.component';
import { PageComponent } from './page/page.component';
import { WidgetContainerComponent } from './widget-host/widget-container/widget-container.component';
import { TextWidgetComponent } from './plugins/text/widget';
import { ChartWidgetComponent } from './plugins/chart/widget';
import { ImageWidgetComponent } from './plugins/image/widget';
import { TableWidgetComponent } from './plugins/table/widget';
import { ZoomControlsComponent } from './plugins/editor-tools/zoom-controls/zoom-controls.component';
import { UndoRedoControlsComponent } from './plugins/editor-tools/undo-redo-controls/undo-redo-controls.component';
import { ChartRegistryInitializer } from './plugins/chart/engine/runtime';
import { ChartConfigDialogComponent } from './plugins/chart/ui';
import { RichTextToolbarComponent, TextWidgetColorPickerComponent } from './plugins/text/ui';
import { TableToolbarComponent, TableGridSelectorComponent } from './plugins/table/ui';
import { SafeHtmlPipe } from '../../shared/pipes/safe-html.pipe';

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
    ImageWidgetComponent,
    TableWidgetComponent,
    ZoomControlsComponent,
    UndoRedoControlsComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    DragDropModule,
    CKEditorModule,
    ChartConfigDialogComponent,
    RichTextToolbarComponent,
    TextWidgetColorPickerComponent,
    TableToolbarComponent,
    TableGridSelectorComponent,
    SafeHtmlPipe,
  ],
  exports: [EditorShellComponent],
  providers: [ChartRegistryInitializer],
})
export class EditorModule {}

