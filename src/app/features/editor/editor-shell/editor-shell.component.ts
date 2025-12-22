import {
  ChangeDetectionStrategy,
  Component,
  inject,
  HostListener,
  computed,
} from '@angular/core';

import { EditorStateService } from '../../../core/services/editor-state.service';
import { DocumentService } from '../../../core/services/document.service';
import { ChartRegistryInitializer } from '../plugins/chart/engine/runtime';
import { ExportUiStateService } from '../../../core/services/export-ui-state.service';

@Component({
  selector: 'app-editor-shell',
  templateUrl: './editor-shell.component.html',
  styleUrls: ['./editor-shell.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorShellComponent {
  protected readonly editorState = inject(EditorStateService);
  private readonly documentService = inject(DocumentService);
  private readonly chartRegistryInitializer = inject(ChartRegistryInitializer);
  protected readonly exportUi = inject(ExportUiStateService);

  // Computed signals to determine if toolbars should be shown
  readonly showRichTextToolbar = computed(() => {
    const widget = this.editorState.activeWidget();
    return widget?.type === 'text' || widget?.type === 'table';
  });

  readonly showExportOverlay = computed(() => this.exportUi.active());

  @HostListener('window:keydown', ['$event'])
  handleKeyboard(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    const isInputElement =
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable;

    if ((event.ctrlKey || event.metaKey) && event.key === 'c' && !event.shiftKey) {
      if (!isInputElement) {
        event.preventDefault();
        this.copySelectedWidget();
      }
    }

    if ((event.ctrlKey || event.metaKey) && event.key === 'v' && !event.shiftKey) {
      if (!isInputElement) {
        event.preventDefault();
        this.pasteWidgets();
      }
    }
  }

  private copySelectedWidget(): void {
    const widgetContext = this.editorState.activeWidgetContext();
    if (!widgetContext) {
      return;
    }

    this.documentService.copyWidget(
      widgetContext.pageId,
      widgetContext.widget.id
    );
  }

  private pasteWidgets(): void {
    const pageId = this.editorState.activePageId();

    if (!pageId) {
      return;
    }

    if (!this.documentService.canPaste()) {
      return;
    }

    const pastedWidgetIds = this.documentService.pasteWidgets(pageId);

    if (pastedWidgetIds.length > 0) {
      this.editorState.setActiveWidget(pastedWidgetIds[0]);
    }
  }
}
