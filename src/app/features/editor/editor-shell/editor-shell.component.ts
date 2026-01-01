import {
  ChangeDetectionStrategy,
  Component,
  inject,
  HostListener,
  computed,
  effect,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  Injector,
  runInInjectionContext,
} from '@angular/core';

import { EditorStateService } from '../../../core/services/editor-state.service';
import { DocumentService } from '../../../core/services/document.service';
import { ChartRegistryInitializer } from '../plugins/chart/engine/runtime';
import { ExportUiStateService } from '../../../core/services/export-ui-state.service';
import { ScrollToRequest } from '../slide-navigator/slide-navigator.component';
import { ScrollMetricsDirective } from '../shared/scroll-metrics.directive';

@Component({
  selector: 'app-editor-shell',
  templateUrl: './editor-shell.component.html',
  styleUrls: ['./editor-shell.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorShellComponent implements AfterViewInit, OnDestroy {
  protected readonly editorState = inject(EditorStateService);
  private readonly documentService = inject(DocumentService);
  private readonly chartRegistryInitializer = inject(ChartRegistryInitializer);
  protected readonly exportUi = inject(ExportUiStateService);
  private readonly injector = inject(Injector);

  @ViewChild('scrollMetrics', { static: true }) private scrollMetrics!: ScrollMetricsDirective;

  // Slide navigator state (pinned to editor-shell__canvas)
  readonly pageIds = this.editorState.activeSubsectionPageIds;
  readonly currentPageIndex = computed(() => {
    const activePageId = this.editorState.activePageId();
    const ids = this.pageIds();
    if (!activePageId) return 0;
    const idx = ids.indexOf(activePageId);
    return idx >= 0 ? idx : 0;
  });

  onCanvasPageChange(newIndex: number): void {
    const ids = this.pageIds();
    if (newIndex >= 0 && newIndex < ids.length) {
      const pageId = ids[newIndex];
      this.editorState.setActivePage(pageId);

      // Scroll to that page (continuous scroll mode)
      const surface = document.getElementById(`page-surface-${pageId}`);
      surface?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // Computed signals to determine if toolbars should be shown
  readonly showWidgetToolbar = computed(() => {
    const widget = this.editorState.activeWidget();
    return (
      widget?.type === 'text' ||
      widget?.type === 'table' ||
      widget?.type === 'chart' ||
      widget?.type === 'editastra' ||
      widget?.type === 'image'
    );
  });

  readonly showExportOverlay = computed(() => this.exportUi.active());

  @HostListener('window:keydown', ['$event'])
  handleKeyboard(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    const isInputElement =
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable;

    // Arrow Up/Down: flip pages directly (but don't steal keys from text editing)
    if (!isInputElement && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      // Avoid interfering with widget editing/selection behaviors
      if (this.editorState.activeWidgetId()) {
        return;
      }

      const delta = event.key === 'ArrowDown' ? 1 : -1;
      event.preventDefault();
      this.onCanvasPageChange(this.currentPageIndex() + delta);
      return;
    }

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

  ngAfterViewInit(): void {
    // Zoom affects layout via wrapperHeight; refresh scroll metrics when zoom changes
    runInInjectionContext(this.injector, () => {
      effect(() => {
        this.editorState.zoom();
        queueMicrotask(() => this.scrollMetrics.refresh());
      });
    });
  }

  ngOnDestroy(): void {
  }

  onNavigatorScrollTo(req: ScrollToRequest): void {
    this.scrollMetrics?.scrollTo(req);
  }

  onNavigatorScrollBy(deltaY: number): void {
    this.scrollMetrics?.scrollBy(deltaY, 'auto');
  }
}
