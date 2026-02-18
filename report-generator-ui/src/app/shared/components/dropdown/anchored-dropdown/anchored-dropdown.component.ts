import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Inject,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  Renderer2,
  SimpleChanges,
  TemplateRef,
  ViewChild,
  ViewContainerRef,
} from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
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

  @ViewChild('dropdownTemplate', { static: true }) dropdownTemplate!: TemplateRef<unknown>;
  @ViewChild('panel') panelRef?: ElementRef<HTMLElement>;

  panelStyle: Record<string, string> = {};

  private removeDocListener?: () => void;
  private coordinatorSub?: Subscription;
  private needsPositionUpdate = false;
  private portalHost?: HTMLElement;
  private embeddedViewRef?: ReturnType<TemplateRef<unknown>['createEmbeddedView']>;

  constructor(
    private readonly zone: NgZone,
    private readonly cdr: ChangeDetectorRef,
    private readonly coordinator: DropdownCoordinatorService,
    private readonly renderer: Renderer2,
    private readonly viewContainerRef: ViewContainerRef,
    @Inject(DOCUMENT) private readonly document: Document
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
        this.createPortal();
        this.needsPositionUpdate = true;
        this.attachOutsideClickListener();
      } else {
        this.detachOutsideClickListener();
        this.destroyPortal();
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
    this.destroyPortal();
    this.coordinatorSub?.unsubscribe();
    window.removeEventListener('resize', this.onWindowChange);
    window.removeEventListener('scroll', this.onWindowChange, true);
  }

  close(): void {
    if (!this.open) return;
    this.openChange.emit(false);
    this.closed.emit();
  }

  private createPortal(): void {
    if (this.portalHost) return;

    // Create host element and append to body
    this.portalHost = this.renderer.createElement('div');
    this.renderer.addClass(this.portalHost, 'anchored-dropdown-portal');
    this.renderer.setStyle(this.portalHost, 'position', 'fixed');
    this.renderer.setStyle(this.portalHost, 'top', '0');
    this.renderer.setStyle(this.portalHost, 'left', '0');
    this.renderer.setStyle(this.portalHost, 'width', '100%');
    this.renderer.setStyle(this.portalHost, 'height', '100%');

    // Layering:
    // - Outside modals: keep dropdowns above editor UI overlays.
    // - Inside modals: keep dropdowns above the modal (modal z-index is 999999).
    const isInsideModal = !!this.anchor?.closest?.('.app-modal__dialog');
    this.renderer.setStyle(this.portalHost, 'z-index', isInsideModal ? '1000000' : '5000');
    this.renderer.setStyle(this.portalHost, 'pointer-events', 'none');
    this.renderer.appendChild(this.document.body, this.portalHost);

    // Create embedded view from template and attach to portal host
    this.embeddedViewRef = this.viewContainerRef.createEmbeddedView(this.dropdownTemplate);
    this.embeddedViewRef.rootNodes.forEach((node) => {
      this.renderer.appendChild(this.portalHost, node);
    });
    this.embeddedViewRef.detectChanges();
  }

  private destroyPortal(): void {
    if (this.embeddedViewRef) {
      this.embeddedViewRef.destroy();
      this.embeddedViewRef = undefined;
    }

    if (this.portalHost) {
      this.renderer.removeChild(this.document.body, this.portalHost);
      this.portalHost = undefined;
    }
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

      // IMPORTANT: This dropdown is portaled to body. During the first tick after opening,
      // `panelRef` may not be available yet even though pointer events already fire.
      // Fall back to querying the portal host to avoid incorrectly treating an inside click
      // as an outside click (which can swallow menu item actions).
      const panelEl =
        this.panelRef?.nativeElement ??
        (this.portalHost?.querySelector?.('.anchored-dropdown') as HTMLElement | null) ??
        undefined;

      // If the panel isn't resolved yet, do not treat this as an outside click.
      // This can happen in the first tick after opening (portal creation timing).
      if (!panelEl) return;
      if (panelEl?.contains(target)) return;
      if (this.anchor?.contains(target)) return;

      this.zone.run(() => this.close());
    };

    const escHandler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        this.zone.run(() => this.close());
      }
    };

    // Use bubble phase so inner handlers can run first; this avoids edge cases where
    // a portaled panel hasn't been resolved yet in the first capture-phase event.
    document.addEventListener('pointerdown', handler, false);
    document.addEventListener('keydown', escHandler, true);

    this.removeDocListener = () => {
      document.removeEventListener('pointerdown', handler, false);
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
    const viewportWidth = window.innerWidth;
    const maxFitWidth = Math.max(120, viewportWidth - (padding * 2));
    const effectivePanelWidth = Math.min(panelWidth, maxFitWidth);

    // Always position BELOW the anchor
    let top = anchorRect.bottom + this.offsetPx;

    // Determine horizontal alignment - default to anchor's left edge
    let left = anchorRect.left;

    if (this.align === 'end') {
      // Align panel's right edge to anchor's right edge
      left = anchorRect.right - effectivePanelWidth;
    } else if (this.align === 'auto') {
      // Check if opening at anchor.left would overflow right edge
      const wouldOverflowRight = (anchorRect.left + effectivePanelWidth) > (window.innerWidth - padding);
      
      if (wouldOverflowRight) {
        // Try aligning panel's right edge to anchor's right edge
        left = anchorRect.right - effectivePanelWidth;
        
        // If that would overflow left, just clamp to right edge of viewport
        if (left < padding) {
          left = window.innerWidth - padding - effectivePanelWidth;
        }
      }
    }

    // Final hard clamp: ensure panel always stays within viewport horizontally.
    const minLeft = padding;
    const maxLeft = Math.max(padding, viewportWidth - padding - effectivePanelWidth);
    left = Math.min(Math.max(left, minLeft), maxLeft);

    // Clamp top to viewport (if dropdown would go below viewport, push it up)
    if (top + panelHeight > window.innerHeight - padding) {
      top = Math.max(padding, window.innerHeight - padding - panelHeight);
    }

    this.panelStyle = {
      position: 'absolute',
      top: `${Math.round(top)}px`,
      left: `${Math.round(left)}px`,
      width: `${Math.round(effectivePanelWidth)}px`,
      minWidth: `${Math.round(Math.min(this.minWidthPx, effectivePanelWidth))}px`,
      maxWidth: `${this.maxWidthPx}px`,
      pointerEvents: 'auto',
    };

    this.cdr.markForCheck();
    this.embeddedViewRef?.detectChanges();
  }
}
