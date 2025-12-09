import {
  ChangeDetectionStrategy,
  Component,
  inject,
  HostListener,
} from '@angular/core';

import { EditorStateService } from '../../../core/services/editor-state.service';
import { DocumentService } from '../../../core/services/document.service';
import { ChartRegistryInitializer } from '../widgets/providers/charts/registry';
import { TableRegistryInitializer } from '../widgets/providers/table/registry';

@Component({
  selector: 'app-editor-shell',
  templateUrl: './editor-shell.component.html',
  styleUrls: ['./editor-shell.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorShellComponent {
  protected readonly editorState = inject(EditorStateService);
  private readonly documentService = inject(DocumentService);
  
  // Inject registry initializers to ensure they're instantiated and register adapters
  private readonly chartRegistryInitializer = inject(ChartRegistryInitializer);
  private readonly tableRegistryInitializer = inject(TableRegistryInitializer);

  @HostListener('window:keydown', ['$event'])
  handleKeyboard(event: KeyboardEvent): void {
    // Only handle shortcuts when not in an input/textarea/contenteditable
    const target = event.target as HTMLElement;
    const isInputElement =
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable;

    // Handle Ctrl+C (or Cmd+C on Mac) - Copy
    if ((event.ctrlKey || event.metaKey) && event.key === 'c' && !event.shiftKey) {
      if (!isInputElement) {
        event.preventDefault();
        this.copySelectedWidget();
      }
    }

    // Handle Ctrl+V (or Cmd+V on Mac) - Paste
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
      widgetContext.subsectionId,
      widgetContext.pageId,
      widgetContext.widget.id
    );
  }

  private pasteWidgets(): void {
    const subsectionId = this.editorState.activeSubsectionId();
    const pageId = this.editorState.activePageId();

    if (!subsectionId || !pageId) {
      return;
    }

    if (!this.documentService.canPaste()) {
      return;
    }

    const pastedWidgetIds = this.documentService.pasteWidgets(subsectionId, pageId);
    
    // Select the first pasted widget
    if (pastedWidgetIds.length > 0) {
      this.editorState.setActiveWidget(pastedWidgetIds[0]);
    }
  }
}

