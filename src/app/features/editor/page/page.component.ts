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

  get logoUrl(): string | undefined {
    return this.editorState.documentLogo()?.url;
  }

  get logoPosition(): LogoConfig['position'] {
    return this.editorState.documentLogo()?.position || 'top-right';
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
    return this._pageData()?.number ?? 1;
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
    this.subscribeToPage(newPageId);
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

  private subscribeToPage(pageId: string): void {
    this.widgetIdsSubscription?.unsubscribe();
    this.pageDataSubscription?.unsubscribe();

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
  }
  
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
