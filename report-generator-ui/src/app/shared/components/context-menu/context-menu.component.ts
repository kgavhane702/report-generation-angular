import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Inject,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  Renderer2,
  SimpleChanges,
} from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { AnchoredDropdownComponent } from '../dropdown/anchored-dropdown/anchored-dropdown.component';
import { AppIconComponent } from '../icon/icon.component';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  disabled?: boolean;
  danger?: boolean;
}

@Component({
  selector: 'app-context-menu',
  standalone: true,
  imports: [CommonModule, AnchoredDropdownComponent, AppIconComponent],
  templateUrl: './context-menu.component.html',
  styleUrls: ['./context-menu.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContextMenuComponent implements OnChanges, OnDestroy {
  @Input() open = false;
  @Input() x: number | null = null;
  @Input() y: number | null = null;
  @Input() minWidthPx = 180;
  @Input() items: ContextMenuItem[] = [];

  @Output() openChange = new EventEmitter<boolean>();
  @Output() itemSelected = new EventEmitter<string>();

  anchorEl?: HTMLElement;

  constructor(
    private readonly renderer: Renderer2,
    @Inject(DOCUMENT) private readonly document: Document
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']) {
      if (this.open) {
        this.ensureAnchor();
        this.updateAnchorPosition();
      } else {
        this.destroyAnchor();
      }
    }

    if ((changes['x'] || changes['y']) && this.open) {
      this.updateAnchorPosition();
    }
  }

  ngOnDestroy(): void {
    this.destroyAnchor();
  }

  onDropdownOpenChange(open: boolean): void {
    this.openChange.emit(open);
    if (!open) {
      this.destroyAnchor();
    }
  }

  onItemClick(item: ContextMenuItem, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();

    if (item.disabled) return;

    this.itemSelected.emit(item.id);
    this.openChange.emit(false);
    this.destroyAnchor();
  }

  onItemPointerDown(item: ContextMenuItem, event: PointerEvent): void {
    // Prefer pointerdown so the action runs even if something prevents a later click.
    event.preventDefault();
    event.stopPropagation();

    if (item.disabled) return;

    this.itemSelected.emit(item.id);
    this.openChange.emit(false);
    this.destroyAnchor();
  }

  private ensureAnchor(): void {
    if (this.anchorEl) return;

    const el = this.renderer.createElement('div') as HTMLElement;
    this.renderer.addClass(el, 'context-menu__anchor');
    this.renderer.setStyle(el, 'position', 'fixed');
    this.renderer.setStyle(el, 'left', '0px');
    this.renderer.setStyle(el, 'top', '0px');
    this.renderer.setStyle(el, 'width', '0px');
    this.renderer.setStyle(el, 'height', '0px');
    this.renderer.setStyle(el, 'pointer-events', 'none');
    this.renderer.setStyle(el, 'z-index', '0');

    this.renderer.appendChild(this.document.body, el);
    this.anchorEl = el;
  }

  private updateAnchorPosition(): void {
    if (!this.anchorEl) return;
    const x = this.x ?? 0;
    const y = this.y ?? 0;

    this.renderer.setStyle(this.anchorEl, 'left', `${Math.round(x)}px`);
    this.renderer.setStyle(this.anchorEl, 'top', `${Math.round(y)}px`);
  }

  private destroyAnchor(): void {
    if (!this.anchorEl) return;
    this.renderer.removeChild(this.document.body, this.anchorEl);
    this.anchorEl = undefined;
  }
}
