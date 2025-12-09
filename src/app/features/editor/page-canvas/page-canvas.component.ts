import {
  ChangeDetectionStrategy,
  Component,
  HostBinding,
  inject,
  ChangeDetectorRef,
  effect,
  ViewChild,
  ElementRef,
  AfterViewInit,
} from '@angular/core';

import { EditorStateService } from '../../../core/services/editor-state.service';
import { DocumentService } from '../../../core/services/document.service';

@Component({
  selector: 'app-page-canvas',
  templateUrl: './page-canvas.component.html',
  styleUrls: ['./page-canvas.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageCanvasComponent implements AfterViewInit {
  protected readonly editorState = inject(EditorStateService);
  protected readonly documentService = inject(DocumentService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly elementRef = inject(ElementRef);

  @ViewChild('viewport', { static: false }) viewportRef?: ElementRef<HTMLElement>;

  readonly zoom = this.editorState.zoom;

  @HostBinding('class.page-canvas') hostClass = true;

  constructor() {
    // Trigger change detection when zoom changes
    effect(() => {
      this.editorState.zoom();
      this.cdr.markForCheck();
    });
  }

  ngAfterViewInit(): void {
    // Expose method to calculate fit zoom
    (this.editorState as any).calculateFitZoom = () => this.calculateFitZoom();
  }

  get zoomTransform(): string {
    const zoomValue = this.zoom() / 100;
    return `scale(${zoomValue})`;
  }

  get zoomOrigin(): string {
    return 'top center';
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

    // Get page dimensions (in pixels)
    const pageSize = this.documentService.document.pageSize;
    const orientation = activePage.orientation || 'landscape';
    const { widthMm, heightMm } = pageSize;
    
    // Get oriented dimensions
    let pageWidthMm = widthMm;
    let pageHeightMm = heightMm;
    if (orientation === 'portrait' && widthMm > heightMm) {
      pageWidthMm = heightMm;
      pageHeightMm = widthMm;
    } else if (orientation === 'landscape' && heightMm > widthMm) {
      pageWidthMm = heightMm;
      pageHeightMm = widthMm;
    }

    // Convert to pixels
    const dpi = pageSize.dpi ?? 96;
    const pageWidthPx = Math.round((pageWidthMm / 25.4) * dpi);
    const pageHeightPx = Math.round((pageHeightMm / 25.4) * dpi);

    // Get canvas viewport dimensions
    const canvasElement = this.elementRef.nativeElement.closest('.editor-shell__canvas') as HTMLElement;
    if (!canvasElement) {
      return 100;
    }

    const viewportWidth = canvasElement.clientWidth;
    const viewportHeight = canvasElement.clientHeight;

    // Account for padding: canvas has 2rem (32px) top/bottom and 3rem (48px) left/right
    // Page canvas has 2rem (32px) top/bottom and 2.5rem (40px) left/right
    const canvasPadding = {
      top: 32,
      right: 48,
      bottom: 32,
      left: 48,
    };

    const pageCanvasPadding = {
      top: 32,
      right: 40,
      bottom: 32,
      left: 40,
    };

    // Total padding
    const totalPadding = {
      top: canvasPadding.top + pageCanvasPadding.top,
      right: canvasPadding.right + pageCanvasPadding.right,
      bottom: canvasPadding.bottom + pageCanvasPadding.bottom,
      left: canvasPadding.left + pageCanvasPadding.left,
    };

    // Calculate available space
    const availableWidth = viewportWidth - totalPadding.left - totalPadding.right;
    const availableHeight = viewportHeight - totalPadding.top - totalPadding.bottom;

    // Calculate zoom ratios
    const widthRatio = (availableWidth / pageWidthPx) * 100;
    const heightRatio = (availableHeight / pageHeightPx) * 100;

    // Use the smaller ratio to ensure page fits completely
    const fitZoom = Math.min(widthRatio, heightRatio);

    // Clamp between 10% and 400%
    return Math.max(10, Math.min(400, Math.floor(fitZoom)));
  }
}

