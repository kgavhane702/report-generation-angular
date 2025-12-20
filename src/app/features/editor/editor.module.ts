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
import { ImageWidgetComponent } from './widgets/image-widget/image-widget.component';
import { TableWidgetComponent } from './widgets/table-widget/table-widget.component';
import { ZoomControlsComponent } from './toolbar/zoom-controls/zoom-controls.component';
import { UndoRedoControlsComponent } from './toolbar/undo-redo-controls/undo-redo-controls.component';
import { ChartRegistryInitializer } from './widgets/providers/charts/registry';
import { ChartConfigDialogComponent } from './widgets/providers/charts/chart-config/chart-config-dialog.component';
import { RichTextToolbarComponent } from './toolbar/rich-text-toolbar/rich-text-toolbar.component';
import { TextWidgetColorPickerComponent } from './toolbar/text-widget-color-picker/text-widget-color-picker.component';
import { TableToolbarComponent } from './toolbar/table-toolbar/table-toolbar.component';
import { TableGridSelectorComponent } from './toolbar/table-grid-selector/table-grid-selector.component';
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

