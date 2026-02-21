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
import { SlideDesignService } from '../../../core/slide-design/slide-design.service';
import { DocumentService } from '../../../core/services/document.service';
import { WidgetFactoryService } from '../widget-host/widget-factory.service';
import { ConnectorAnchorService } from '../../../core/services/connector-anchor.service';
import type { ConnectorAnchorAttachment, ConnectorWidgetProps } from '../../../models/widget.model';
import {
  getShapeRenderType,
  getShapeSvgPath,
  getShapeSvgViewBox,
  isStrokeOnlyShape,
} from '../plugins/object/config';
import type { GraphCommandTransaction } from '../../../core/graph/models/graph-transaction.model';
import { computeElbowPoints, getAttachmentDirection } from '../../../core/geometry/connector-elbow-routing';

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
  private static readonly INSERTION_CONNECTOR_PREVIEW_ID = '__insertion-preview-connector__';
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
  private readonly slideDesign = inject(SlideDesignService);
  private readonly documentService = inject(DocumentService);
  private readonly widgetFactory = inject(WidgetFactoryService);
  private readonly connectorAnchorService = inject(ConnectorAnchorService);
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

  private insertionPointerId: number | null = null;
  private insertionStart: { x: number; y: number } | null = null;
  private insertionEnd: { x: number; y: number } | null = null;
  private insertionStartSnap: { point: { x: number; y: number }; attachment: ConnectorAnchorAttachment | null } | null = null;
  private insertionEndSnap: { point: { x: number; y: number }; attachment: ConnectorAnchorAttachment | null } | null = null;
  private readonly _insertionRect = signal<{ x: number; y: number; width: number; height: number } | null>(null);
  readonly insertionRect = this._insertionRect.asReadonly();

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
    return this.editorState.documentFooter()?.textColor || this.themeForegroundColor;
  }

  // Per-position footer text colors (fallback to global textColor, then to black)
  get footerLeftTextColor(): string {
    const footer = this.editorState.documentFooter();
    return footer?.leftTextColor || footer?.textColor || this.themeForegroundColor;
  }

  get footerCenterTextColor(): string {
    const footer = this.editorState.documentFooter();
    return footer?.centerTextColor || footer?.textColor || this.themeForegroundColor;
  }

  get footerRightTextColor(): string {
    const footer = this.editorState.documentFooter();
    return footer?.rightTextColor || footer?.textColor || this.themeForegroundColor;
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
    return this.editorState.documentHeader()?.textColor || this.themeForegroundColor;
  }

  // Per-position header text colors (fallback to global textColor, then to black)
  get headerLeftTextColor(): string {
    const header = this.editorState.documentHeader();
    return header?.leftTextColor || header?.textColor || this.themeForegroundColor;
  }

  get headerCenterTextColor(): string {
    const header = this.editorState.documentHeader();
    return header?.centerTextColor || header?.textColor || this.themeForegroundColor;
  }

  get headerRightTextColor(): string {
    const header = this.editorState.documentHeader();
    return header?.rightTextColor || header?.textColor || this.themeForegroundColor;
  }

  private get themeForegroundColor(): string {
    const layout = this._pageData()?.slideLayoutType ?? this.slideDesign.defaultLayoutType();
    return this.slideDesign.resolveVariant(layout).surfaceForeground || '#0f172a';
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

  get pageSurfaceStyle(): Record<string, string> {
    return this.slideDesign.getPageSurfaceStyle(this._pageData());
  }

  get pageThemeClasses(): string[] {
    const page = this._pageData();
    const layout = page?.slideLayoutType ?? this.slideDesign.defaultLayoutType();
    const variantId = (page?.slideVariantId?.trim() || this.slideDesign.resolveVariantId(layout)).toLowerCase();
    const themeId = this.slideDesign.activeThemeId().replace(/_/g, '-');
    return [
      `theme-${themeId}`,
      `variant-${variantId}`,
      `layout-${layout.replace(/_/g, '-')}`,
    ];
  }

  get insertionModeArmed(): boolean {
    return this.uiState.insertionArmed();
  }

  get insertionModeDrawing(): boolean {
    return this.uiState.drawingInsertion();
  }

  get insertionModeWidgetType(): 'object' | 'connector' | null {
    return this.uiState.insertionMode()?.widgetType ?? null;
  }

  get insertionPreviewShapeType(): string {
    return this.uiState.insertionMode()?.shapeType || 'rectangle';
  }

  get insertionPreviewIsCssShape(): boolean {
    return getShapeRenderType(this.insertionPreviewShapeType) === 'css';
  }

  get insertionPreviewIsSvgShape(): boolean {
    return getShapeRenderType(this.insertionPreviewShapeType) === 'svg';
  }

  get insertionPreviewCssClass(): string {
    const type = this.insertionPreviewShapeType;
    if (type === 'circle' || type === 'ellipse') return 'page__insertion-shape--circle';
    if (type === 'rounded-rectangle') return 'page__insertion-shape--rounded';
    return 'page__insertion-shape--rectangle';
  }

  get insertionPreviewSvgPath(): string {
    return getShapeSvgPath(this.insertionPreviewShapeType);
  }

  get insertionPreviewSvgViewBox(): string {
    return getShapeSvgViewBox(this.insertionPreviewShapeType);
  }

  get insertionPreviewSvgStrokeOnly(): boolean {
    return isStrokeOnlyShape(this.insertionPreviewShapeType);
  }

  get insertionPreviewConnectorLine(): { x1: number; y1: number; x2: number; y2: number } | null {
    if (this.insertionModeWidgetType !== 'connector') return null;
    const start = this.insertionStartSnap?.point ?? this.insertionStart;
    const end = this.insertionEndSnap?.point ?? this.insertionEnd;
    if (!start || !end) return null;
    return {
      x1: start.x,
      y1: start.y,
      x2: end.x,
      y2: end.y,
    };
  }

  get insertionPreviewConnectorPath(): string | null {
    const endpoints = this.insertionPreviewConnectorLine;
    if (!endpoints) return null;

    const start = { x: endpoints.x1, y: endpoints.y1 };
    const end = { x: endpoints.x2, y: endpoints.y2 };
    const shapeType = (this.uiState.insertionMode()?.shapeType || 'line').toLowerCase();

    if (shapeType.includes('elbow')) {
      const points = computeElbowPoints({
        start,
        end,
        control: { x: start.x, y: end.y },
        startAttachment: this.insertionStartSnap?.attachment
          ? { ...this.insertionStartSnap.attachment, dir: getAttachmentDirection(this.insertionStartSnap.attachment) ?? undefined }
          : undefined,
        endAttachment: this.insertionEndSnap?.attachment
          ? { ...this.insertionEndSnap.attachment, dir: getAttachmentDirection(this.insertionEndSnap.attachment) ?? undefined }
          : undefined,
        stub: 30,
      });

      let path = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        path += ` L ${points[i].x} ${points[i].y}`;
      }
      if (shapeType.includes('arrow') && points.length >= 2) {
        const prev = points[points.length - 2];
        path += this.buildArrowPath(prev, end, end);
      }
      return path;
    }

    if (shapeType.includes('curved')) {
      const control = {
        x: (start.x + end.x) / 2,
        y: (start.y + end.y) / 2 - 50,
      };
      let path = `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`;
      if (shapeType.includes('arrow')) {
        path += this.buildArrowPath(control, end, end);
      }
      return path;
    }

    if (shapeType.startsWith('s-')) {
      const control1 = {
        x: start.x + (end.x - start.x) * 0.3,
        y: start.y,
      };
      const control2 = {
        x: start.x + (end.x - start.x) * 0.7,
        y: end.y,
      };
      let path = `M ${start.x} ${start.y} C ${control1.x} ${control1.y} ${control2.x} ${control2.y} ${end.x} ${end.y}`;
      if (shapeType.includes('arrow')) {
        path += this.buildArrowPath(control2, end, end);
      }
      return path;
    }

    let path = `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
    if (shapeType.includes('arrow-double')) {
      path += this.buildArrowPath(end, start, start);
      path += this.buildArrowPath(start, end, end);
      return path;
    }
    if (shapeType.includes('arrow')) {
      path += this.buildArrowPath(start, end, end);
    }
    return path;
  }

  private buildArrowPath(from: { x: number; y: number }, to: { x: number; y: number }, tip: { x: number; y: number }): string {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-3) return '';

    const angle = Math.atan2(dy, dx);
    const arrowLength = Math.min(10, len * 0.8);
    const arrowAngle = Math.PI / 6;

    const x1 = tip.x - arrowLength * Math.cos(angle - arrowAngle);
    const y1 = tip.y - arrowLength * Math.sin(angle - arrowAngle);
    const x2 = tip.x - arrowLength * Math.cos(angle + arrowAngle);
    const y2 = tip.y - arrowLength * Math.sin(angle + arrowAngle);

    return ` M ${x1} ${y1} L ${tip.x} ${tip.y} L ${x2} ${y2}`;
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
    this.cancelInsertionGesture();
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

    if (this.tryStartInsertion(event)) {
      return;
    }

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
    const insertionMode = this.uiState.insertionMode();
    if (
      this.insertionPointerId == null &&
      this.selectionPointerId == null &&
      insertionMode?.widgetType === 'connector'
    ) {
      const hoverPoint = this.getSurfacePoint(event);
      if (hoverPoint) {
        this.uiState.startDraggingConnectorEndpoint(PageComponent.INSERTION_CONNECTOR_PREVIEW_ID, 'end');
        this.uiState.updateConnectorEndpointDragPosition(hoverPoint.x, hoverPoint.y);
      }
    }

    if (this.insertionPointerId != null && event.pointerId === this.insertionPointerId) {
      this.updateInsertionGesture(event);
      return;
    }

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
    if (this.insertionPointerId != null && event.pointerId === this.insertionPointerId) {
      this.finishInsertionGesture();
      return;
    }

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

  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: Event): void {
    if (!this.uiState.insertionArmed() && !this.uiState.drawingInsertion()) {
      return;
    }

    this.cancelInsertionGesture();
    this.uiState.clearInsertionMode();
    event.preventDefault();
    event.stopPropagation();
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

  private tryStartInsertion(event: PointerEvent): boolean {
    const insertionMode = this.uiState.insertionMode();
    if (!insertionMode) {
      return false;
    }

    if (this.uiState.isInteracting()) {
      return true;
    }

    const target = event.target as HTMLElement | null;
    if (target?.closest('.widget-container') || target?.closest('.context-menu')) {
      return true;
    }

    const point = this.getSurfacePoint(event);
    if (!point) {
      return true;
    }

    this.insertionPointerId = event.pointerId;
    this.insertionStart = point;
    this.insertionEnd = point;
    this.uiState.clearSelection();
    this.uiState.startInsertionDrawing();

    if (insertionMode.widgetType === 'connector') {
      this.insertionStartSnap = this.resolveNearestAnchor(point);
      this.insertionEndSnap = this.insertionStartSnap;
      const frame = this.buildConnectorFrame(this.insertionStartSnap.point, this.insertionEndSnap.point);
      this._insertionRect.set(frame);
      this.uiState.startDraggingConnectorEndpoint(PageComponent.INSERTION_CONNECTOR_PREVIEW_ID, 'end');
      this.uiState.updateConnectorEndpointDragPosition(this.insertionEndSnap.point.x, this.insertionEndSnap.point.y);
    } else {
      const frame = this.buildObjectFrame(point, point);
      this._insertionRect.set(frame);
    }

    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  private updateInsertionGesture(event: PointerEvent): void {
    event.preventDefault();

    if (!this.insertionStart) {
      return;
    }

    const insertionMode = this.uiState.insertionMode();
    if (!insertionMode) {
      this.cancelInsertionGesture();
      return;
    }

    const point = this.getSurfacePoint(event);
    if (!point) {
      return;
    }

    this.insertionEnd = point;

    if (insertionMode.widgetType === 'connector') {
      const startSnap = this.insertionStartSnap ?? this.resolveNearestAnchor(this.insertionStart);
      const endSnap = this.resolveNearestAnchor(point);
      this.insertionStartSnap = startSnap;
      this.insertionEndSnap = endSnap;
      this._insertionRect.set(this.buildConnectorFrame(startSnap.point, endSnap.point));
      this.uiState.updateConnectorEndpointDragPosition(endSnap.point.x, endSnap.point.y);
      return;
    }

    this._insertionRect.set(this.buildObjectFrame(this.insertionStart, point));
  }

  private finishInsertionGesture(): void {
    const insertionMode = this.uiState.insertionMode();
    const start = this.insertionStart;
    const end = this.insertionEnd;

    this.insertionPointerId = null;
    this.uiState.stopInsertionDrawing();
    this._insertionRect.set(null);
    this.uiState.stopDraggingConnectorEndpoint();

    if (!insertionMode || !start || !end) {
      this.cancelInsertionGesture();
      return;
    }

    const pageId = this.pageId;
    let createdWidgetId: string | null = null;

    if (insertionMode.widgetType === 'connector') {
      const startSnap = this.insertionStartSnap ?? this.resolveNearestAnchor(start);
      const endSnap = this.insertionEndSnap ?? this.resolveNearestAnchor(end);

      const dx = endSnap.point.x - startSnap.point.x;
      const dy = endSnap.point.y - startSnap.point.y;
      if (Math.hypot(dx, dy) < 6) {
        this.resetInsertionDraftState();
        return;
      }

      const frame = this.buildConnectorFrame(startSnap.point, endSnap.point);
      const widget = this.widgetFactory.createWidget('connector', {
        shapeType: insertionMode.shapeType,
      } as any);

      widget.position = { x: frame.x, y: frame.y };
      widget.size = { width: frame.width, height: frame.height };

      const props = widget.props as ConnectorWidgetProps;
      props.startPoint = {
        x: startSnap.point.x - frame.x,
        y: startSnap.point.y - frame.y,
      };
      props.endPoint = {
        x: endSnap.point.x - frame.x,
        y: endSnap.point.y - frame.y,
      };
      props.startAttachment = startSnap.attachment ?? undefined;
      props.endAttachment = endSnap.attachment ?? undefined;

      const graphTransaction: GraphCommandTransaction = {
        kind: 'widget-update',
        touchedWidgetIds: [widget.id],
        beforeEdges: [
          {
            connectorWidgetId: widget.id,
            fromWidgetId: null,
            toWidgetId: null,
          },
        ],
        afterEdges: [
          {
            connectorWidgetId: widget.id,
            fromWidgetId: props.startAttachment?.widgetId ?? null,
            toWidgetId: props.endAttachment?.widgetId ?? null,
            ...(props.startAttachment?.anchor ? { fromAnchor: props.startAttachment.anchor } : {}),
            ...(props.endAttachment?.anchor ? { toAnchor: props.endAttachment.anchor } : {}),
          },
        ],
      };

      this.documentService.addWidget(pageId, widget, { graphTransaction });
      createdWidgetId = widget.id;
    } else {
      const frame = this.buildObjectFrame(start, end);
      const widget = this.widgetFactory.createWidget('object', {
        shapeType: insertionMode.shapeType,
        fillColor: insertionMode.defaultFillColor ?? '',
        borderRadius: insertionMode.borderRadius,
      } as any);

      widget.position = { x: frame.x, y: frame.y };
      widget.size = { width: frame.width, height: frame.height };

      this.documentService.addWidget(pageId, widget);
      createdWidgetId = widget.id;
    }

    this.resetInsertionDraftState();

    if (createdWidgetId) {
      this.editorState.setActiveWidget(createdWidgetId);
      this.uiState.clearInsertionMode();
    }
  }

  private getSurfacePoint(event: PointerEvent): { x: number; y: number } | null {
    const surface = this.getSurfaceElement();
    if (!surface) return null;

    const zoom = Math.max(0.1, this.uiState.zoomLevel() / 100);
    const rect = surface.getBoundingClientRect();
    const x = Math.max(0, Math.min(this.widthPx, (event.clientX - rect.left) / zoom));
    const y = Math.max(0, Math.min(this.heightPx, (event.clientY - rect.top) / zoom));
    return { x, y };
  }

  private buildObjectFrame(start: { x: number; y: number }, end: { x: number; y: number }): { x: number; y: number; width: number; height: number } {
    const minSize = 24;
    const dx = end.x - start.x;
    const dy = end.y - start.y;

    const width = Math.max(minSize, Math.abs(dx));
    const height = Math.max(minSize, Math.abs(dy));

    const x = dx >= 0 ? start.x : start.x - width;
    const y = dy >= 0 ? start.y : start.y - height;

    return {
      x: Math.max(0, Math.min(this.widthPx - width, x)),
      y: Math.max(0, Math.min(this.heightPx - height, y)),
      width,
      height,
    };
  }

  private buildConnectorFrame(start: { x: number; y: number }, end: { x: number; y: number }): { x: number; y: number; width: number; height: number } {
    const minSize = 2;
    const left = Math.min(start.x, end.x);
    const top = Math.min(start.y, end.y);
    const width = Math.max(minSize, Math.abs(end.x - start.x));
    const height = Math.max(minSize, Math.abs(end.y - start.y));
    return { x: left, y: top, width, height };
  }

  private resolveNearestAnchor(point: { x: number; y: number }): { point: { x: number; y: number }; attachment: ConnectorAnchorAttachment | null } {
    const nearest = this.connectorAnchorService.findNearestAnchor(this.pageId, point, '');
    if (!nearest) {
      return { point, attachment: null };
    }

    return {
      point: { x: nearest.x, y: nearest.y },
      attachment: {
        widgetId: nearest.widgetId,
        anchor: nearest.anchor,
        dir: nearest.dir,
      },
    };
  }

  private cancelInsertionGesture(): void {
    this.insertionPointerId = null;
    this.uiState.stopInsertionDrawing();
    this.uiState.stopDraggingConnectorEndpoint();
    this._insertionRect.set(null);
    this.resetInsertionDraftState();
  }

  private resetInsertionDraftState(): void {
    this.insertionStart = null;
    this.insertionEnd = null;
    this.insertionStartSnap = null;
    this.insertionEndSnap = null;
  }
  
  // Note: sizing logic is centralized in `getOrientedPageSizeMm` to match backend export.
}
