import {
  ChangeDetectionStrategy,
  Component,
  HostBinding,
  inject,
  ViewChild,
  ElementRef,
  AfterViewInit,
  computed,
  signal,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { Store } from '@ngrx/store';
import { Subscription } from 'rxjs';

import { EditorStateService } from '../../../core/services/editor-state.service';
import { UIStateService } from '../../../core/services/ui-state.service';
import { DocumentService } from '../../../core/services/document.service';
import { AppState } from '../../../store/app.state';
import { DocumentSelectors } from '../../../store/document/document.selectors';

/**
 * PageCanvasComponent
 * 
 * FIXED: Now uses granular selectors instead of nested document traversal.
 * 
 * Before: subsection.pages → new array on ANY widget change → all pages re-render
 * After: selectPageIdsForSubsection → stable array, only changes on page add/remove
 */
@Component({
  selector: 'app-page-canvas',
  templateUrl: './page-canvas.component.html',
  styleUrls: ['./page-canvas.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageCanvasComponent implements OnInit, AfterViewInit, OnDestroy {
  protected readonly editorState = inject(EditorStateService);
  protected readonly uiState = inject(UIStateService);
  protected readonly documentService = inject(DocumentService);
  private readonly store = inject(Store<AppState>);
  private readonly elementRef = inject(ElementRef);

  @ViewChild('viewport', { static: false }) viewportRef?: ElementRef<HTMLElement>;

  /**
   * Zoom level from UIStateService
   */
  readonly zoom = this.uiState.zoomLevel;

  @HostBinding('class.page-canvas') hostClass = true;

  /**
   * Page IDs for the active subsection - STABLE reference
   * Only changes when pages are added/removed, NOT when widget content changes
   */
  private readonly _pageIds = signal<string[]>([]);
  readonly pageIds = this._pageIds.asReadonly();

  /**
   * Active subsection ID for tracking
   */
  readonly activeSubsectionId = this.editorState.activeSubsectionId;

  /**
   * Subscription management
   */
  private pageIdsSubscription?: Subscription;

  /**
   * Computed zoom transform style
   */
  readonly zoomTransform = computed(() => {
    const zoomValue = this.zoom() / 100;
    return `scale(${zoomValue})`;
  });

  readonly zoomOrigin = 'top center';

  ngOnInit(): void {
    // Subscribe to page IDs using granular selector
    this.subscribeToPageIds();
  }

  ngAfterViewInit(): void {
    (this.editorState as any).calculateFitZoom = () => this.calculateFitZoom();
  }

  ngOnDestroy(): void {
    this.pageIdsSubscription?.unsubscribe();
  }

  /**
   * Subscribe to page IDs for the active subsection
   * This uses the granular selector that only emits when pages are added/removed
   */
  private subscribeToPageIds(): void {
    // Watch for subsection changes and update page IDs subscription
    const subsectionId = this.activeSubsectionId();
    if (subsectionId) {
      this.updatePageIdsSubscription(subsectionId);
    }
  }

  private updatePageIdsSubscription(subsectionId: string): void {
    this.pageIdsSubscription?.unsubscribe();
    
    this.pageIdsSubscription = this.store
      .select(DocumentSelectors.selectPageIdsForSubsection(subsectionId))
      .subscribe(ids => {
        this._pageIds.set(ids);
      });
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
    const pageSize = this.documentService.document.pageSize;
    const dpi = pageSize.dpi ?? 96;
    const widthMm = Math.max(pageSize.widthMm, pageSize.heightMm);
    return Math.round((widthMm / 25.4) * dpi);
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
   * Calculate zoom level to fit the page within the visible canvas area
   */
  calculateFitZoom(): number {
    const subsection = this.editorState.activeSubsection();
    if (!subsection || subsection.pages.length === 0) {
      return 100;
    }

    const activePage = subsection.pages.find(
      (p) => p.id === this.editorState.activePageId()
    ) || subsection.pages[0];

    if (!activePage) {
      return 100;
    }

    const pageSize = this.documentService.document.pageSize;
    const orientation = activePage.orientation || 'landscape';
    const { widthMm, heightMm } = pageSize;
    
    let pageWidthMm = widthMm;
    let pageHeightMm = heightMm;
    if (orientation === 'portrait' && widthMm > heightMm) {
      pageWidthMm = heightMm;
      pageHeightMm = widthMm;
    } else if (orientation === 'landscape' && heightMm > widthMm) {
      pageWidthMm = heightMm;
      pageHeightMm = widthMm;
    }

    const dpi = pageSize.dpi ?? 96;
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
}
