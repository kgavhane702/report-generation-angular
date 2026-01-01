import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostBinding,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  signal,
} from '@angular/core';

export interface ScrollToRequest {
  top: number;
  behavior: ScrollBehavior;
}

/**
 * SlideNavigatorComponent
 * 
 * PowerPoint-style slide navigator with:
 * - Previous/Next buttons at top/bottom
 * - Draggable thumb in the middle rail
 * - Click-to-jump on rail
 * - Mouse wheel scrolling
 */
@Component({
  selector: 'app-slide-navigator',
  templateUrl: './slide-navigator.component.html',
  styleUrls: ['./slide-navigator.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SlideNavigatorComponent implements AfterViewInit, OnDestroy {
  @HostBinding('class.slide-navigator') hostClass = true;

  // ============================================
  // INPUTS
  // ============================================

  /** Total number of pages */
  @Input({ required: true }) totalPages!: number;

  /** Current page index (0-based) */
  @Input({ required: true }) currentIndex!: number;

  /** Scroll metrics (for smooth scrollbar-like thumb behavior) */
  @Input() scrollTop = 0;
  @Input() scrollHeight = 0;
  @Input() clientHeight = 0;

  // ============================================
  // OUTPUTS
  // ============================================

  /** Emitted when user navigates to a different page */
  @Output() pageChange = new EventEmitter<number>();

  /** Emitted when user drags/clicks the rail to scroll */
  @Output() scrollTo = new EventEmitter<ScrollToRequest>();

  /** Emitted when user wheels on the rail */
  @Output() scrollBy = new EventEmitter<number>();

  // ============================================
  // VIEW CHILDREN
  // ============================================

  @ViewChild('rail', { static: true }) railRef!: ElementRef<HTMLDivElement>;
  @ViewChild('thumb', { static: true }) thumbRef!: ElementRef<HTMLDivElement>;

  // ============================================
  // STATE
  // ============================================

  private isDragging = signal(false);
  private dragStartY = 0;
  private dragStartScrollTop = 0;

  // Bound event handlers for cleanup
  private boundMouseMove = this.onMouseMove.bind(this);
  private boundMouseUp = this.onMouseUp.bind(this);

  // ============================================
  // COMPUTED
  // ============================================

  /** Expose dragging state for template/css */
  get dragging(): boolean {
    return this.isDragging();
  }

  private get maxScrollTop(): number {
    return Math.max(0, this.scrollHeight - this.clientHeight);
  }

  /** Height of the thumb as a percentage of rail (like native scrollbar) */
  get thumbHeightPercent(): number {
    if (this.scrollHeight <= 0 || this.clientHeight <= 0) return 100;
    if (this.scrollHeight <= this.clientHeight) return 100;
    const pct = (this.clientHeight / this.scrollHeight) * 100;
    return Math.max(Math.min(pct, 100), 8); // Min 8% height
  }

  /** Top position of the thumb as a percentage (tracks scrollTop smoothly) */
  get thumbTopPercent(): number {
    const maxTop = this.maxScrollTop;
    if (maxTop <= 0) return 0;
    const availablePercent = 100 - this.thumbHeightPercent;
    const ratio = this.scrollTop / maxTop;
    return Math.max(0, Math.min(availablePercent, ratio * availablePercent));
  }

  /** Can navigate to previous page */
  get canGoPrevious(): boolean {
    return this.currentIndex > 0;
  }

  /** Can navigate to next page */
  get canGoNext(): boolean {
    return this.currentIndex < this.totalPages - 1;
  }

  // ============================================
  // LIFECYCLE
  // ============================================

  ngAfterViewInit(): void {
    // No-op: rail sizing is computed on-demand from DOM rects and scroll metrics inputs.
  }

  ngOnDestroy(): void {
    this.removeGlobalListeners();
  }

  // ============================================
  // NAVIGATION METHODS
  // ============================================

  goToPrevious(): void {
    if (this.canGoPrevious) {
      this.pageChange.emit(this.currentIndex - 1);
    }
  }

  goToNext(): void {
    if (this.canGoNext) {
      this.pageChange.emit(this.currentIndex + 1);
    }
  }

  goToPage(index: number): void {
    if (index >= 0 && index < this.totalPages && index !== this.currentIndex) {
      this.pageChange.emit(index);
    }
  }

  // ============================================
  // RAIL CLICK HANDLER
  // ============================================

  onRailClick(event: MouseEvent): void {
    // Ignore if clicking on thumb
    if ((event.target as HTMLElement).closest('.slide-navigator__thumb')) {
      return;
    }

    const rail = this.railRef.nativeElement;
    const rect = rail.getBoundingClientRect();
    const clickY = event.clientY - rect.top;
    const clickPercent = clickY / rect.height;

    const availablePercent = 1 - this.thumbHeightPercent / 100;
    const normalized = availablePercent > 0 ? clickPercent / availablePercent : 0;
    const ratio = Math.max(0, Math.min(1, normalized));

    const targetTop = Math.round(ratio * this.maxScrollTop);
    this.scrollTo.emit({ top: targetTop, behavior: 'smooth' });
  }

  // ============================================
  // THUMB DRAG HANDLERS
  // ============================================

  onThumbMouseDown(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();

    this.isDragging.set(true);
    this.dragStartY = event.clientY;
    this.dragStartScrollTop = this.scrollTop;

    // Add global listeners
    document.addEventListener('mousemove', this.boundMouseMove);
    document.addEventListener('mouseup', this.boundMouseUp);
  }

  private onMouseMove(event: MouseEvent): void {
    if (!this.isDragging()) return;

    const deltaY = event.clientY - this.dragStartY;
    const rail = this.railRef.nativeElement;
    const railHeight = rail.getBoundingClientRect().height;

    const thumbHeightPx = (this.thumbHeightPercent / 100) * railHeight;
    const availableHeight = Math.max(1, railHeight - thumbHeightPx);

    const deltaRatio = deltaY / availableHeight;
    const targetTop = Math.round(
      Math.max(0, Math.min(this.maxScrollTop, this.dragStartScrollTop + deltaRatio * this.maxScrollTop))
    );

    this.scrollTo.emit({ top: targetTop, behavior: 'auto' });
  }

  private onMouseUp(): void {
    this.isDragging.set(false);
    this.removeGlobalListeners();
  }

  // ============================================
  // WHEEL SCROLL HANDLER
  // ============================================

  onWheel(event: WheelEvent): void {
    // Let the navigator behave like a scrollbar: wheel scrolls content smoothly
    this.scrollBy.emit(event.deltaY);
    event.preventDefault();
  }

  // ============================================
  // HELPERS
  // ============================================

  private removeGlobalListeners(): void {
    document.removeEventListener('mousemove', this.boundMouseMove);
    document.removeEventListener('mouseup', this.boundMouseUp);
  }
}

