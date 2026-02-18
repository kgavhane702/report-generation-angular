import {
  ChangeDetectionStrategy,
  Component,
  Input,
  inject,
  OnChanges,
  OnInit,
  signal,
  ChangeDetectorRef,
  SimpleChanges,
  ViewEncapsulation,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SafeHtml } from '@angular/platform-browser';
import { IconPreloaderService } from './icon-preloader.service';

/**
 * AppIconComponent
 * 
 * Displays SVG icons from assets/icons folder.
 * Icons use currentColor for stroke/fill, so they inherit the parent's text color.
 */
@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="app-icon" [style.width.px]="size" [style.height.px]="size" [attr.aria-hidden]="ariaHidden ? 'true' : null">
      <span class="app-icon__inline" [innerHTML]="iconSvg()"></span>
      <img
        *ngIf="!iconSvg() && iconUrl()"
        class="app-icon__img"
        [src]="iconUrl()"
        [attr.alt]="''"
        [attr.width]="size"
        [attr.height]="size"
      />
    </span>
  `,
  styles: [`
    .app-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      vertical-align: middle;
    }
    
    .app-icon svg,
    .app-icon__img {
      width: 100%;
      height: 100%;
      display: block;
    }

    .app-icon__inline {
      display: contents;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class AppIconComponent implements OnInit, OnChanges {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly iconPreloader = inject(IconPreloaderService);

  @Input({ required: true }) name!: string;
  // Default icon size for toolbars is 13px. Individual callsites can still override.
  @Input() size: number = 14;
  @Input() ariaHidden: boolean = true;

  iconSvg = signal<SafeHtml>('');
  iconUrl = signal<string>('');

  ngOnInit(): void {
    if (!this.name) {
      console.warn('[AppIcon] icon name is required');
      return;
    }

    this.loadIcon(this.name);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['name'] && !changes['name'].firstChange) {
      this.loadIcon(this.name);
    }
  }

  private loadIcon(iconName: string): void {
    if (!iconName) return;

    const cache = IconPreloaderService.getCache();
    const cached = cache.get(iconName);
    if (cached) {
      this.iconSvg.set(cached);
      this.iconUrl.set('');
      this.cdr.markForCheck();
      return;
    }

    this.iconSvg.set('');
    this.iconUrl.set(`assets/icons/${iconName}.svg`);

    this.iconPreloader.getIcon(iconName).subscribe({
      next: (svgContent) => {
        if (svgContent) {
          this.iconSvg.set(svgContent);
          this.iconUrl.set('');
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.warn(`[AppIcon] Failed to inline icon: ${iconName}`, err);
        this.iconSvg.set('');
        this.cdr.markForCheck();
      },
    });
  }
}

