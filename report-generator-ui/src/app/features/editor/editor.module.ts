import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { CKEditorModule } from '@ckeditor/ckeditor5-angular';

import { EditorShellComponent } from './editor-shell/editor-shell.component';
import { ExportShellComponent } from './export-shell/export-shell.component';
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
import { ObjectWidgetComponent } from './plugins/object/widget';
import { EditastraWidgetComponent } from './plugins/editastra/widget/editastra-widget.component';
import { EditastraEditorComponent } from './plugins/editastra/editor/editastra-editor.component';
import { ZoomControlsComponent } from './plugins/editor-tools/zoom-controls/zoom-controls.component';
import { UndoRedoControlsComponent } from './plugins/editor-tools/undo-redo-controls/undo-redo-controls.component';
import { ChartRegistryInitializer } from './plugins/chart/engine/runtime';
import { ChartConfigFormComponent } from './plugins/chart/ui/chart-config-form/chart-config-form.component';
import { ChartWidgetSelectorComponent } from './plugins/chart/ui/chart-widget-selector/chart-widget-selector.component';
import { ShapeWidgetSelectorComponent } from './plugins/object/ui/shape-widget-selector/shape-widget-selector.component';
import { TextWidgetColorPickerComponent } from './plugins/text/ui/text-widget-color-picker/text-widget-color-picker.component';
import { TableToolbarComponent } from './plugins/table/ui/table-toolbar/table-toolbar.component';
import { TableGridSelectorComponent } from './plugins/table/ui/table-grid-selector/table-grid-selector.component';
import { TableResizeOverlayComponent } from './plugins/table/widget/resize/table-resize-overlay.component';
import { GuidesOverlayComponent } from './guides/guides-overlay.component';
import { SlideNavigatorComponent } from './slide-navigator/slide-navigator.component';
import { ScrollMetricsDirective } from './shared/scroll-metrics.directive';
import { FixedRightRailComponent } from './shared/fixed-right-rail/fixed-right-rail.component';
import { SafeHtmlPipe } from '../../shared/pipes/safe-html.pipe';
import { TwSafeInnerHtmlDirective } from '../../shared/directives/tw-safe-inner-html.directive';
import { AppModalComponent } from '../../shared/components/modal/app-modal/app-modal.component';
import { WidgetToolbarComponent } from './toolbar/widget-toolbar/widget-toolbar.component';
import { SettingsDialogComponent } from './toolbar/header-footer-edit-dialog/header-footer-edit-dialog.component';
import { AppIconComponent } from '../../shared/components/icon/icon.component';
import { DocumentDownloadMenuComponent } from './toolbar/document-download-menu/document-download-menu.component';
import { EditorRoutingModule } from './editor-routing.module';

@NgModule({
  declarations: [
    EditorShellComponent,
    ExportShellComponent,
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
    ObjectWidgetComponent,
    ZoomControlsComponent,
    UndoRedoControlsComponent,
    SlideNavigatorComponent,
    ScrollMetricsDirective,
    FixedRightRailComponent,
  ],
  imports: [
    CommonModule,
    EditorRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    DragDropModule,
    CKEditorModule,
    AppModalComponent,
    ChartConfigFormComponent,
    ChartWidgetSelectorComponent,
    ShapeWidgetSelectorComponent,
    WidgetToolbarComponent,
    TextWidgetColorPickerComponent,
    TableToolbarComponent,
    TableGridSelectorComponent,
    TableResizeOverlayComponent,
    GuidesOverlayComponent,
    EditastraWidgetComponent,
    EditastraEditorComponent,
    SafeHtmlPipe,
    TwSafeInnerHtmlDirective,
    AppIconComponent,
    SettingsDialogComponent,
    DocumentDownloadMenuComponent,
  ],
  exports: [EditorShellComponent],
  providers: [ChartRegistryInitializer],
})
export class EditorModule {}

