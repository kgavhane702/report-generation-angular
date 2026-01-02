import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DOCUMENT } from '@angular/common';
import { DomSanitizer } from '@angular/platform-browser';
import { forkJoin, of } from 'rxjs';
import { catchError, take } from 'rxjs/operators';

/**
 * List of icons to preload at app startup for instant rendering.
 * These are the most commonly used toolbar icons.
 */
const PRELOAD_ICONS = [
  // Basic formatting
  'bold',
  'italic',
  'underline',
  'strikethrough',
  'superscript',
  'subscript',
  // Alignment
  'alignLeft',
  'alignCenter',
  'alignRight',
  'alignJustify',
  'vAlignTop',
  'vAlignMiddle',
  'vAlignBottom',
  // Lists & indent
  'indentDecrease',
  'indentIncrease',
  // Typography
  'lineHeight',
  // Colors
  'format_color_text',
  'format_ink_highlighter',
  'format_color_fill',
  // Table operations
  'table',
  'table_split',
  'table_merge',
  'insert_row_above',
  'insert_row_below',
  'insert_col_left',
  'insert_col_right',
  'delete_row',
  'delete_col',
  'tune',
  'border_color',
  // Editor toolbar
  'text_fields',
  'edit_note',
  'image',
  'download',
  'upload',
  'picture_as_pdf',
  'undo',
  'redo',
  'edit',
  'check_circle',
  'cloud_done',
  'sync',
  // Dropdowns
  'caret_down',
  'caret_down_small',
];

/**
 * Static cache shared with AppIconComponent.
 * Must match the cache key format used there.
 */
const svgCache = new Map<string, any>();

@Injectable({ providedIn: 'root' })
export class IconPreloaderService {
  private readonly http = inject(HttpClient);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly document = inject(DOCUMENT);

  private preloaded = false;

  /**
   * Get the shared SVG cache (used by AppIconComponent).
   */
  static getCache(): Map<string, any> {
    return svgCache;
  }

  /**
   * Preload all toolbar icons. Call this at app startup.
   * Returns a promise that resolves when all icons are cached.
   */
  preloadIcons(): Promise<void> {
    if (this.preloaded) {
      return Promise.resolve();
    }

    const requests = PRELOAD_ICONS.map((iconName) => {
      // Skip if already cached
      if (svgCache.has(iconName)) {
        return of(null);
      }

      const url = new URL(`assets/icons/${iconName}.svg`, this.document.baseURI).toString();

      return this.http.get(url, { responseType: 'text' }).pipe(
        take(1),
        catchError((err) => {
          console.warn(`[IconPreloader] Failed to preload: ${iconName}`, err);
          return of(null);
        })
      );
    });

    return new Promise((resolve) => {
      forkJoin(requests).subscribe({
        next: (results) => {
          results.forEach((svgContent, index) => {
            if (svgContent) {
              const iconName = PRELOAD_ICONS[index];
              const normalized = svgContent
                .replace(/<\?xml[\s\S]*?\?>/gi, '')
                .replace(/<!doctype[\s\S]*?>/gi, '')
                .trim();
              const trusted = this.sanitizer.bypassSecurityTrustHtml(normalized);
              svgCache.set(iconName, trusted);
            }
          });
          this.preloaded = true;
          resolve();
        },
        error: () => {
          this.preloaded = true;
          resolve();
        },
      });
    });
  }
}

