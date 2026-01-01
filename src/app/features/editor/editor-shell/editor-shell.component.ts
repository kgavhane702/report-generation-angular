import {
  ChangeDetectionStrategy,
  Component,
  inject,
  HostListener,
  computed,
  signal,
  effect,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  ViewChild,
} from '@angular/core';

import { EditorStateService } from '../../../core/services/editor-state.service';
import { DocumentService } from '../../../core/services/document.service';
import { ChartRegistryInitializer } from '../plugins/chart/engine/runtime';
import { ExportUiStateService } from '../../../core/services/export-ui-state.service';
import { ScrollToRequest } from '../slide-navigator/slide-navigator.component';

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

  @ViewChild('scrollBody', { static: true }) private scrollBodyRef!: ElementRef<HTMLElement>;

  private readonly _scrollTop = signal(0);
  private readonly _scrollHeight = signal(0);
  private readonly _clientHeight = signal(0);

  readonly scrollTop = this._scrollTop.asReadonly();
  readonly scrollHeight = this._scrollHeight.asReadonly();
  readonly clientHeight = this._clientHeight.asReadonly();

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

  private resizeObserver?: ResizeObserver;

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
    // Keep navigator thumb synced with real scroll position
    this.updateScrollMetrics();
    this.scrollBodyRef.nativeElement.addEventListener('scroll', this.onBodyScroll, { passive: true });

    this.resizeObserver = new ResizeObserver(() => this.updateScrollMetrics());
    this.resizeObserver.observe(this.scrollBodyRef.nativeElement);

    // Zoom affects layout via wrapperHeight; update metrics when zoom changes
    effect(() => {
      this.editorState.zoom();
      queueMicrotask(() => this.updateScrollMetrics());
    });
  }

  ngOnDestroy(): void {
    this.scrollBodyRef?.nativeElement.removeEventListener('scroll', this.onBodyScroll as any);
    this.resizeObserver?.disconnect();
  }

  private onBodyScroll = (): void => {
    this.updateScrollMetrics();
  };

  private updateScrollMetrics(): void {
    const el = this.scrollBodyRef?.nativeElement;
    if (!el) return;

    this._scrollTop.set(el.scrollTop);
    this._scrollHeight.set(el.scrollHeight);
    this._clientHeight.set(el.clientHeight);
  }

  onNavigatorScrollTo(req: ScrollToRequest): void {
    const el = this.scrollBodyRef?.nativeElement;
    if (!el) return;

    const maxTop = Math.max(0, el.scrollHeight - el.clientHeight);
    const top = Math.max(0, Math.min(maxTop, req.top));
    el.scrollTo({ top, behavior: req.behavior });
  }

  onNavigatorScrollBy(deltaY: number): void {
    const el = this.scrollBodyRef?.nativeElement;
    if (!el) return;

    const maxTop = Math.max(0, el.scrollHeight - el.clientHeight);
    const top = Math.max(0, Math.min(maxTop, el.scrollTop + deltaY));
    el.scrollTo({ top, behavior: 'auto' });
  }
}
