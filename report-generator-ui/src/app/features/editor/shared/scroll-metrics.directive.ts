import {
  AfterViewInit,
  Directive,
  ElementRef,
  OnDestroy,
  inject,
  signal,
} from '@angular/core';

export interface ScrollToRequest {
  top: number;
  behavior: ScrollBehavior;
}

/**
 * ScrollMetricsDirective
 *
 * Low-level adapter around a scroll container element.
 * - Tracks scrollTop/scrollHeight/clientHeight as signals
 * - Provides scrollTo/scrollBy helpers
 *
 * This is intentionally UI-agnostic and reusable.
 */
@Directive({
  selector: '[appScrollMetrics]',
  exportAs: 'scrollMetrics',
})
export class ScrollMetricsDirective implements AfterViewInit, OnDestroy {
  private readonly elRef = inject(ElementRef<HTMLElement>);

  private readonly _scrollTop = signal(0);
  private readonly _scrollHeight = signal(0);
  private readonly _clientHeight = signal(0);

  readonly scrollTop = this._scrollTop.asReadonly();
  readonly scrollHeight = this._scrollHeight.asReadonly();
  readonly clientHeight = this._clientHeight.asReadonly();

  private resizeObserver?: ResizeObserver;
  private rafPending = false;

  private readonly onScroll = () => {
    this.scheduleRefresh();
  };

  ngAfterViewInit(): void {
    const el = this.elRef.nativeElement;
    this.refresh();

    el.addEventListener('scroll', this.onScroll, { passive: true });
    this.resizeObserver = new ResizeObserver(() => this.scheduleRefresh());
    this.resizeObserver.observe(el);
  }

  ngOnDestroy(): void {
    const el = this.elRef.nativeElement;
    el.removeEventListener('scroll', this.onScroll as any);
    this.resizeObserver?.disconnect();
  }

  /** Force-refresh metrics (call after layout-affecting operations like zoom). */
  refresh(): void {
    const el = this.elRef.nativeElement;
    this._scrollTop.set(el.scrollTop);
    this._scrollHeight.set(el.scrollHeight);
    this._clientHeight.set(el.clientHeight);
  }

  scrollTo(req: ScrollToRequest): void {
    const el = this.elRef.nativeElement;
    const maxTop = Math.max(0, el.scrollHeight - el.clientHeight);
    const top = Math.max(0, Math.min(maxTop, req.top));
    el.scrollTo({ top, behavior: req.behavior });
    this.scheduleRefresh();
  }

  scrollBy(deltaY: number, behavior: ScrollBehavior = 'auto'): void {
    const el = this.elRef.nativeElement;
    const maxTop = Math.max(0, el.scrollHeight - el.clientHeight);
    const top = Math.max(0, Math.min(maxTop, el.scrollTop + deltaY));
    el.scrollTo({ top, behavior });
    this.scheduleRefresh();
  }

  private scheduleRefresh(): void {
    if (this.rafPending) return;
    this.rafPending = true;
    requestAnimationFrame(() => {
      this.rafPending = false;
      this.refresh();
    });
  }
}


