import { Directive, ElementRef, HostListener, Input, OnChanges, SecurityContext, SimpleChanges, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/**
 * `twSafeInnerHtml`
 *
 * Problem:
 * - In a contenteditable element, rebinding `[innerHTML]` while the element is focused will reset the
 *   browser caret/selection (often jumping the cursor back to the start).
 *
 * Fix:
 * - Apply innerHTML updates ONLY when the element is not focused.
 * - When a focused element receives new HTML, defer it and apply on blur.
 *
 * Usage:
 *   <div contenteditable [twSafeInnerHtml]="html | safeHtml"></div>
 */
@Directive({
  selector: '[twSafeInnerHtml]',
  standalone: true,
})
export class TwSafeInnerHtmlDirective implements OnChanges {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly sanitizer = inject(DomSanitizer);

  @Input('twSafeInnerHtml') html: SafeHtml | null | undefined;

  private pendingHtml: SafeHtml | null | undefined;

  ngOnChanges(_changes: SimpleChanges): void {
    this.applyOrDefer();
  }

  @HostListener('blur')
  onHostBlur(): void {
    // CRITICAL:
    // Do NOT write innerHTML during the same blur event tick.
    //
    // In the table widget, (blur) is used to read the current DOM content and sync it into the model.
    // If we overwrite DOM on blur (with whatever the last bound value was), fast cell switching can
    // cause the user's latest typed text to be replaced by stale model HTML => "text resets".
    //
    // Only apply if we actually deferred a binding update while focused, and do it in a microtask
    // after the component blur handler has run.
    if (this.pendingHtml === undefined) {
      return;
    }

    const pending = this.pendingHtml;
    this.pendingHtml = undefined;

    const schedule =
      typeof queueMicrotask === 'function'
        ? queueMicrotask
        : (cb: () => void) => Promise.resolve().then(cb);

    schedule(() => {
      this.html = pending;
      this.applyNow();
    });
  }

  private applyOrDefer(): void {
    const el = this.host.nativeElement;
    const isFocused = typeof document !== 'undefined' && document.activeElement === el;
    if (isFocused) {
      this.pendingHtml = this.html;
      return;
    }
    this.applyNow();
  }

  private applyNow(): void {
    const el = this.host.nativeElement;
    const next = this.sanitizer.sanitize(SecurityContext.HTML, this.html ?? null) ?? '';
    // Avoid unnecessary writes; even setting the same HTML can reset selection in some browsers.
    if (el.innerHTML !== next) {
      el.innerHTML = next;
    }
  }
}


