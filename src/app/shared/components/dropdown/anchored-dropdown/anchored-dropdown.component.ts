import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { DropdownCoordinatorService } from '../dropdown-coordinator.service';
import { createDropdownId } from '../dropdown-id.util';

export type DropdownAlign = 'start' | 'end' | 'auto';

@Component({
  selector: 'app-anchored-dropdown',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './anchored-dropdown.component.html',
  styleUrls: ['./anchored-dropdown.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnchoredDropdownComponent implements OnInit, OnChanges, OnDestroy, AfterViewChecked {
  private readonly instanceId = createDropdownId('anchored');

  @Input() open = false;
  @Input() anchor!: HTMLElement;
  @Input() align: DropdownAlign = 'auto';
  @Input() offsetPx = 6;
  @Input() minWidthPx = 200;
  @Input() maxWidthPx = 400;

  @Output() openChange = new EventEmitter<boolean>();
  @Output() closed = new EventEmitter<void>();

  @ViewChild('panel') panelRef?: ElementRef<HTMLElement>;

  panelStyle: Record<string, string> = {};

  private removeDocListener?: () => void;
  private coordinatorSub?: Subscription;
  private needsPositionUpdate = false;

  constructor(
    private readonly zone: NgZone,
    private readonly cdr: ChangeDetectorRef,
    private readonly coordinator: DropdownCoordinatorService
  ) {}

  ngOnInit(): void {
    this.coordinatorSub = this.coordinator.opened$.subscribe((openedId) => {
      if (!this.open) return;
      if (openedId === this.instanceId) return;
      this.close();
    });

    this.zone.runOutsideAngular(() => {
      window.addEventListener('resize', this.onWindowChange);
      window.addEventListener('scroll', this.onWindowChange, true);
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']) {
      if (this.open) {
        this.coordinator.notifyOpened(this.instanceId);
        this.needsPositionUpdate = true;
        this.attachOutsideClickListener();
      } else {
        this.detachOutsideClickListener();
      }
    }

    if (changes['anchor'] || changes['align'] || changes['offsetPx']) {
      if (this.open) {
        this.needsPositionUpdate = true;
      }
    }
  }

  ngAfterViewChecked(): void {
    if (this.needsPositionUpdate && this.open && this.panelRef) {
      this.needsPositionUpdate = false;
      // Use requestAnimationFrame to ensure panel is fully rendered before measuring
      requestAnimationFrame(() => {
        if (this.open && this.panelRef) {
          this.updatePosition();
        }
      });
    }
  }

  ngOnDestroy(): void {
    this.detachOutsideClickListener();
    this.coordinatorSub?.unsubscribe();
    window.removeEventListener('resize', this.onWindowChange);
    window.removeEventListener('scroll', this.onWindowChange, true);
  }

  close(): void {
    if (!this.open) return;
    this.openChange.emit(false);
    this.closed.emit();
  }

  private onWindowChange = (): void => {
    if (this.open) {
      this.needsPositionUpdate = true;
      this.cdr.markForCheck();
    }
  };

  private attachOutsideClickListener(): void {
    if (this.removeDocListener) return;

    const handler = (event: Event) => {
      const target = event.target as Node | null;
      if (!target) return;

      const panelEl = this.panelRef?.nativeElement;
      if (panelEl?.contains(target)) return;
      if (this.anchor?.contains(target)) return;

      this.zone.run(() => this.close());
    };

    const escHandler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        this.zone.run(() => this.close());
      }
    };

    document.addEventListener('pointerdown', handler, true);
    document.addEventListener('keydown', escHandler, true);

    this.removeDocListener = () => {
      document.removeEventListener('pointerdown', handler, true);
      document.removeEventListener('keydown', escHandler, true);
    };
  }

  private detachOutsideClickListener(): void {
    this.removeDocListener?.();
    this.removeDocListener = undefined;
  }

  private updatePosition(): void {
    const anchorEl = this.anchor;
    const panelEl = this.panelRef?.nativeElement;
    if (!anchorEl || !panelEl) return;

    const padding = 8;
    const anchorRect = anchorEl.getBoundingClientRect();
    
    // Get actual panel dimensions after it's rendered
    const panelRect = panelEl.getBoundingClientRect();
    const panelWidth = panelRect.width || this.minWidthPx;
    const panelHeight = panelRect.height;

    // Always position BELOW the anchor
    let top = anchorRect.bottom + this.offsetPx;

    // Determine horizontal alignment - default to anchor's left edge
    let left = anchorRect.left;

    if (this.align === 'end') {
      // Align panel's right edge to anchor's right edge
      left = anchorRect.right - panelWidth;
    } else if (this.align === 'auto') {
      // Check if opening at anchor.left would overflow right edge
      const wouldOverflowRight = (anchorRect.left + panelWidth) > (window.innerWidth - padding);
      
      if (wouldOverflowRight) {
        // Try aligning panel's right edge to anchor's right edge
        left = anchorRect.right - panelWidth;
        
        // If that would overflow left, just clamp to right edge of viewport
        if (left < padding) {
          left = window.innerWidth - padding - panelWidth;
        }
      }
    }

    // Final clamp: ensure panel stays within viewport horizontally
    if (left < padding) {
      left = padding;
    }
    if (left + panelWidth > window.innerWidth - padding) {
      left = window.innerWidth - padding - panelWidth;
    }

    // Clamp top to viewport (if dropdown would go below viewport, push it up)
    if (top + panelHeight > window.innerHeight - padding) {
      top = Math.max(padding, window.innerHeight - padding - panelHeight);
    }

    this.panelStyle = {
      top: `${Math.round(top)}px`,
      left: `${Math.round(left)}px`,
      minWidth: `${this.minWidthPx}px`,
      maxWidth: `${this.maxWidthPx}px`,
    };

    this.cdr.markForCheck();
  }
}
