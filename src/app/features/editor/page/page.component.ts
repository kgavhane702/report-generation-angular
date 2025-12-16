import {
  ChangeDetectionStrategy,
  Component,
  HostBinding,
  Input,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';

import { PageModel } from '../../../models/page.model';
import { PageSize } from '../../../models/document.model';
import { DocumentService } from '../../../core/services/document.service';
import { AppState } from '../../../store/app.state';
import { DocumentSelectors } from '../../../store/document/document.selectors';

/**
 * PageComponent
 * 
 * REFACTORED to support both:
 * 1. Legacy: full page object as input (backward compatibility)
 * 2. New: pageId input + granular selectors (optimized)
 * 
 * The key change is passing widget IDs to WidgetContainerComponent
 * instead of full widget objects, so widgets only re-render when
 * their specific data changes.
 */
@Component({
  selector: 'app-page',
  templateUrl: './page.component.html',
  styleUrls: ['./page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageComponent implements OnInit {
  // ============================================
  // INPUTS
  // ============================================
  
  /**
   * Legacy input: full page object
   * @deprecated Use pageId for better performance
   */
  @Input() page?: PageModel;
  
  /**
   * New input: page ID for granular selection
   */
  @Input() pageId?: string;
  
  @Input({ required: true }) pageSize!: PageSize;
  @Input({ required: true }) subsectionId!: string;
  @Input() isActive = false;

  // ============================================
  // SERVICES
  // ============================================
  
  private readonly store = inject(Store<AppState>);
  private readonly documentService = inject(DocumentService);

  @HostBinding('class.page') hostClass = true;

  // ============================================
  // STATE
  // ============================================
  
  /**
   * Widget IDs for this page - from granular selector
   * This array only changes when widgets are added/removed,
   * NOT when widget content changes
   */
  private readonly _widgetIds = signal<string[]>([]);
  
  /**
   * Page data from store (for pageId input)
   */
  private readonly _pageData = signal<PageModel | null>(null);

  // ============================================
  // COMPUTED PROPERTIES
  // ============================================
  
  /**
   * Get the effective page data (from input or store)
   */
  get effectivePage(): PageModel | null {
    return this.page || this._pageData();
  }
  
  /**
   * Get widget IDs for iteration
   * Uses store selector when available, falls back to legacy page input
   */
  get widgetIds(): string[] {
    // Prefer granular selector IDs
    if (this._widgetIds().length > 0) {
      return this._widgetIds();
    }
    // Fall back to legacy page object
    return this.effectivePage?.widgets?.map(w => w.id) ?? [];
  }
  
  /**
   * Check if we should use the legacy widget input mode
   * (for backward compatibility during migration)
   */
  get useLegacyMode(): boolean {
    return !!this.page && this._widgetIds().length === 0;
  }
  
  /**
   * Get widgets for legacy mode
   */
  get legacyWidgets(): any[] {
    return this.page?.widgets ?? [];
  }

  get widthPx(): number {
    return this.convertMmToPx(this.getOrientedSize().widthMm);
  }

  get heightPx(): number {
    return this.convertMmToPx(this.getOrientedSize().heightMm);
  }

  get surfaceId(): string {
    const id = this.pageId || this.page?.id || 'unknown';
    return `page-surface-${id}`;
  }

  get surfaceSelector(): string {
    return `#${this.surfaceId}`;
  }

  get displayLogoUrl(): string {
    const logo = this.documentService.document.logo;
    return logo?.url || '/assets/logo.png';
  }

  get footerLeftText(): string | undefined {
    return this.documentService.document.footer?.leftText;
  }

  get footerCenterText(): string | undefined {
    return this.documentService.document.footer?.centerText;
  }

  get footerSubText(): string | undefined {
    return this.documentService.document.footer?.centerSubText;
  }

  get showPageNumber(): boolean {
    return this.documentService.document.footer?.showPageNumber !== false;
  }
  
  get pageNumber(): number {
    return this.effectivePage?.number ?? 1;
  }
  
  get pageOrientation(): 'portrait' | 'landscape' {
    return this.effectivePage?.orientation || 'landscape';
  }

  // ============================================
  // LIFECYCLE
  // ============================================
  
  ngOnInit(): void {
    // Subscribe to widget IDs using granular selector
    const effectivePageId = this.pageId || this.page?.id;
    if (effectivePageId) {
      this.store.select(DocumentSelectors.selectWidgetIdsForPage(effectivePageId))
        .subscribe(ids => {
          this._widgetIds.set(ids);
        });
        
      // Also subscribe to page data if using pageId input
      if (this.pageId) {
        this.store.select(DocumentSelectors.selectPageById(this.pageId))
          .subscribe(pageData => {
            if (pageData) {
              this._pageData.set({
                id: pageData.id,
                number: pageData.number,
                title: pageData.title,
                background: pageData.background,
                orientation: pageData.orientation,
                widgets: [], // Widgets are loaded separately via IDs
              });
            }
          });
      }
    }
  }

  // ============================================
  // TRACK BY
  // ============================================
  
  trackByWidgetId(index: number, widgetOrId: any): string {
    // Handle both widget objects (legacy) and widget IDs (new)
    return typeof widgetOrId === 'string' ? widgetOrId : widgetOrId.id;
  }

  // ============================================
  // HELPERS
  // ============================================
  
  private convertMmToPx(mm: number): number {
    const dpi = this.pageSize.dpi ?? 96;
    const inches = mm / 25.4;
    return Math.round(inches * dpi);
  }

  private getOrientedSize(): { widthMm: number; heightMm: number } {
    const { widthMm, heightMm } = this.pageSize;
    const orientation = this.pageOrientation;

    if (orientation === 'portrait') {
      if (widthMm > heightMm) {
        return { widthMm: heightMm, heightMm: widthMm };
      }
      return { widthMm, heightMm };
    }

    if (heightMm > widthMm) {
      return { widthMm: heightMm, heightMm: widthMm };
    }
    return { widthMm, heightMm };
  }
}
