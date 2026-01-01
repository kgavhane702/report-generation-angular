import {
  ChangeDetectionStrategy,
  Component,
  HostBinding,
  inject,
  ViewChild,
  ElementRef,
  AfterViewInit,
  computed,
  effect,
  OnDestroy,
  Injector,
  runInInjectionContext,
} from '@angular/core';

import { EditorStateService } from '../../../core/services/editor-state.service';
import { UIStateService } from '../../../core/services/ui-state.service';

/**
 * PageCanvasComponent
 * 
 * Uses EditorStateService's reactive signals for page rendering.
 * Automatically reacts to subsection changes via computed signals.
 * Shows only the active page at a time with navigation controls.
 */
@Component({
  selector: 'app-page-canvas',
  templateUrl: './page-canvas.component.html',
  styleUrls: ['./page-canvas.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageCanvasComponent implements AfterViewInit, OnDestroy {
  protected readonly editorState = inject(EditorStateService);
  protected readonly uiState = inject(UIStateService);
  private readonly elementRef = inject(ElementRef);
  private readonly injector = inject(Injector);

  @ViewChild('viewport', { static: false }) viewportRef?: ElementRef<HTMLElement>;

  private observerRoot?: HTMLElement;
  private boundOnWheel = this.onRootWheel.bind(this);
  private isPaging = false;
  private lastFlipAt = 0;

  /**
   * Zoom level from UIStateService
   */
  readonly zoom = this.uiState.zoomLevel;

  @HostBinding('class.page-canvas') hostClass = true;

  /**
   * Page IDs for the active subsection - REACTIVE
   * Automatically updates when subsection changes
   */
  readonly pageIds = this.editorState.activeSubsectionPageIds;

  /**
   * Active subsection ID for template
   */
  readonly activeSubsectionId = this.editorState.activeSubsectionId;

  /**
   * Page size from EditorStateService
   */
  readonly pageSize = this.editorState.pageSize;

  /**
   * Computed zoom transform style
   */
  readonly zoomTransform = computed(() => {
    const zoomValue = this.zoom() / 100;
    return `scale(${zoomValue})`;
  });

  readonly zoomOrigin = 'top center';

  ngAfterViewInit(): void {
    (this.editorState as any).calculateFitZoom = () => this.calculateFitZoom();

    this.initObserverRoot();

    // When subsection/pages change, reset scroll position to top of the active page
    runInInjectionContext(this.injector, () => {
      effect(() => {
        this.pageIds();
        queueMicrotask(() => this.scrollActivePageIntoView('start'));
      }, { allowSignalWrites: true });
    });
  }

  ngOnDestroy(): void {
    this.detachRootWheelListener();
  }

  /**
   * Track by page ID for ngFor optimization
   */
  trackByPageId(index: number, pageId: string): string {
    return pageId;
  }

  /**
   * Get the base page width in pixels
   */
  get basePageWidthPx(): number {
    const size = this.pageSize();
    const dpi = size.dpi ?? 96;
    const widthMm = Math.max(size.widthMm, size.heightMm);
    return Math.round((widthMm / 25.4) * dpi);
  }

  /**
   * Get the base page height in pixels (depends on active page orientation)
   *
   * IMPORTANT: CSS transforms (scale) don't affect layout, so we must expand
   * wrapper height manually to make scrolling reach the visually scaled bottom.
   */
  get basePageHeightPx(): number {
    const size = this.pageSize();
    const dpi = size.dpi ?? 96;

    const activePage = this.editorState.activePage();
    const orientation = activePage?.orientation || 'landscape';

    const { widthMm, heightMm } = size;
    let pageHeightMm = heightMm;

    // Normalize to actual oriented height (same logic as PageComponent)
    if (orientation === 'portrait') {
      pageHeightMm = widthMm > heightMm ? widthMm : heightMm;
    } else {
      // landscape
      pageHeightMm = widthMm > heightMm ? heightMm : widthMm;
    }

    return Math.round((pageHeightMm / 25.4) * dpi);
  }

  /**
   * Calculate wrapper width based on zoom level
   */
  get wrapperWidth(): string {
    const zoomValue = this.zoom() / 100;
    const baseWidth = this.basePageWidthPx;
    const totalWidth = (baseWidth + 128) * zoomValue;
    return `${Math.max(totalWidth, 100)}px`;
  }

  /**
   * Calculate wrapper height based on zoom level.
   * This ensures vertical scrolling works correctly under transform scaling.
   */
  get wrapperHeight(): string {
    const zoomValue = this.zoom() / 100;
    const baseHeight = this.basePageHeightPx;
    const totalHeight = (baseHeight + 128) * zoomValue;
    return `${Math.max(totalHeight, 100)}px`;
  }

  /**
   * Calculate zoom level to fit the page within the visible canvas area
   */
  calculateFitZoom(): number {
    const pages = this.editorState.activeSubsectionPages();
    if (pages.length === 0) {
      return 100;
    }

    const activePageId = this.editorState.activePageId();
    const activePage = pages.find((p: any) => p.id === activePageId) || pages[0];

    if (!activePage) {
      return 100;
    }

    const size = this.pageSize();
    const orientation = activePage.orientation || 'landscape';
    const { widthMm, heightMm } = size;
    
    let pageWidthMm = widthMm;
    let pageHeightMm = heightMm;
    if (orientation === 'portrait' && widthMm > heightMm) {
      pageWidthMm = heightMm;
      pageHeightMm = widthMm;
    } else if (orientation === 'landscape' && heightMm > widthMm) {
      pageWidthMm = heightMm;
      pageHeightMm = widthMm;
    }

    const dpi = size.dpi ?? 96;
    const pageWidthPx = Math.round((pageWidthMm / 25.4) * dpi);
    const pageHeightPx = Math.round((pageHeightMm / 25.4) * dpi);

    const canvasElement = this.elementRef.nativeElement.closest('.editor-shell__canvas') as HTMLElement;
    if (!canvasElement) {
      return 100;
    }

    const viewportWidth = canvasElement.clientWidth;
    const viewportHeight = canvasElement.clientHeight;

    const canvasPadding = { top: 32, right: 48, bottom: 32, left: 48 };
    const pageCanvasPadding = { top: 32, right: 40, bottom: 32, left: 40 };

    const totalPadding = {
      top: canvasPadding.top + pageCanvasPadding.top,
      right: canvasPadding.right + pageCanvasPadding.right,
      bottom: canvasPadding.bottom + pageCanvasPadding.bottom,
      left: canvasPadding.left + pageCanvasPadding.left,
    };

    const availableWidth = viewportWidth - totalPadding.left - totalPadding.right;
    const availableHeight = viewportHeight - totalPadding.top - totalPadding.bottom;

    const widthRatio = (availableWidth / pageWidthPx) * 100;
    const heightRatio = (availableHeight / pageHeightPx) * 100;

    const fitZoom = Math.min(widthRatio, heightRatio);

    return Math.max(10, Math.min(400, Math.floor(fitZoom)));
  }

  private initObserverRoot(): void {
    // The scroll container in this app is `.editor-shell__body`
    // (it owns both vertical + horizontal scrolling)
    this.observerRoot =
      (this.elementRef.nativeElement as HTMLElement).closest('.editor-shell__body') ??
      undefined;

    this.attachRootWheelListener();
  }

  private attachRootWheelListener(): void {
    if (!this.observerRoot) return;
    // We only preventDefault when we actually flip pages at boundaries.
    this.observerRoot.addEventListener('wheel', this.boundOnWheel, { passive: false });
  }

  private detachRootWheelListener(): void {
    if (!this.observerRoot) return;
    this.observerRoot.removeEventListener('wheel', this.boundOnWheel as any);
  }

  /**
   * PowerPoint/PDF-style paging using wheel intent at boundaries:
   * - Page does NOT change just by reaching the end
   * - Page changes only when user is at the end AND tries to scroll further
   * This respects oversized content because the "end" moves with page height.
   */
  private onRootWheel(event: WheelEvent): void {
    const root = this.observerRoot;
    if (!root || this.isPaging) return;

    // ignore tiny deltas (trackpads can generate lots of noise)
    if (Math.abs(event.deltaY) < 1) return;

    const activePageId = this.editorState.activePageId();
    if (!activePageId) return;

    const ids = this.pageIds();
    const idx = ids.indexOf(activePageId);
    if (idx < 0) return;

    const margin = 8;
    const atTop = root.scrollTop <= margin;
    const atBottom = root.scrollTop + root.clientHeight >= root.scrollHeight - margin;

    const now = Date.now();
    if (now - this.lastFlipAt < 250) return; // cooldown

    if (event.deltaY > 0 && atBottom && idx < ids.length - 1) {
      event.preventDefault();
      this.lastFlipAt = now;
      this.flipToPage(ids[idx + 1], 'start');
      return;
    }

    if (event.deltaY < 0 && atTop && idx > 0) {
      event.preventDefault();
      this.lastFlipAt = now;
      this.flipToPage(ids[idx - 1], 'end');
      return;
    }
  }

  private flipToPage(pageId: string, align: ScrollLogicalPosition): void {
    this.isPaging = true;
    this.editorState.setActivePage(pageId);

    // Wait for Angular to render the new page surface then snap into view
    queueMicrotask(() => {
      // allow layout to settle
      requestAnimationFrame(() => {
        this.scrollActivePageIntoView(align, true);
      });
      // small cooldown to avoid bouncing at boundaries
      window.setTimeout(() => {
        this.isPaging = false;
      }, 150);
    });
  }

  private scrollActivePageIntoView(
    align: ScrollLogicalPosition,
    smooth = false
  ): void {
    const pageId = this.editorState.activePageId();
    if (!pageId) return;
    const surface = document.getElementById(`page-surface-${pageId}`);
    surface?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: align });
  }
}
