import {
  ChangeDetectionStrategy,
  Component,
  HostBinding,
  Input,
  OnInit,
  OnDestroy,
  inject,
  signal,
} from '@angular/core';
import { Store } from '@ngrx/store';
import { Subscription } from 'rxjs';

import { PageSize } from '../../../models/document.model';
import { DocumentService } from '../../../core/services/document.service';
import { AppState } from '../../../store/app.state';
import { DocumentSelectors } from '../../../store/document/document.selectors';
import { PageEntity } from '../../../store/document/document.state';

/**
 * PageComponent
 * 
 * FIXED: Now uses pageId + granular selectors exclusively.
 * 
 * Before: [page]="page" → new object on any widget change → all widgets re-render
 * After: [pageId]="pageId" → stable string → page selects its own data
 */
@Component({
  selector: 'app-page',
  templateUrl: './page.component.html',
  styleUrls: ['./page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageComponent implements OnInit, OnDestroy {
  // ============================================
  // INPUTS
  // ============================================
  
  /**
   * Page ID - the component selects its own data using this ID
   */
  @Input({ required: true }) pageId!: string;
  
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
  // STATE (from granular selectors)
  // ============================================
  
  /**
   * Widget IDs for this page - STABLE reference
   * Only changes when widgets are added/removed, NOT when widget content changes
   */
  private readonly _widgetIds = signal<string[]>([]);
  readonly widgetIds = this._widgetIds.asReadonly();
  
  /**
   * Page data from granular selector
   * Only changes when THIS page's metadata changes, not other pages/widgets
   */
  private readonly _pageData = signal<PageEntity | null>(null);

  /**
   * Subscriptions
   */
  private widgetIdsSubscription?: Subscription;
  private pageDataSubscription?: Subscription;

  // ============================================
  // COMPUTED PROPERTIES
  // ============================================

  get widthPx(): number {
    return this.convertMmToPx(this.getOrientedSize().widthMm);
  }

  get heightPx(): number {
    return this.convertMmToPx(this.getOrientedSize().heightMm);
  }

  get surfaceId(): string {
    return `page-surface-${this.pageId}`;
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
    return this._pageData()?.number ?? 1;
  }
  
  get pageOrientation(): 'portrait' | 'landscape' {
    return this._pageData()?.orientation || 'landscape';
  }

  // ============================================
  // LIFECYCLE
  // ============================================
  
  ngOnInit(): void {
    // Subscribe to widget IDs using granular selector
    // This only emits when widgets are added/removed from this page
    this.widgetIdsSubscription = this.store
      .select(DocumentSelectors.selectWidgetIdsForPage(this.pageId))
      .subscribe(ids => {
        this._widgetIds.set(ids);
      });
      
    // Subscribe to page data using granular selector
    // This only emits when this page's metadata changes
    this.pageDataSubscription = this.store
      .select(DocumentSelectors.selectPageById(this.pageId))
      .subscribe(pageData => {
        this._pageData.set(pageData);
      });
  }
  
  ngOnDestroy(): void {
    this.widgetIdsSubscription?.unsubscribe();
    this.pageDataSubscription?.unsubscribe();
  }

  // ============================================
  // TRACK BY
  // ============================================
  
  trackByWidgetId(index: number, widgetId: string): string {
    return widgetId;
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
