import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  inject,
  Input,
  OnDestroy,
  Output,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';

export type AppModalCloseReason = 'close' | 'backdrop' | 'esc' | 'api';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app-modal.component.html',
  styleUrls: ['./app-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.Emulated,
})
export class AppModalComponent implements AfterViewInit, OnDestroy {
  private readonly document = inject(DOCUMENT);

  @ViewChild('modalContainer', { static: true }) modalContainer!: ElementRef<HTMLDivElement>;

  /** Controls visibility */
  @Input() open = false;

  /** Optional title (shown if you don't project a header) */
  @Input() title?: string;

  /** Accessibility label for the dialog; defaults to title */
  @Input() ariaLabel?: string;

  /** Modal width presets */
  @Input() size: 'sm' | 'md' | 'lg' | 'xl' | 'auto' = 'lg';

  /** Body behavior */
  @Input() bodyPadding: 'normal' | 'none' = 'normal';
  @Input() bodyScroll: 'modal' | 'content' = 'modal';

  /** Close behavior */
  @Input() closeOnBackdrop = true;
  @Input() closeOnEsc = true;

  /** Header/footer visibility */
  @Input() showHeader = true;
  @Input() showFooter = true;
  @Input() showCloseButton = true;

  /** Allow consumer to add extra classes */
  @Input() dialogClass?: string;
  @Input() backdropClass?: string;

  /** Two-way binding support */
  @Output() openChange = new EventEmitter<boolean>();

  /** Fired whenever the modal is closed */
  @Output() closed = new EventEmitter<AppModalCloseReason>();

  private appendedToBody = false;
  private previousBodyOverflow: string | null = null;

  ngAfterViewInit(): void {
    // Bootstrap-style: render at document.body level to avoid stacking-context issues.
    const el = this.modalContainer?.nativeElement;
    if (el && !this.appendedToBody) {
      this.document.body.appendChild(el);
      this.appendedToBody = true;
    }
    this.syncBodyScrollLock();
  }

  ngOnDestroy(): void {
    this.unlockBodyScroll();
    const el = this.modalContainer?.nativeElement;
    if (el && this.appendedToBody && el.parentNode === this.document.body) {
      this.document.body.removeChild(el);
    }
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: KeyboardEvent): void {
    if (!this.open || !this.closeOnEsc) return;
    event.preventDefault();
    this.close('esc');
  }

  onBackdropMouseDown(event: MouseEvent): void {
    event.stopPropagation();
    if (!this.open || !this.closeOnBackdrop) return;
    this.close('backdrop');
  }

  close(reason: AppModalCloseReason = 'api'): void {
    if (!this.open) return;
    this.setOpen(false, reason);
  }

  /** Internal helper to update state + emit events consistently */
  private setOpen(next: boolean, reason?: AppModalCloseReason): void {
    this.open = next;
    this.openChange.emit(this.open);
    this.syncBodyScrollLock();
    if (!next && reason) {
      this.closed.emit(reason);
    }
  }

  private syncBodyScrollLock(): void {
    if (this.open) {
      this.lockBodyScroll();
    } else {
      this.unlockBodyScroll();
    }
  }

  private lockBodyScroll(): void {
    if (this.previousBodyOverflow !== null) return;
    this.previousBodyOverflow = this.document.body.style.overflow || '';
    this.document.body.style.overflow = 'hidden';
  }

  private unlockBodyScroll(): void {
    if (this.previousBodyOverflow === null) return;
    this.document.body.style.overflow = this.previousBodyOverflow;
    this.previousBodyOverflow = null;
  }
}


