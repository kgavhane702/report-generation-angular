import {
  ChangeDetectionStrategy,
  Component,
  HostBinding,
  HostListener,
  Input,
  OnInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { Subscription } from 'rxjs';

import { PageSize } from '../../../models/document.model';
import { EditorStateService } from '../../../core/services/editor-state.service';
import { UIStateService } from '../../../core/services/ui-state.service';
import { AppState } from '../../../store/app.state';
import { DocumentSelectors } from '../../../store/document/document.selectors';
import { PageEntity, WidgetEntity } from '../../../store/document/document.state';
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
  private readonly uiState = inject(UIStateService);
  private readonly widgetEntitiesSignal = toSignal(
    this.store.select(DocumentSelectors.selectWidgetEntities),
    { initialValue: {} as Record<string, WidgetEntity> }
  );

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
  // DRAG SELECTION
  // ============================================

  private selectionPointerId: number | null = null;
  private selectionStart: { x: number; y: number } | null = null;
  private selectionEnd: { x: number; y: number } | null = null;
  private selectionAdditive = false;
  private selectionBase = new Set<string>();
  private lastSelectionIds: string[] = [];
  private readonly _selectionRect = signal<{ x: number; y: number; width: number; height: number } | null>(null);
  readonly selectionRect = this._selectionRect.asReadonly();

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
  // DRAG SELECTION HANDLERS
  // ============================================

  onSurfacePointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;

    if (this.uiState.isInteracting()) return;

    const target = event.target as HTMLElement | null;
    if (target?.closest('.widget-container')) return;
    if (target?.closest('.context-menu')) return;

    const surface = this.getSurfaceElement();
    if (!surface) return;

    const zoom = Math.max(0.1, this.uiState.zoomLevel() / 100);
    const rect = surface.getBoundingClientRect();
    const x = Math.max(0, Math.min(this.widthPx, (event.clientX - rect.left) / zoom));
    const y = Math.max(0, Math.min(this.heightPx, (event.clientY - rect.top) / zoom));

    this.selectionPointerId = event.pointerId;
    this.selectionStart = { x, y };
    this.selectionEnd = { x, y };
    this.selectionAdditive = event.shiftKey || event.ctrlKey || event.metaKey;
    this.selectionBase = this.selectionAdditive ? new Set(this.uiState.selectedWidgetIds()) : new Set();
    this.lastSelectionIds = [];

    // While drag-selecting, nothing should appear selected.
    this.uiState.clearSelection();
    this.uiState.startDragSelection();

    this._selectionRect.set({ x, y, width: 0, height: 0 });

    event.preventDefault();
    event.stopPropagation();
  }

  @HostListener('document:pointermove', ['$event'])
  onSurfacePointerMove(event: PointerEvent): void {
    if (this.selectionPointerId == null || event.pointerId !== this.selectionPointerId) return;
    if (!this.selectionStart) return;

    // Prevent default browser behavior (text selection, scrolling, etc.)
    event.preventDefault();

    const surface = this.getSurfaceElement();
    if (!surface) return;

    const zoom = Math.max(0.1, this.uiState.zoomLevel() / 100);
    const rect = surface.getBoundingClientRect();
    const x = Math.max(0, Math.min(this.widthPx, (event.clientX - rect.left) / zoom));
    const y = Math.max(0, Math.min(this.heightPx, (event.clientY - rect.top) / zoom));

    this.selectionEnd = { x, y };

    const x1 = Math.min(this.selectionStart.x, x);
    const y1 = Math.min(this.selectionStart.y, y);
    const x2 = Math.max(this.selectionStart.x, x);
    const y2 = Math.max(this.selectionStart.y, y);

    this._selectionRect.set({ x: x1, y: y1, width: x2 - x1, height: y2 - y1 });

    const entities = this.widgetEntitiesSignal();
    const selected = new Set<string>();
    for (const id of this.widgetIds()) {
      const widget = entities[id];
      if (!widget) continue;
      const left = widget.position.x;
      const top = widget.position.y;
      const right = left + widget.size.width;
      const bottom = top + widget.size.height;

      const intersects = right >= x1 && left <= x2 && bottom >= y1 && top <= y2;
      if (intersects) {
        selected.add(id);
      }
    }

    const combined = new Set(this.selectionBase);
    selected.forEach(id => combined.add(id));
    const nextIds = Array.from(combined);

    // Track potential selection, but do not apply it until pointer up.
    const selectionChanged =
      nextIds.length !== this.lastSelectionIds.length ||
      nextIds.some((id, i) => id !== this.lastSelectionIds[i]);

    if (selectionChanged) {
      this.lastSelectionIds = nextIds;
    }
  }

  @HostListener('document:pointerup', ['$event'])
  onSurfacePointerUp(event: PointerEvent): void {
    if (this.selectionPointerId == null || event.pointerId !== this.selectionPointerId) return;

    const start = this.selectionStart;
    const end = this.selectionEnd;

    this.selectionPointerId = null;
    this.selectionStart = null;
    this.selectionEnd = null;
    this._selectionRect.set(null);
    this.uiState.stopDragSelection();

    if (!start || !end) {
      return;
    }

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 2 && !this.selectionAdditive) {
      this.uiState.clearSelection();
      return;
    }

    if (this.lastSelectionIds.length === 0) {
      this.uiState.clearSelection();
      return;
    }

    this.uiState.selectMultiple(this.lastSelectionIds);
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

  private getSurfaceElement(): HTMLElement | null {
    return document.getElementById(this.surfaceId) as HTMLElement | null;
  }
  
  // Note: sizing logic is centralized in `getOrientedPageSizeMm` to match backend export.
}
