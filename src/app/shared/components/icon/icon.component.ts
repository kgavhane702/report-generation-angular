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
import { CommonModule, DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

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
  private readonly http = inject(HttpClient);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly document = inject(DOCUMENT);

  @Input({ required: true }) name!: string;
  // Default icon size for toolbars is 13px. Individual callsites can still override.
  @Input() size: number = 14;
  @Input() ariaHidden: boolean = true;

  iconSvg = signal<SafeHtml>('');
  iconUrl = signal<string>('');

  private static readonly svgCache = new Map<string, SafeHtml>();

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

    const cached = AppIconComponent.svgCache.get(iconName);
    if (cached) {
      this.iconSvg.set(cached);
      this.iconUrl.set('');
      this.cdr.markForCheck();
      return;
    }

    // IMPORTANT:
    // Use document.baseURI so this works under routed URLs and non-root deployments.
    // Example: if you're on /editor/page/1, `assets/...` would otherwise request /editor/page/1/assets/... (404).
    const resolvedUrl = new URL(`assets/icons/${iconName}.svg`, this.document.baseURI).toString();
    this.iconUrl.set(resolvedUrl);
    
    this.http.get(resolvedUrl, { responseType: 'text' }).subscribe({
      next: (svgContent) => {
        // IMPORTANT:
        // Angular's HTML sanitizer strips <svg> content when bound via [innerHTML],
        // which makes icons render empty and emits:
        // "WARNING: sanitizing HTML stripped some content"
        //
        // These SVGs are loaded from our own build-time assets folder, so we trust them.
        // Some SVG sources include XML/DOCTYPE headers that don't belong inside innerHTML.
        const normalized = svgContent
          .replace(/<\?xml[\s\S]*?\?>/gi, '')
          .replace(/<!doctype[\s\S]*?>/gi, '')
          .trim();

        const trusted = this.sanitizer.bypassSecurityTrustHtml(normalized);
        AppIconComponent.svgCache.set(iconName, trusted);
        this.iconSvg.set(trusted);
        this.iconUrl.set('');
        this.cdr.markForCheck();
      },
      error: (err) => {
        // Keep iconUrl() so <img> fallback can still try to render the file.
        console.warn(`[AppIcon] Failed to inline icon: ${iconName}`, err);
        this.iconSvg.set('');
        this.cdr.markForCheck();
      },
    });
  }
}

