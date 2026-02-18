import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { firstValueFrom, forkJoin, Observable, of } from 'rxjs';
import { catchError, finalize, map, shareReplay, take } from 'rxjs/operators';

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
  'lock',
  'lock_open',
  'expand',
  'collapse',
  'undo',
  'redo',
  'edit',
  'check_circle',
  'cloud_done',
  'sync',
  // Ribbon custom SVGrepo-style icons
  'design_tab_svgrepo',
  'insert_tab_svgrepo',
  'design_themes_svgrepo',
  'quick_add_svgrepo',
  // Dropdowns
  'caret_down',
  'caret_down_small',
];

/**
 * Static cache shared with AppIconComponent.
 * Must match the cache key format used there.
 */
const svgCache = new Map<string, SafeHtml>();
const inFlightLoads = new Map<string, Observable<SafeHtml | null>>();

@Injectable({ providedIn: 'root' })
export class IconPreloaderService {
  private readonly http = inject(HttpClient);
  private readonly sanitizer = inject(DomSanitizer);

  private preloaded = false;

  /**
   * Get the shared SVG cache (used by AppIconComponent).
   */
  static getCache(): Map<string, SafeHtml> {
    return svgCache;
  }

  /**
   * Load and cache a single icon by name.
   * Concurrent calls for the same icon share one HTTP request.
   */
  getIcon(iconName: string): Observable<SafeHtml | null> {
    if (!iconName) {
      return of(null);
    }

    const cached = svgCache.get(iconName);
    if (cached) {
      return of(cached);
    }

    const existingRequest = inFlightLoads.get(iconName);
    if (existingRequest) {
      return existingRequest;
    }

    const url = `assets/icons/${iconName}.svg`;
    const request$ = this.http.get(url, { responseType: 'text' }).pipe(
      map((svgContent) => {
        const normalized = svgContent
          .replace(/<\?xml[\s\S]*?\?>/gi, '')
          .replace(/<!doctype[\s\S]*?>/gi, '')
          .trim();
        const trusted = this.sanitizer.bypassSecurityTrustHtml(normalized);
        svgCache.set(iconName, trusted);
        return trusted;
      }),
      catchError((err) => {
        console.warn(`[IconPreloader] Failed to load icon: ${iconName}`, err);
        return of(null);
      }),
      finalize(() => {
        inFlightLoads.delete(iconName);
      }),
      shareReplay(1)
    );

    inFlightLoads.set(iconName, request$);
    return request$;
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
      return this.getIcon(iconName).pipe(take(1));
    });

    return firstValueFrom(
      forkJoin(requests).pipe(
        map(() => void 0),
        catchError(() => of(void 0))
      )
    ).then(() => {
      this.preloaded = true;
    });
  }
}

