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
} from '@angular/core';

import { EditorStateService } from '../../../core/services/editor-state.service';
import { UIStateService } from '../../../core/services/ui-state.service';

/**
 * PageCanvasComponent
 * 
 * Uses EditorStateService's reactive signals for page rendering.
 * Automatically reacts to subsection changes via computed signals.
 */
@Component({
  selector: 'app-page-canvas',
  templateUrl: './page-canvas.component.html',
  styleUrls: ['./page-canvas.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageCanvasComponent implements AfterViewInit {
  protected readonly editorState = inject(EditorStateService);
  protected readonly uiState = inject(UIStateService);
  private readonly elementRef = inject(ElementRef);

  @ViewChild('viewport', { static: false }) viewportRef?: ElementRef<HTMLElement>;

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
}
