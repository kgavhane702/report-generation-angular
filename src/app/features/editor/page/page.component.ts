import {
  ChangeDetectionStrategy,
  Component,
  HostBinding,
  Input,
  OnInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import { Store } from '@ngrx/store';
import { Subscription } from 'rxjs';

import { PageSize } from '../../../models/document.model';
import { EditorStateService } from '../../../core/services/editor-state.service';
import { AppState } from '../../../store/app.state';
import { DocumentSelectors } from '../../../store/document/document.selectors';
import { PageEntity } from '../../../store/document/document.state';
import { formatPageNumber, PageNumberFormat } from '../../../core/utils/page-number-formatter.util';
import { LogoConfig } from '../../../models/document.model';
import { getOrientedPageSizeMm, mmToPx } from '../../../core/utils/page-dimensions.util';

/**
 * PageComponent
 * 
 * Uses pageId + granular selectors for optimal performance.
 * Each page selects its own data independently.
 */
@Component({
  selector: 'app-page',
  templateUrl: './page.component.html',
  styleUrls: ['./page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageComponent implements OnInit, OnDestroy, OnChanges {
  // ============================================
  // INPUTS
  // ============================================
  
  @Input({ required: true }) pageId!: string;
  @Input({ required: true }) pageSize!: PageSize;
  @Input({ required: true }) subsectionId!: string;
  @Input() isActive = false;

  // ============================================
  // SERVICES
  // ============================================
  
  private readonly store = inject(Store<AppState>);
  private readonly editorState = inject(EditorStateService);

  @HostBinding('class.page') hostClass = true;

  // ============================================
  // STATE (from granular selectors)
  // ============================================
  
  /**
   * Widget IDs for this page - STABLE reference
   */
  private readonly _widgetIds = signal<string[]>([]);
  readonly widgetIds = this._widgetIds.asReadonly();
  
  /**
   * Page data from granular selector
   */
  private readonly _pageData = signal<PageEntity | null>(null);
  
  /**
   * Global sequential page number (1-based) derived from document order
   */
  private readonly _globalPageNumber = signal<number>(1);

  /**
   * Subscriptions
   */
  private widgetIdsSubscription?: Subscription;
  private pageDataSubscription?: Subscription;
  private pageNumberSubscription?: Subscription;

  // ============================================
  // COMPUTED PROPERTIES
  // ============================================

  get widthPx(): number {
    const { widthMm } = getOrientedPageSizeMm(this.pageSize, this.pageOrientation);
    return mmToPx(widthMm, this.pageSize.dpi ?? 96);
  }

  get heightPx(): number {
    const { heightMm } = getOrientedPageSizeMm(this.pageSize, this.pageOrientation);
    return mmToPx(heightMm, this.pageSize.dpi ?? 96);
  }

  get surfaceId(): string {
    return `page-surface-${this.pageId}`;
  }

  get surfaceSelector(): string {
    return `#${this.surfaceId}`;
  }

  get logoUrl(): string | undefined {
    return this.editorState.documentLogo()?.url;
  }

  get logoPosition(): LogoConfig['position'] {
    return this.editorState.documentLogo()?.position || 'top-right';
  }

  get logoMaxWidthPx(): number | undefined {
    return this.editorState.documentLogo()?.maxWidthPx;
  }

  get logoMaxHeightPx(): number | undefined {
    return this.editorState.documentLogo()?.maxHeightPx;
  }

  get footerLeftText(): string | undefined {
    return this.editorState.documentFooter()?.leftText;
  }

  get footerCenterText(): string | undefined {
    return this.editorState.documentFooter()?.centerText;
  }

  get footerCenterSubText(): string | undefined {
    return this.editorState.documentFooter()?.centerSubText;
  }

  get footerLeftImage(): string | undefined {
    return this.editorState.documentFooter()?.leftImage;
  }

  get footerCenterImage(): string | undefined {
    return this.editorState.documentFooter()?.centerImage;
  }

  get footerRightImage(): string | undefined {
    return this.editorState.documentFooter()?.rightImage;
  }

  get footerTextColor(): string {
    return this.editorState.documentFooter()?.textColor || '#000000';
  }

  // Per-position footer text colors (fallback to global textColor, then to black)
  get footerLeftTextColor(): string {
    const footer = this.editorState.documentFooter();
    return footer?.leftTextColor || footer?.textColor || '#000000';
  }

  get footerCenterTextColor(): string {
    const footer = this.editorState.documentFooter();
    return footer?.centerTextColor || footer?.textColor || '#000000';
  }

  get footerRightTextColor(): string {
    const footer = this.editorState.documentFooter();
    return footer?.rightTextColor || footer?.textColor || '#000000';
  }

  get headerLeftText(): string | undefined {
    return this.editorState.documentHeader()?.leftText;
  }

  get headerCenterText(): string | undefined {
    return this.editorState.documentHeader()?.centerText;
  }

  get headerRightText(): string | undefined {
    return this.editorState.documentHeader()?.rightText;
  }

  get headerLeftImage(): string | undefined {
    return this.editorState.documentHeader()?.leftImage;
  }

  get headerCenterImage(): string | undefined {
    return this.editorState.documentHeader()?.centerImage;
  }

  get headerRightImage(): string | undefined {
    return this.editorState.documentHeader()?.rightImage;
  }

  get headerTextColor(): string {
    return this.editorState.documentHeader()?.textColor || '#000000';
  }

  // Per-position header text colors (fallback to global textColor, then to black)
  get headerLeftTextColor(): string {
    const header = this.editorState.documentHeader();
    return header?.leftTextColor || header?.textColor || '#000000';
  }

  get headerCenterTextColor(): string {
    const header = this.editorState.documentHeader();
    return header?.centerTextColor || header?.textColor || '#000000';
  }

  get headerRightTextColor(): string {
    const header = this.editorState.documentHeader();
    return header?.rightTextColor || header?.textColor || '#000000';
  }

  get headerShowPageNumber(): boolean {
    return this.editorState.documentHeader()?.showPageNumber || false;
  }

  get headerPageNumberFormat(): PageNumberFormat {
    return this.editorState.documentHeader()?.pageNumberFormat || 'arabic';
  }

  get showPageNumber(): boolean {
    return this.editorState.documentFooter()?.showPageNumber !== false;
  }

  get footerPageNumberFormat(): PageNumberFormat {
    return this.editorState.documentFooter()?.pageNumberFormat || 'arabic';
  }
  
  get pageNumber(): number {
    return this._globalPageNumber();
  }

  get formattedPageNumber(): string {
    const num = this.pageNumber;
    if (this.showPageNumber) {
      return formatPageNumber(num, this.footerPageNumberFormat);
    }
    if (this.headerShowPageNumber) {
      return formatPageNumber(num, this.headerPageNumberFormat);
    }
    return num.toString();
  }

  get formattedHeaderPageNumber(): string {
    if (!this.headerShowPageNumber) return '';
    return formatPageNumber(this.pageNumber, this.headerPageNumberFormat);
  }
  
  get pageOrientation(): 'portrait' | 'landscape' {
    return this._pageData()?.orientation || 'landscape';
  }

  // ============================================
  // LIFECYCLE
  // ============================================
  
  ngOnInit(): void {
    this.subscribeToPage(this.pageId);
  }

  ngOnChanges(changes: SimpleChanges): void {
    const pageIdChange = changes['pageId'];
    if (!pageIdChange) return;

    // When the canvas switches the active page, the same PageComponent instance
    // is reused with a different pageId input. We must resubscribe selectors
    // so the component reads the correct page + widget IDs.
    const newPageId = pageIdChange.currentValue as string | undefined;
    if (!newPageId) return;

    // Avoid doing work on the initial binding (ngOnInit handles that)
    if (pageIdChange.firstChange) return;

    this._widgetIds.set([]);
    this._pageData.set(null);
    this._globalPageNumber.set(1);
    this.subscribeToPage(newPageId);
  }
  
  ngOnDestroy(): void {
    this.widgetIdsSubscription?.unsubscribe();
    this.pageDataSubscription?.unsubscribe();
    this.pageNumberSubscription?.unsubscribe();
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

  private subscribeToPage(pageId: string): void {
    this.widgetIdsSubscription?.unsubscribe();
    this.pageDataSubscription?.unsubscribe();
    this.pageNumberSubscription?.unsubscribe();

    // Subscribe to widget IDs using granular selector
    this.widgetIdsSubscription = this.store
      .select(DocumentSelectors.selectWidgetIdsForPage(pageId))
      .subscribe((ids) => {
        this._widgetIds.set(ids);
      });

    // Subscribe to page data using granular selector
    this.pageDataSubscription = this.store
      .select(DocumentSelectors.selectPageById(pageId))
      .subscribe((pageData) => {
        this._pageData.set(pageData);
      });

    // Subscribe to global sequential page number
    this.pageNumberSubscription = this.store
      .select(DocumentSelectors.selectGlobalPageNumberForPage(pageId))
      .subscribe((num) => {
        this._globalPageNumber.set(num);
      });
  }
  
  // Note: sizing logic is centralized in `getOrientedPageSizeMm` to match backend export.
}
