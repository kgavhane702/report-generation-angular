import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  Input,
  OnInit,
  OnDestroy,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { Subscription } from 'rxjs';
import { CdkDragEnd, CdkDragMove, CdkDragStart } from '@angular/cdk/drag-drop';

import { WidgetPosition, WidgetProps } from '../../../../models/widget.model';
import { PageSize } from '../../../../models/document.model';
import { DocumentService } from '../../../../core/services/document.service';
import { DraftStateService } from '../../../../core/services/draft-state.service';
import { UIStateService } from '../../../../core/services/ui-state.service';
import { GuidesService } from '../../../../core/services/guides.service';
import { RemoteWidgetAutoLoadService } from '../../../../core/services/remote-widget-auto-load.service';
import { UndoRedoService } from '../../../../core/services/undo-redo.service';
import { ConnectorAnchorService, AnchorAttachment } from '../../../../core/services/connector-anchor.service';
import { computeElbowPoints, getAnchorDirection, type AnchorDirection } from '../../../../core/geometry/connector-elbow-routing';
import { AppState } from '../../../../store/app.state';
import { DocumentSelectors } from '../../../../store/document/document.selectors';
import { WidgetEntity } from '../../../../store/document/document.state';
import { WidgetActions } from '../../../../store/document/document.actions';
import type { WidgetModel } from '../../../../models/widget.model';
import { getWidgetInteractionPolicy, isResizeHandleAllowed, type WidgetInteractionPolicy } from '../widget-interaction-policy';
import type { ContextMenuItem } from '../../../../shared/components/context-menu/context-menu.component';

type ResizeHandle = 'right' | 'bottom' | 'corner' | 'corner-top-right' | 'corner-top-left' | 'corner-bottom-left' | 'left' | 'top';

interface WidgetFrame {
  width: number;
  height: number;
  x: number;
  y: number;
}

/**
 * WidgetContainerComponent
 * 
 * FIXED: Now uses widgetId + granular selector exclusively.
 * 
 * Before: [widget]="widget" → new object on any doc change → all widgets re-render
 * After: [widgetId]="widgetId" → stable string → widget selects its own data
 * 
 * Key architecture:
 * - Granular selector only emits when THIS widget's data changes
 * - Other widgets changing does NOT trigger this component
 * - Draft state handles in-progress changes locally
 */
@Component({
  selector: 'app-widget-container',
  templateUrl: './widget-container.component.html',
  styleUrls: ['./widget-container.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetContainerComponent implements OnInit, OnDestroy {
  // ============================================
  // INPUTS
  // ============================================
  
  /**
   * Widget ID - the component selects its own data using this ID
   */
  @Input({ required: true }) widgetId!: string;
  
  /**
   * Page context for document operations
   */
  @Input({ required: true }) pageId!: string;
  @Input({ required: true }) subsectionId!: string;
  
  /**
   * Page dimensions for boundary calculations
   */
  @Input({ required: true }) pageSize!: PageSize;
  @Input({ required: true }) pageWidth!: number;
  @Input({ required: true }) pageHeight!: number;
  @Input() dragBoundarySelector = '';
  
  // ============================================
  // INJECTED SERVICES
  // ============================================
  
  private readonly store = inject(Store<AppState>);
  private readonly documentService = inject(DocumentService);
  private readonly draftState = inject(DraftStateService);
  protected readonly uiState = inject(UIStateService);
  private readonly guides = inject(GuidesService);
  private readonly remoteAutoLoad = inject(RemoteWidgetAutoLoadService);
  private readonly undoRedo = inject(UndoRedoService);
  private readonly hostRef = inject(ElementRef<HTMLElement>);
  private readonly connectorAnchorService = inject(ConnectorAnchorService);
  private readonly widgetEntitiesSignal = toSignal(
    this.store.select(DocumentSelectors.selectWidgetEntities),
    { initialValue: {} as Record<string, WidgetEntity> }
  );

  // ============================================
  // CONTEXT MENU
  // ============================================

  contextMenuOpen = false;
  contextMenuX: number | null = null;
  contextMenuY: number | null = null;

  get contextMenuItems(): ContextMenuItem[] {
    return [
      {
        id: 'delete',
        label: 'Delete',
        icon: 'trash',
        danger: true,
        disabled: this.isDocumentLocked,
      },
      {
        id: 'cut',
        label: 'Cut',
        icon: 'cut',
        disabled: this.isDocumentLocked,
      },
      {
        id: 'copy',
        label: 'Copy',
        icon: 'copy',
        disabled: false,
      },
      {
        id: 'paste',
        label: 'Paste',
        icon: 'paste',
        disabled: this.isDocumentLocked || !this.documentService.canPaste(),
      },
    ];
  }
  
  // ============================================
  // WIDGET DATA (GRANULAR SELECTOR)
  // ============================================
  
  /**
   * Signal containing the persisted widget data from the store
   * This ONLY updates when THIS specific widget changes in the store
   */
  private readonly persistedWidget = signal<WidgetEntity | null>(null);
  
  /**
   * Subscription to widget data
   */
  private widgetSubscription?: Subscription;
  private lastLayoutSignature: string | null = null;

  // Capture-phase guard: when document is locked, block pointer/click interactions that would
  // start edits (table resizers, text focus, etc.), while still allowing hover/mousemove for tooltips.
  private readonly handleLockedPointerDownCapture = (event: PointerEvent): void => {
    if (!this.isDocumentLocked) return;
    // Still allow selecting the widget for inspection/outline.
    if (!this.isSelected) {
      this.uiState.selectWidget(this.widgetId);
    }
    event.preventDefault();
    event.stopPropagation();
  };

  private readonly handleLockedClickCapture = (event: MouseEvent): void => {
    if (!this.isDocumentLocked) return;
    // Prevent click from triggering any widget-internal edit actions.
    event.preventDefault();
    event.stopPropagation();
  };

  private readonly handleLockedDblClickCapture = (event: MouseEvent): void => {
    if (!this.isDocumentLocked) return;
    // Prevent double-click handlers (e.g., chart config dialogs) while locked.
    event.preventDefault();
    event.stopPropagation();
  };
  
  /**
   * Computed signal that merges persisted data with any draft changes
   * This is what the template uses for rendering
   */
  readonly displayWidget = computed<WidgetEntity | null>(() => {
    const persisted = this.persistedWidget();
    if (!persisted) {
      return null;
    }
    
    // Merge with draft if exists (for in-progress resize/drag)
    return this.draftState.getMergedWidget(this.widgetId, persisted);
  });
  
  // ============================================
  // LOCAL UI STATE
  // ============================================
  
  private activeHandle: ResizeHandle | null = null;
  private dragStartFrame: WidgetFrame | null = null;
  private connectorStrokeDragAllowedForGesture: boolean | null = null;
  private multiDragState: {
    widgetIds: string[];
    startPositions: Map<string, { x: number; y: number }>;
  } | null = null;

  private connectorWholeDrag:
    | {
        pointerId: number;
        startPointer: { x: number; y: number };
        startPosition: { x: number; y: number };
      }
    | null = null;

  /**
   * CDK Drag works in screen px, but our canvas is zoomed via CSS `transform: scale(...)`.
   * Without compensating, drag will feel "too slow" when zoomed out and "too fast" when zoomed in.
   *
   * CDK 16 doesn't support `cdkDragScale`, so we constrain the computed transform position instead.
   */
  readonly constrainDragPosition = (
    userPointerPosition: { x: number; y: number },
    _dragRef: unknown,
    initialClientRect: ClientRect,
    pickupPositionInElement: { x: number; y: number }
  ): { x: number; y: number } => {
    const zoomScale = Math.max(0.1, this.uiState.zoomLevel() / 100);

    // Stroke-only drag for connector widgets.
    // We decide once per drag gesture (based on the pickup point inside the element)
    // and then either allow normal movement or freeze the widget in place.
    const widget = this.displayWidget();
    if (widget?.type === 'connector') {
      if (this.connectorStrokeDragAllowedForGesture === null) {
        const rectW = Math.max(1, (initialClientRect.width as number) || 1);
        const rectH = Math.max(1, (initialClientRect.height as number) || 1);
        const localX = (pickupPositionInElement.x / rectW) * widget.size.width;
        const localY = (pickupPositionInElement.y / rectH) * widget.size.height;
        this.connectorStrokeDragAllowedForGesture = this.isLocalPointNearConnectorStroke(
          { x: localX, y: localY },
          widget
        );
      }

      if (!this.connectorStrokeDragAllowedForGesture) {
        return { x: initialClientRect.left, y: initialClientRect.top };
      }
    }

    // CDK expects that when `constrainPosition` is provided, we return the *desired top/left*
    // (page coords) for the draggable preview/root element.
    //
    // We want the visual movement (after parent scale) to match the mouse delta.
    // Because parent scaling multiplies the drag transform by `zoomScale`, we must divide the
    // pointer delta by `zoomScale` before CDK converts it into a transform.
    const startPointer = {
      x: initialClientRect.left + pickupPositionInElement.x,
      y: initialClientRect.top + pickupPositionInElement.y,
    };

    const dx = userPointerPosition.x - startPointer.x;
    const dy = userPointerPosition.y - startPointer.y;

    return {
      x: initialClientRect.left + dx / zoomScale,
      y: initialClientRect.top + dy / zoomScale,
    };
  };
  private resizeStart?: {
    width: number;
    height: number;
    pointerX: number;
    pointerY: number;
    positionX: number;
    positionY: number;
    minWidth: number;
    minHeight: number;
    rotation: number; // Widget rotation in degrees at resize start
  };
  
  /** Local preview frame for smooth resize without store updates */
  private readonly _previewFrame = signal<WidgetFrame | null>(null);
  /** Ghost frame for resize previews (unclamped cursor-following outline) */
  private readonly _ghostFrame = signal<WidgetFrame | null>(null);

  // ============================================
  // WIDGET INTERACTION POLICY
  // ============================================

  private readonly _interactionPolicy = computed<WidgetInteractionPolicy>(() =>
    getWidgetInteractionPolicy(this.displayWidget())
  );

  get interactionPolicy(): WidgetInteractionPolicy {
    return this._interactionPolicy();
  }

  get showSelectionBorder(): boolean {
    return this.interactionPolicy.showSelectionBorder;
  }

  get dragAnywhereEnabled(): boolean {
    return this.interactionPolicy.dragHandleMode === 'anywhere';
  }

  get isConnectorWidget(): boolean {
    return this.displayWidget()?.type === 'connector';
  }

  isResizeHandleVisible(handle: ResizeHandle): boolean {
    return isResizeHandleAllowed(this.interactionPolicy, handle);
  }

  // ============================================
  // CONNECTOR ENDPOINT PROPERTIES
  // ============================================

  get connectorStartPoint(): { x: number; y: number } | null {
    const widget = this.displayWidget();
    if (!widget || widget.type !== 'connector') return null;
    const props = widget.props as any;
    return props?.startPoint || null;
  }

  get connectorEndPoint(): { x: number; y: number } | null {
    const widget = this.displayWidget();
    if (!widget || widget.type !== 'connector') return null;
    const props = widget.props as any;
    return props?.endPoint || null;
  }

  /**
   * Returns the stored bezier control point (not on curve).
   * Used internally for calculations.
   */
  get connectorStoredControlPoint(): { x: number; y: number } | null {
    const widget = this.displayWidget();
    if (!widget || widget.type !== 'connector') return null;
    const props = widget.props as any;
    return props?.controlPoint || null;
  }

  /**
   * Returns the visual midpoint ON the curve (at t=0.5).
   * This is where the draggable handle appears.
   * For quadratic bezier: B(0.5) = 0.25*start + 0.5*control + 0.25*end
   * Only shows for curved connectors (not straight lines).
   */
  get connectorMidpointHandle(): { x: number; y: number } | null {
    const widget = this.displayWidget();
    if (!widget || widget.type !== 'connector') return null;
    const props = widget.props as any;
    const shapeType = props?.shapeType || ''; // Added shapeType to the connector calculation
    
    const start = props?.startPoint;
    const end = props?.endPoint;
    const control = props?.controlPoint;
    
    if (!start || !end) return null;

    const isElbow = String(shapeType).includes('elbow');
    if (isElbow) {
      // For elbow connectors, the handle is a *bend point* on the polyline.
      // If control exists, we derive the handle using the same B(0.5) formula
      // (since we store elbow control the same way as curves, for drag compatibility).
      // If control is missing (older docs), fall back to the default L-bend.
      if (control) {
        return {
          x: 0.25 * start.x + 0.5 * control.x + 0.25 * end.x,
          y: 0.25 * start.y + 0.5 * control.y + 0.25 * end.y,
        };
      }

      // When control is missing (older docs), compute the SAME default handle used by the elbow renderer.
      const startDir = getAnchorDirection(props?.startAttachment?.anchor);
      const endDir = getAnchorDirection(props?.endAttachment?.anchor);
      return this.computeDefaultElbowHandle(start, end, startDir, endDir);
    }

    // Curved connectors: only show handle when control exists.
    if (!control) return null;

    return {
      x: 0.25 * start.x + 0.5 * control.x + 0.25 * end.x,
      y: 0.25 * start.y + 0.5 * control.y + 0.25 * end.y,
    };
  }

  private computeDefaultElbowHandle(
    start: { x: number; y: number },
    end: { x: number; y: number },
    startDir: AnchorDirection | null,
    endDir: AnchorDirection | null
  ): { x: number; y: number } {
    // Mirrors the connector widget default: midpoint when aligned, otherwise L-bend.
    const startHoriz = startDir === 'left' || startDir === 'right';
    const endHoriz = endDir === 'left' || endDir === 'right';

    if (!startDir && !endDir) {
      return { x: start.x, y: end.y };
    }

    if (startHoriz && endHoriz) {
      return { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    }

    if (!startHoriz && !endHoriz) {
      return { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    }

    if (startHoriz && !endHoriz) {
      return { x: end.x, y: start.y };
    }

    return { x: start.x, y: end.y };
  }
  
  // ============================================
  // ANCHOR POINTS (for connector attachment)
  // ============================================
  
  /**
   * Snap threshold in pixels - when connector endpoint is within this distance,
   * it will highlight and snap to the anchor point
   */
  private readonly ANCHOR_SNAP_THRESHOLD = 20;
  
  /**
   * Anchor point positions - corresponds to 8 resize handle positions
   */
  private readonly anchorPositions: Array<{
    position: string;
    xPercent: number;
    yPercent: number;
  }> = [
    { position: 'top', xPercent: 50, yPercent: 0 },
    { position: 'top-right', xPercent: 100, yPercent: 0 },
    { position: 'right', xPercent: 100, yPercent: 50 },
    { position: 'bottom-right', xPercent: 100, yPercent: 100 },
    { position: 'bottom', xPercent: 50, yPercent: 100 },
    { position: 'bottom-left', xPercent: 0, yPercent: 100 },
    { position: 'left', xPercent: 0, yPercent: 50 },
    { position: 'top-left', xPercent: 0, yPercent: 0 },
  ];
  
  /**
   * Show anchor points when:
   * 1. This is NOT a connector widget
   * 2. A connector endpoint is being dragged
   * 3. The connector being dragged is not this widget
   */
  get showAnchorPoints(): boolean {
    const widget = this.displayWidget();
    if (!widget || widget.type === 'connector') return false;
    
    const draggingEndpoint = this.uiState.draggingConnectorEndpoint();
    if (!draggingEndpoint) return false;

    const dragPos = this.uiState.connectorEndpointDragPosition();
    if (!dragPos) return false;
    
    // Don't show anchors on the connector's own container
    if (draggingEndpoint.connectorId === this.widgetId) return false;

    // Only show anchors for widgets near the cursor while dragging an endpoint.
    // This prevents all widgets from showing anchors at once.
    const margin = this.ANCHOR_SNAP_THRESHOLD * 2;
    const left = widget.position.x - margin;
    const top = widget.position.y - margin;
    const right = widget.position.x + widget.size.width + margin;
    const bottom = widget.position.y + widget.size.height + margin;

    return dragPos.x >= left && dragPos.x <= right && dragPos.y >= top && dragPos.y <= bottom;
  }
  
  /**
   * Get anchor point absolute position in canvas coordinates
   */
  getAnchorAbsolutePosition(anchor: { xPercent: number; yPercent: number }): { x: number; y: number } {
    const widget = this.displayWidget();
    if (!widget) return { x: 0, y: 0 };
    
    return {
      x: widget.position.x + (anchor.xPercent / 100) * widget.size.width,
      y: widget.position.y + (anchor.yPercent / 100) * widget.size.height,
    };
  }
  
  /**
   * Get anchor points with highlight state based on proximity to dragged endpoint
   */
  get anchorPoints(): Array<{
    position: string;
    xPercent: number;
    yPercent: number;
    isNearby: boolean;
  }> {
    const dragPos = this.uiState.connectorEndpointDragPosition();
    
    return this.anchorPositions.map(anchor => {
      let isNearby = false;
      
      if (dragPos) {
        const absPos = this.getAnchorAbsolutePosition(anchor);
        const distance = Math.sqrt(
          Math.pow(dragPos.x - absPos.x, 2) + Math.pow(dragPos.y - absPos.y, 2)
        );
        isNearby = distance <= this.ANCHOR_SNAP_THRESHOLD;
      }
      
      return {
        ...anchor,
        isNearby,
      };
    });
  }
  
  /**
   * Find the nearest anchor point if within snap threshold.
   * Returns the anchor position and absolute coordinates, or null if none nearby.
   */
  getNearestAnchor(): { position: string; x: number; y: number } | null {
    const dragPos = this.uiState.connectorEndpointDragPosition();
    if (!dragPos) return null;
    
    let nearest: { position: string; x: number; y: number; distance: number } | null = null;
    
    for (const anchor of this.anchorPositions) {
      const absPos = this.getAnchorAbsolutePosition(anchor);
      const distance = Math.sqrt(
        Math.pow(dragPos.x - absPos.x, 2) + Math.pow(dragPos.y - absPos.y, 2)
      );
      
      if (distance <= this.ANCHOR_SNAP_THRESHOLD) {
        if (!nearest || distance < nearest.distance) {
          nearest = { position: anchor.position, x: absPos.x, y: absPos.y, distance };
        }
      }
    }
    
    return nearest ? { position: nearest.position, x: nearest.x, y: nearest.y } : null;
  }
  
  // ============================================
  // COMPUTED PROPERTIES
  // ============================================
  
  get isSelected(): boolean {
    return this.uiState.isWidgetSelected(this.widgetId);
  }

  get isDocumentLocked(): boolean {
    return this.documentService.documentLocked() === true;
  }
  
  get isEditing(): boolean {
    return this.uiState.isEditing(this.widgetId);
  }
  
  get isResizing(): boolean {
    return this.uiState.isResizing(this.widgetId);
  }

  /** Signal tracking active rotation state */
  private readonly _isRotating = signal(false);

  get isRotating(): boolean {
    return this._isRotating();
  }

  /**
   * Returns CSS transform for widget rotation.
   * Uses the rotation value from widget model.
   */
  get rotationTransform(): string {
    const widget = this.displayWidget();
    const rotation = widget?.rotation ?? 0;
    return rotation !== 0 ? `rotate(${rotation}deg)` : '';
  }

  /**
   * Get rotation-aware cursor for a resize handle.
   * The cursor changes based on the widget's rotation to always point
   * in the correct resize direction.
   */
  getResizeCursor(handle: ResizeHandle): string {
    const widget = this.displayWidget();
    const rotation = widget?.rotation ?? 0;
    
    // Base cursor angles for each handle (in degrees, 0 = right/east)
    // These are the angles at which the handle points when rotation = 0
    const handleAngles: Record<ResizeHandle, number> = {
      'right': 0,
      'corner': 45,           // bottom-right, points SE
      'bottom': 90,
      'corner-bottom-left': 135,
      'left': 180,
      'corner-top-left': 225,
      'top': 270,
      'corner-top-right': 315,
    };
    
    // Cursor options in 45-degree increments (starting from 0 = E)
    const cursors = [
      'ew-resize',    // 0: E-W (horizontal)
      'nwse-resize',  // 45: NW-SE (diagonal)
      'ns-resize',    // 90: N-S (vertical)
      'nesw-resize',  // 135: NE-SW (diagonal)
      'ew-resize',    // 180: E-W (horizontal)
      'nwse-resize',  // 225: NW-SE (diagonal)
      'ns-resize',    // 270: N-S (vertical)
      'nesw-resize',  // 315: NE-SW (diagonal)
    ];
    
    // Calculate effective angle with rotation
    const baseAngle = handleAngles[handle];
    const effectiveAngle = (baseAngle + rotation + 360) % 360;
    
    // Round to nearest 45 degrees and get cursor index
    const cursorIndex = Math.round(effectiveAngle / 45) % 8;
    
    return cursors[cursorIndex];
  }
  
  get calculatedZIndex(): number {
    const baseZIndex = 2000;
    const widget = this.displayWidget();
    // Selected connectors get a small z-index boost so they render on top while being dragged.
    // For regular widgets, no boost is needed since their bounding boxes don't overlap as often.
    const selectedBoost = (this.isSelected && widget?.type === 'connector') ? 500 : 0;
    return baseZIndex + (widget?.zIndex ?? 1) + selectedBoost;
  }
  
  /**
   * Get the current frame (position + size)
   * Uses preview frame during resize, otherwise uses display widget
   */
  get frame(): WidgetFrame {
    const preview = this._previewFrame();
    if (preview) {
      return preview;
    }
    
    const widget = this.displayWidget();
    if (!widget) {
      return { width: 100, height: 100, x: 0, y: 0 };
    }
    
    return {
      width: widget.size.width,
      height: widget.size.height,
      x: widget.position.x,
      y: widget.position.y,
    };
  }

  get ghostFrame(): WidgetFrame | null {
    return this._ghostFrame();
  }
  
  /**
   * Get the widget type for template switching
   */
  get widgetType(): string {
    return this.displayWidget()?.type ?? 'unknown';
  }
  
  // ============================================
  // LIFECYCLE
  // ============================================
  
  ngOnInit(): void {
    // Capture listeners must be attached to stop events BEFORE they reach inner widget elements.
    this.hostRef.nativeElement.addEventListener('pointerdown', this.handleLockedPointerDownCapture, { capture: true });
    this.hostRef.nativeElement.addEventListener('click', this.handleLockedClickCapture, { capture: true });
    this.hostRef.nativeElement.addEventListener('dblclick', this.handleLockedDblClickCapture, { capture: true });

    // Subscribe to widget data using granular selector
    // This ONLY emits when THIS widget's data changes in the store
    this.widgetSubscription = this.store
      .select(DocumentSelectors.selectWidgetById(this.widgetId))
      .subscribe(widget => {
        this.persistedWidget.set(widget);

        // If a non-connector widget's layout changes (drag/resize/undo), keep attached connectors in sync.
        // Run this async to avoid dispatching during the store subscription call stack.
        if (widget && widget.type !== 'connector') {
          const sig = `${widget.position?.x ?? 0},${widget.position?.y ?? 0},${widget.size?.width ?? 0},${widget.size?.height ?? 0}`;
          const changed = sig !== this.lastLayoutSignature;
          this.lastLayoutSignature = sig;

          // Avoid syncing while the user is in an active gesture on this widget.
          if (changed && !this.isEditing && !this.isResizing && !this.isRotating && !this.dragStartFrame) {
            queueMicrotask(() => this.updateAttachedConnectors());
          }
        }

        // Normalize straight connector widgets to a slim height so they don't behave like big rectangles.
        // This is a system layout fix, so we do not record an undo step.
        this.maybeNormalizePreferredHeight(widget);

        // If the widget is removed (e.g., via undo), ensure we don't leave UI in a stuck "editing" state.
        // Otherwise global shortcuts like Ctrl+Y can be blocked because UIState still thinks we're editing.
        if (!widget && this.uiState.isEditing(this.widgetId)) {
          this.uiState.stopEditing(this.widgetId);
        }

        // Auto-load URL-based widgets (non-blocking) after document import/open.
        // Also retry if error was cleared (user clicked refresh).
        if (widget) {
          const props: any = widget.props || {};
          // If error was just cleared, trigger reload
          if (props.errorMessage === undefined && props.dataSource?.kind === 'http') {
            // Small delay to ensure error state is fully cleared
            setTimeout(() => {
              this.remoteAutoLoad.maybeAutoLoad(widget, this.pageId);
            }, 50);
          } else {
            this.remoteAutoLoad.maybeAutoLoad(widget, this.pageId);
          }
        }
      });
  }

  private maybeNormalizePreferredHeight(widget: WidgetEntity | null): void {
    if (!widget) return;
    if (this.isDocumentLocked) return;
    if (this.isEditing || this.isResizing || this.isRotating) return;

    const policy = getWidgetInteractionPolicy(widget);
    const targetH = policy.preferredHeightPx;
    if (targetH == null) return;

    const currentH = widget.size?.height ?? 0;
    if (!Number.isFinite(currentH) || currentH <= 0) return;
    if (Math.abs(currentH - targetH) < 0.5) return;

    // Only auto-shrink overly tall widgets; don't force-grow small ones.
    if (currentH <= targetH) return;

    const currentY = widget.position?.y ?? 0;
    const currentX = widget.position?.x ?? 0;
    const currentW = widget.size?.width ?? 0;
    const centerY = currentY + currentH / 2;

    // Keep the visual center stable.
    let nextY = centerY - targetH / 2;

    // Clamp to page bounds (best-effort; uses current input pageHeight).
    if (Number.isFinite(this.pageHeight) && this.pageHeight > 0) {
      nextY = Math.max(0, Math.min(nextY, this.pageHeight - targetH));
    }

    this.store.dispatch(
      WidgetActions.updateOne({
        id: this.widgetId,
        changes: {
          position: { x: currentX, y: nextY },
          size: { width: currentW, height: targetH },
        },
      })
    );
  }
  
  ngOnDestroy(): void {
    this.hostRef.nativeElement.removeEventListener('pointerdown', this.handleLockedPointerDownCapture, true);
    this.hostRef.nativeElement.removeEventListener('click', this.handleLockedClickCapture, true);
    this.hostRef.nativeElement.removeEventListener('dblclick', this.handleLockedDblClickCapture, true);

    // Clean up subscription
    this.widgetSubscription?.unsubscribe();

    // If a connector stroke drag is in progress, clean up listeners.
    if (this.connectorWholeDrag) {
      document.removeEventListener('pointermove', this.onConnectorStrokePointerMove);
      document.removeEventListener('pointerup', this.onConnectorStrokePointerUp);
      this.connectorWholeDrag = null;
    }

    // If this widget is being destroyed while in edit mode, clear edit mode.
    // (Covers cases where the widget is removed before it can emit editingChange(false).)
    if (this.uiState.isEditing(this.widgetId)) {
      this.uiState.stopEditing(this.widgetId);
    }
    
    // Commit any pending drafts before destroying
    if (this.draftState.hasDraft(this.widgetId)) {
      this.draftState.commitDraft(this.widgetId);
    }
  }
  
  // ============================================
  // DRAG HANDLING
  // ============================================
  
  /**
   * Handle pointer down on drag handle
   * Ensures proper pointer event handling and prevents CKEditor interference
   * Similar fix to resizer - ensures first drag attempt works after editing
   * 
   * The issue: After editing in CKEditor, isEditing is still true when drag handle
   * is clicked, causing cdkDragDisabled to be true. The blur timeout delays the
   * editing state change by 150ms, so the first drag attempt is blocked.
   * 
   * The fix: Exit editing mode immediately when drag handle is clicked, ensuring
   * cdkDragDisabled becomes false before CDK Drag processes the event.
   */
  onDragHandlePointerDown(event: PointerEvent): void {
    if (this.isDocumentLocked) {
      // View/select only: allow selection but block drag.
      if (!this.isSelected) {
        this.uiState.selectWidget(this.widgetId);
      }
      return;
    }
    // CRITICAL FIX: Exit editing mode immediately if currently editing
    // This ensures cdkDragDisabled becomes false before CDK Drag processes the event
    // The editing state would normally clear after a 150ms blur timeout, but we need
    // it to clear immediately when user starts dragging
    if (this.isEditing) {
      // Force stop editing immediately by stopping editing in UIState
      // This will make cdkDragDisabled false right away
      this.uiState.stopEditing();
    }
    
    // Release any pointer capture that might be held by CKEditor or other elements
    // This must be done synchronously before CDK Drag processes the event
    if (event.pointerId !== undefined) {
      try {
        // Release capture from the active element (might be CKEditor's editable)
        const activeElement = document.activeElement as HTMLElement;
        if (activeElement && typeof activeElement.releasePointerCapture === 'function') {
          try {
            activeElement.releasePointerCapture(event.pointerId);
          } catch {
            // Element might not have capture - that's fine
          }
        }
        
        // Also check if the event target or its parents have capture
        let element: HTMLElement | null = event.target as HTMLElement;
        while (element && element !== document.body) {
          if (element.releasePointerCapture) {
            try {
              element.releasePointerCapture(event.pointerId);
            } catch {
              // Not all elements will have capture
            }
          }
          element = element.parentElement;
        }
      } catch {
        // Ignore errors - continue to let CDK Drag handle the event
      }
    }
    
    // Select widget if not already selected
    if (event.ctrlKey || event.metaKey) {
      this.uiState.toggleSelection(this.widgetId);
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (event.shiftKey) {
      this.uiState.addToSelection(this.widgetId);
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    // If widget is already selected, do NOT clear selection - allow group drag
    // Only select this widget alone if it's not currently selected
    if (!this.isSelected) {
      this.uiState.selectWidget(this.widgetId);
    }
    // else: widget is selected, preserve multi-selection for group drag
    
    // NOTE: Do NOT call startDragging() here. CDK Drag will call onDragStarted
    // only if an actual drag gesture begins. If user just clicks, we don't want
    // to leave isInteracting() === true.
  }

  onDragStarted(event: CdkDragStart): void {
    this.connectorStrokeDragAllowedForGesture = null;
    // Capture starting frame so we can compute an absolute frame during drag moves.
    this.dragStartFrame = { ...this.frame };
    this.multiDragState = null;

    const selectedIds = Array.from(this.uiState.selectedWidgetIds());
    if (selectedIds.length > 1 && selectedIds.includes(this.widgetId)) {
      const entities = this.widgetEntitiesSignal();
      const startPositions = new Map<string, { x: number; y: number }>();
      for (const id of selectedIds) {
        const persisted = entities[id];
        if (!persisted || persisted.pageId !== this.pageId) continue;
        const merged = this.draftState.getMergedWidget(id, persisted) ?? persisted;
        startPositions.set(id, { x: merged.position.x, y: merged.position.y });
      }

      const widgetIds = selectedIds.filter(id => startPositions.has(id));
      if (widgetIds.length > 1) {
        this.multiDragState = { widgetIds, startPositions };
      }
    }
    // Start drag tracking and guides only when actual drag begins
    this.uiState.startDragging(this.widgetId);
    this.guides.start(this.pageId, this.widgetId, 'drag');
  }

  onDragMoved(event: CdkDragMove): void {
    if (!this.dragStartFrame) return;

    // Use the *actual* transform CDK applied (already constrained for zoom)
    // rather than `event.distance`, which is in screen px and doesn't know about our CSS scale.
    const p = event.source.getFreeDragPosition();
    const rawFrame: WidgetFrame = {
      x: this.dragStartFrame.x + (p?.x ?? 0),
      y: this.dragStartFrame.y + (p?.y ?? 0),
      width: this.dragStartFrame.width,
      height: this.dragStartFrame.height,
    };

    // IMPORTANT: Guides must be "virtual" and must not interfere with CDK drag.
    // We only update the guides overlay here (no snapping / no drag position mutation).
    this.guides.updateDrag(this.pageId, this.widgetId, rawFrame, this.pageWidth, this.pageHeight);

    // Build set of widgets being dragged for connector logic
    const draggingWidgetIds = new Set<string>([this.widgetId]);
    if (this.multiDragState) {
      const dx = p?.x ?? 0;
      const dy = p?.y ?? 0;
      for (const id of this.multiDragState.widgetIds) {
        draggingWidgetIds.add(id);
        if (id === this.widgetId) continue;
        const start = this.multiDragState.startPositions.get(id);
        if (!start) continue;
        this.draftState.updateDraftPosition(id, { x: start.x + dx, y: start.y + dy });
      }
    }

    // Keep any attached connectors in sync during the drag gesture.
    this.updateAttachedConnectors({ frameOverride: rawFrame, mode: 'draft', draggingWidgetIds });
  }
  
  onDragEnded(event: CdkDragEnd): void {
    const start = this.dragStartFrame ?? this.frame;
    const position = event.source.getFreeDragPosition();

    const rawFrame: WidgetFrame = {
      x: start.x + (position?.x ?? 0),
      y: start.y + (position?.y ?? 0),
      width: start.width,
      height: start.height,
    };

    // If snapping is enabled, apply it at the end only (no mid-gesture interference).
    const finalFrame = this.uiState.guidesSnapEnabled()
      ? this.guides.updateDrag(this.pageId, this.widgetId, rawFrame, this.pageWidth, this.pageHeight)
      : rawFrame;

    const newPosition: WidgetPosition = { x: finalFrame.x, y: finalFrame.y };
    
    // Update draft position for the primary widget
    this.draftState.updateDraftPosition(this.widgetId, newPosition);

    if (this.multiDragState && this.multiDragState.widgetIds.length > 1) {
      // Batch commit all dragged widgets as a single undo operation
      const allDraggedIds = this.multiDragState.widgetIds;
      this.draftState.commitDraftsBatched(allDraggedIds, { recordUndo: true });
      this.multiDragState = null;
    } else {
      // Single widget drag - commit normally
      this.draftState.commitDraft(this.widgetId, { recordUndo: true });
    }
    
    // Stop drag tracking
    this.uiState.stopDragging();
    this.guides.end(this.widgetId);
    this.dragStartFrame = null;
    this.connectorStrokeDragAllowedForGesture = null;
    
    event.source.reset();
  }
  
  /**
   * Update all connectors that are attached to this widget.
   * Called after widget position/size changes.
   * @param options.draggingWidgetIds - Set of widget IDs currently being dragged together (multi-drag)
   */
  private updateAttachedConnectors(options?: { frameOverride?: WidgetFrame; mode?: 'draft' | 'store'; draggingWidgetIds?: Set<string> }): void {
    const widget = this.displayWidget();
    if (!widget || widget.type === 'connector') return;

    const mode = options?.mode ?? 'store';
    const targetFrame: WidgetFrame = options?.frameOverride ?? {
      x: widget.position.x,
      y: widget.position.y,
      width: widget.size.width,
      height: widget.size.height,
    };

    // Find all connectors attached to this widget
    const attachedConnectors = this.connectorAnchorService.findConnectorsAttachedToWidget(
      this.pageId,
      this.widgetId
    );

    if (attachedConnectors.length === 0) return;

    const entities = this.widgetEntitiesSignal();
    const uniqueConnectorIds = Array.from(new Set(attachedConnectors.map(attached => attached.connectorId)));

    const updates: WidgetEntity[] = [];

    const getAnchorPositionForFrame = (attachment?: AnchorAttachment | null): { x: number; y: number } | null => {
      if (!attachment) return null;
      const anchor = this.connectorAnchorService.anchorPositions.find(a => a.position === attachment.anchor);
      if (!anchor) return null;
      return {
        x: targetFrame.x + (anchor.xPercent / 100) * targetFrame.width,
        y: targetFrame.y + (anchor.yPercent / 100) * targetFrame.height,
      };
    };

    for (const connectorId of uniqueConnectorIds) {
      const persisted = entities[connectorId];
      if (!persisted || persisted.type !== 'connector') continue;

      const connector = this.draftState.getMergedWidget(connectorId, persisted) ?? persisted;
      const props = connector.props as any;
      const startPoint = props?.startPoint;
      const endPoint = props?.endPoint;
      const controlPoint = props?.controlPoint;
      if (!startPoint || !endPoint) continue;

      const startAttachment = props?.startAttachment as AnchorAttachment | undefined;
      const endAttachment = props?.endAttachment as AnchorAttachment | undefined;
      const isStartAttachedToThis = startAttachment?.widgetId === this.widgetId;
      const isEndAttachedToThis = endAttachment?.widgetId === this.widgetId;

      if (!isStartAttachedToThis && !isEndAttachedToThis) continue;

      const absStartStored = {
        x: connector.position.x + startPoint.x,
        y: connector.position.y + startPoint.y,
      };
      const absEndStored = {
        x: connector.position.x + endPoint.x,
        y: connector.position.y + endPoint.y,
      };
      const absControl = controlPoint
        ? { x: connector.position.x + controlPoint.x, y: connector.position.y + controlPoint.y }
        : null;

      const startAnchorPos = isStartAttachedToThis
        ? getAnchorPositionForFrame(startAttachment)
        : this.connectorAnchorService.getAttachedEndpointPosition(startAttachment);
      const endAnchorPos = isEndAttachedToThis
        ? getAnchorPositionForFrame(endAttachment)
        : this.connectorAnchorService.getAttachedEndpointPosition(endAttachment);

      const absStart = startAnchorPos ?? absStartStored;
      const absEnd = endAnchorPos ?? absEndStored;

      const otherAttachment = isStartAttachedToThis ? endAttachment : startAttachment;
      // Move connector as a unit if:
      // 1. Other end is not attached to any widget, OR
      // 2. Other end is attached to THIS widget (both ends on same widget), OR
      // 3. Other end is attached to a widget that's ALSO being dragged (multi-drag)
      const otherWidgetId = otherAttachment?.widgetId;
      const otherIsBeingDragged = otherWidgetId && options?.draggingWidgetIds?.has(otherWidgetId);
      const shouldMoveTogether = !otherAttachment || otherWidgetId === this.widgetId || otherIsBeingDragged;

      if (shouldMoveTogether) {
        // When both ends are being dragged (multi-drag), only update from the start-attached widget
        // to avoid double-updating the connector position
        if (otherIsBeingDragged && !isStartAttachedToThis) {
          continue; // Let the widget attached to the start handle this connector
        }

        const attachedOldAbs = isStartAttachedToThis ? absStartStored : absEndStored;
        const attachedNewAbs = isStartAttachedToThis ? absStart : absEnd;
        const dx = attachedNewAbs.x - attachedOldAbs.x;
        const dy = attachedNewAbs.y - attachedOldAbs.y;

        if (dx === 0 && dy === 0) continue;

        const newPosition = { x: connector.position.x + dx, y: connector.position.y + dy };

        if (mode === 'draft') {
          this.draftState.updateDraftPosition(connector.id, newPosition);
        } else {
          updates.push({
            ...connector,
            position: newPosition,
          });
        }
        continue;
      }

      // For elbows, ensure we always have a control point so handle/path/bounds remain consistent.
      let effectiveAbsControl = absControl;
      const shapeType = String(props?.shapeType ?? '');
      const isElbow = shapeType.includes('elbow');
      if (isElbow && !effectiveAbsControl) {
        const startDir = getAnchorDirection(props?.startAttachment?.anchor);
        const endDir = getAnchorDirection(props?.endAttachment?.anchor);
        const defaultHandle = this.computeDefaultElbowHandle(absStart, absEnd, startDir, endDir);
        effectiveAbsControl = {
          x: 2 * defaultHandle.x - 0.5 * (absStart.x + absEnd.x),
          y: 2 * defaultHandle.y - 0.5 * (absStart.y + absEnd.y),
        };
      }

      // Minimal visual buffer so stroke + arrow remain inside bounds (prevents “broken” attachment look)
      const strokeWidth = props?.stroke?.width ?? 2;
      const hasArrow = Boolean(props?.arrowStart || props?.arrowEnd || shapeType.includes('arrow'));
      const arrowBuffer = hasArrow ? 10 : 0;
      const visualBuffer = Math.max(strokeWidth / 2, 1) + arrowBuffer + 6;

      const curveBounds = this.calculateConnectorBounds(absStart, absEnd, effectiveAbsControl, visualBuffer, String(props?.shapeType ?? ''), props);
      const newPosition = { x: curveBounds.minX, y: curveBounds.minY };
      const newSize = {
        width: Math.max(curveBounds.maxX - curveBounds.minX, 1),
        height: Math.max(curveBounds.maxY - curveBounds.minY, 1),
      };

      const newStartPoint = { x: absStart.x - curveBounds.minX, y: absStart.y - curveBounds.minY };
      const newEndPoint = { x: absEnd.x - curveBounds.minX, y: absEnd.y - curveBounds.minY };
      const newControlPoint = effectiveAbsControl
        ? { x: effectiveAbsControl.x - curveBounds.minX, y: effectiveAbsControl.y - curveBounds.minY }
        : undefined;

      if (mode === 'draft') {
        this.draftState.updateDraftFrame(connector.id, newPosition, newSize);
        this.draftState.updateDraftProps(connector.id, {
          startPoint: newStartPoint,
          endPoint: newEndPoint,
          controlPoint: newControlPoint,
        });
      } else {
        updates.push({
          ...connector,
          position: newPosition,
          size: newSize,
          props: {
            ...props,
            startPoint: newStartPoint,
            endPoint: newEndPoint,
            controlPoint: newControlPoint,
          },
        });
      }
    }

    if (mode === 'draft' || updates.length === 0) return;

    // Dispatch after this subscription completes to avoid re-entrancy.
    queueMicrotask(() => {
      this.store.dispatch(WidgetActions.upsertMany({ widgets: updates }));
      for (const updated of updates) {
        this.draftState.discardDraft(updated.id);
      }
    });
  }
  
  private getWidgetHitStackAtPoint(clientX: number, clientY: number): Array<{ id: string; type?: string }> {
    const elements = (document.elementsFromPoint(clientX, clientY) ?? []) as HTMLElement[];
    const seen = new Set<string>();
    const result: Array<{ id: string; type?: string }> = [];

    for (const el of elements) {
      const container = (el as HTMLElement | null)?.closest?.('.widget-container') as HTMLElement | null;
      if (!container) continue;
      const id = container.getAttribute('data-widget-id');
      if (!id || seen.has(id)) continue;

      seen.add(id);
      result.push({
        id,
        type: container.getAttribute('data-widget-type') ?? undefined,
      });
    }

    return result;
  }

  onWidgetPointerDown(event?: PointerEvent): void {
    if (!event) {
      this.uiState.selectWidget(this.widgetId);
      return;
    }

    // When multiple widgets overlap at the pointer location (common for connectors), the DOM top-most
    // widget will receive the event. Provide a way to cycle/select items “behind” without requiring
    // pixel-perfect clicking.
    if (event.altKey) {
      const hitStack = this.getWidgetHitStackAtPoint(event.clientX, event.clientY);
      if (hitStack.length > 1) {
        const hasConnectors = hitStack.some(h => h.type === 'connector');
        const candidates = hasConnectors ? hitStack.filter(h => h.type === 'connector') : hitStack;
        const candidateIds = candidates.map(c => c.id);

        if (candidateIds.length > 1) {
          const active = this.uiState.activeWidgetId();
          const activeIdx = active ? candidateIds.indexOf(active) : -1;
          const nextIdx = activeIdx >= 0 ? (activeIdx + 1) % candidateIds.length : 0;
          const nextId = candidateIds[nextIdx];
          this.uiState.selectWidget(nextId);

          // Prevent CDK Drag from starting on the currently clicked (top-most) widget.
          event.preventDefault();
          // stopImmediatePropagation is important here because cdkDrag listens on the same element.
          (event as unknown as { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.();
          event.stopPropagation();
          return;
        }
      }
    }

    if (event.ctrlKey || event.metaKey) {
      this.uiState.toggleSelection(this.widgetId);
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (event.shiftKey) {
      this.uiState.addToSelection(this.widgetId);
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    // If widget is already selected, preserve multi-selection for group drag
    // Only select this widget alone if it's not currently selected
    if (!this.isSelected) {
      this.uiState.selectWidget(this.widgetId);
    }
  }

  /**
   * Handle pointerdown on the connector's SVG stroke (hit area).
   * Since the connector container is pointer-events: none, clicks only reach the SVG stroke.
   * We select the widget here, then manually start the drag by dispatching a synthetic
   * pointer event on the widget-container element.
   */
  onConnectorStrokePointerDown(event: PointerEvent): void {
    event.preventDefault();
    event.stopPropagation();

    if (this.isDocumentLocked) {
      if (!this.isSelected) this.uiState.selectWidget(this.widgetId);
      return;
    }

    const widget = this.displayWidget();
    if (!widget || widget.type !== 'connector') return;

    if (event.ctrlKey || event.metaKey) {
      this.uiState.toggleSelection(this.widgetId);
      return;
    }

    if (event.shiftKey) {
      this.uiState.addToSelection(this.widgetId);
      return;
    }

    // If widget is already selected, preserve multi-selection for group drag
    // Only select this widget alone if it's not currently selected
    if (!this.isSelected) {
      this.uiState.selectWidget(this.widgetId);
    }

    // Start a native pointer drag for the whole connector.
    this.connectorWholeDrag = {
      pointerId: event.pointerId,
      startPointer: { x: event.clientX, y: event.clientY },
      startPosition: { x: widget.position.x, y: widget.position.y },
    };

    this.multiDragState = null;
    const selectedIds = Array.from(this.uiState.selectedWidgetIds());
    if (selectedIds.length > 1 && selectedIds.includes(this.widgetId)) {
      const entities = this.widgetEntitiesSignal();
      const startPositions = new Map<string, { x: number; y: number }>();
      for (const id of selectedIds) {
        const persisted = entities[id];
        if (!persisted || persisted.pageId !== this.pageId) continue;
        const merged = this.draftState.getMergedWidget(id, persisted) ?? persisted;
        startPositions.set(id, { x: merged.position.x, y: merged.position.y });
      }

      const widgetIds = selectedIds.filter(id => startPositions.has(id));
      if (widgetIds.length > 1) {
        this.multiDragState = { widgetIds, startPositions };
      }
    }

    this.dragStartFrame = { ...this.frame };
    this.guides.start(this.pageId, this.widgetId, 'drag');
    this.uiState.startDragging(this.widgetId);

    document.addEventListener('pointermove', this.onConnectorStrokePointerMove, { passive: false });
    document.addEventListener('pointerup', this.onConnectorStrokePointerUp, { passive: false });
  }

  private onConnectorStrokePointerMove = (event: PointerEvent): void => {
    if (!this.connectorWholeDrag) return;
    if (event.pointerId !== this.connectorWholeDrag.pointerId) return;
    if (!this.dragStartFrame) return;

    event.preventDefault();

    const zoom = Math.max(0.1, this.uiState.zoomLevel() / 100);
    const dx = (event.clientX - this.connectorWholeDrag.startPointer.x) / zoom;
    const dy = (event.clientY - this.connectorWholeDrag.startPointer.y) / zoom;

    const nextPosition: WidgetPosition = {
      x: this.connectorWholeDrag.startPosition.x + dx,
      y: this.connectorWholeDrag.startPosition.y + dy,
    };

    // Smoothly update via draft (no store churn during gesture)
    this.draftState.updateDraftPosition(this.widgetId, nextPosition);

    if (this.multiDragState) {
      for (const id of this.multiDragState.widgetIds) {
        if (id === this.widgetId) continue;
        const start = this.multiDragState.startPositions.get(id);
        if (!start) continue;
        this.draftState.updateDraftPosition(id, { x: start.x + dx, y: start.y + dy });
      }
    }

    // Update guide overlay (virtual)
    const rawFrame: WidgetFrame = {
      x: nextPosition.x,
      y: nextPosition.y,
      width: this.dragStartFrame.width,
      height: this.dragStartFrame.height,
    };
    this.guides.updateDrag(this.pageId, this.widgetId, rawFrame, this.pageWidth, this.pageHeight);
  };

  private onConnectorStrokePointerUp = (event: PointerEvent): void => {
    if (!this.connectorWholeDrag) return;
    if (event.pointerId !== this.connectorWholeDrag.pointerId) return;

    event.preventDefault();

    document.removeEventListener('pointermove', this.onConnectorStrokePointerMove);
    document.removeEventListener('pointerup', this.onConnectorStrokePointerUp);

    this.connectorWholeDrag = null;

    // Commit final draft to store (undoable)
    if (this.multiDragState && this.multiDragState.widgetIds.length > 1) {
      // Batch commit all dragged widgets as a single undo operation
      const allDraggedIds = this.multiDragState.widgetIds;
      this.draftState.commitDraftsBatched(allDraggedIds, { recordUndo: true });
      this.multiDragState = null;
    } else {
      // Single widget drag
      if (this.draftState.hasDraft(this.widgetId)) {
        this.draftState.commitDraft(this.widgetId, { recordUndo: true });
      }
    }

    this.uiState.stopDragging();
    this.guides.end(this.widgetId);
    this.dragStartFrame = null;
  };
  
  // ============================================
  // RESIZE HANDLING
  // ============================================
  
  onResizePointerDown(event: PointerEvent, handle: ResizeHandle): void {
    if (this.isDocumentLocked) {
      return;
    }
    if (!this.isSelected) {
      return;
    }

    // Policy: only allow handles enabled for this widget.
    if (!this.isResizeHandleVisible(handle)) {
      return;
    }
    
    event.stopPropagation();
    
    // Start resize tracking
    this.uiState.startResizing(this.widgetId);
    this.activeHandle = handle;
    this.guides.start(this.pageId, this.widgetId, 'resize', handle);

    const widget = this.displayWidget();
    const { minWidth, minHeight } = this.computeResizeMinConstraints(widget);
    const rotation = widget?.rotation ?? 0;
    
    this.resizeStart = {
      width: this.frame.width,
      height: this.frame.height,
      pointerX: event.clientX,
      pointerY: event.clientY,
      positionX: this.frame.x,
      positionY: this.frame.y,
      minWidth,
      minHeight,
      rotation,
    };
    
    // Initialize preview frame
    this._previewFrame.set({ ...this.frame });
    this._ghostFrame.set({ ...this.frame });
    
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  }
  
  @HostListener('document:pointermove', ['$event'])
  onResizePointerMove(event: PointerEvent): void {
    // Handle rotation move if rotating
    if (this.isRotating) {
      this.handleRotationMove(event);
      return;
    }

    if (!this.isResizing || !this.resizeStart || !this.activeHandle) {
      return;
    }
    
    event.preventDefault();
    
    // Raw screen delta
    const rawDeltaX = event.clientX - this.resizeStart.pointerX;
    const rawDeltaY = event.clientY - this.resizeStart.pointerY;
    
    // Transform screen delta to local widget coordinates (accounting for rotation)
    const rotation = this.resizeStart.rotation;
    const radians = (rotation * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    
    // Rotate the delta vector by -rotation to get local deltas
    const localDeltaX = rawDeltaX * cos + rawDeltaY * sin;
    const localDeltaY = -rawDeltaX * sin + rawDeltaY * cos;
    
    // Original dimensions
    const origW = this.resizeStart.width;
    const origH = this.resizeStart.height;
    
    // Calculate new size based on handle (in local coordinates)
    let deltaWidth = 0;
    let deltaHeight = 0;
    // Which edges move: -1 = start edge moves, 0 = neither, 1 = end edge moves
    let xEdge = 0; // For width: -1 = left moves, 1 = right moves
    let yEdge = 0; // For height: -1 = top moves, 1 = bottom moves
    
    switch (this.activeHandle) {
      case 'right':
        deltaWidth = localDeltaX;
        xEdge = 1;
        break;
      case 'bottom':
        deltaHeight = localDeltaY;
        yEdge = 1;
        break;
      case 'corner': // bottom-right
        deltaWidth = localDeltaX;
        deltaHeight = localDeltaY;
        xEdge = 1;
        yEdge = 1;
        break;
      case 'corner-top-right':
        deltaWidth = localDeltaX;
        deltaHeight = -localDeltaY;
        xEdge = 1;
        yEdge = -1;
        break;
      case 'corner-top-left':
        deltaWidth = -localDeltaX;
        deltaHeight = -localDeltaY;
        xEdge = -1;
        yEdge = -1;
        break;
      case 'corner-bottom-left':
        deltaWidth = -localDeltaX;
        deltaHeight = localDeltaY;
        xEdge = -1;
        yEdge = 1;
        break;
      case 'left':
        deltaWidth = -localDeltaX;
        xEdge = -1;
        break;
      case 'top':
        deltaHeight = -localDeltaY;
        yEdge = -1;
        break;
    }

    // Lock height when policy implies horizontal-only resize (e.g. straight connectors).
    const horizontalOnly =
      this.interactionPolicy.preferredHeightPx != null &&
      this.interactionPolicy.allowedResizeHandles.size === 2 &&
      this.interactionPolicy.allowedResizeHandles.has('left') &&
      this.interactionPolicy.allowedResizeHandles.has('right');
    if (horizontalOnly) {
      deltaHeight = 0;
      yEdge = 0;
    }
    
    const newW = origW + deltaWidth;
    const newH = origH + deltaHeight;
    
    // Calculate position adjustment to keep the anchor point fixed.
    // With transform-origin: center, we need to calculate how the center shifts
    // and compensate for that in the position.
    //
    // When right/bottom edges move (xEdge=1, yEdge=1): center moves by delta/2
    // When left/top edges move (xEdge=-1, yEdge=-1): center moves by -delta/2
    // The new position needs to place the new center at the same page location as the old anchor point's projection.
    
    // Local center shift due to size change (in local coords)
    // For right edge moving: new center = old center + deltaWidth/2 → shift = deltaWidth/2
    // For left edge moving: new center = old center - deltaWidth/2 → but we want left edge fixed, 
    //   so we need position to move so that the old left edge position = new left edge position
    
    // Simpler approach: calculate the anchor point (the edge that should stay fixed)
    // in both old and new configurations, then adjust position.
    
    // Old center in local coords: (origW/2, origH/2)
    // New center in local coords: (newW/2, newH/2)
    
    // For each handle, determine which point should stay fixed:
    let anchorLocalX = origW / 2; // default: center
    let anchorLocalY = origH / 2;
    
    if (xEdge === 1) anchorLocalX = 0;           // right moves → left stays fixed
    else if (xEdge === -1) anchorLocalX = origW; // left moves → right stays fixed
    
    if (yEdge === 1) anchorLocalY = 0;           // bottom moves → top stays fixed
    else if (yEdge === -1) anchorLocalY = origH; // top moves → bottom stays fixed
    
    // Where this anchor point was in page coords (relative to old center, then rotated, then + old position + old center)
    const oldCenterX = this.resizeStart.positionX + origW / 2;
    const oldCenterY = this.resizeStart.positionY + origH / 2;
    
    // Anchor offset from old center (in local coords)
    const anchorFromOldCenterX = anchorLocalX - origW / 2;
    const anchorFromOldCenterY = anchorLocalY - origH / 2;
    
    // Rotate to get page coords offset
    const anchorPageOffsetX = anchorFromOldCenterX * cos - anchorFromOldCenterY * sin;
    const anchorPageOffsetY = anchorFromOldCenterX * sin + anchorFromOldCenterY * cos;
    
    // Anchor point in page coords
    const anchorPageX = oldCenterX + anchorPageOffsetX;
    const anchorPageY = oldCenterY + anchorPageOffsetY;
    
    // Now, for the new widget, where would this same local anchor point be?
    // New anchor in local coords from new center
    let newAnchorLocalX = newW / 2;
    let newAnchorLocalY = newH / 2;
    
    if (xEdge === 1) newAnchorLocalX = 0;
    else if (xEdge === -1) newAnchorLocalX = newW;
    
    if (yEdge === 1) newAnchorLocalY = 0;
    else if (yEdge === -1) newAnchorLocalY = newH;
    
    const newAnchorFromCenterX = newAnchorLocalX - newW / 2;
    const newAnchorFromCenterY = newAnchorLocalY - newH / 2;
    
    const newAnchorPageOffsetX = newAnchorFromCenterX * cos - newAnchorFromCenterY * sin;
    const newAnchorPageOffsetY = newAnchorFromCenterX * sin + newAnchorFromCenterY * cos;
    
    // We want: newCenterPage + newAnchorPageOffset = anchorPage
    // So: newCenterPage = anchorPage - newAnchorPageOffset
    const newCenterPageX = anchorPageX - newAnchorPageOffsetX;
    const newCenterPageY = anchorPageY - newAnchorPageOffsetY;
    
    // New position (top-left) = newCenter - (newW/2, newH/2)
    const nextX = newCenterPageX - newW / 2;
    const nextY = newCenterPageY - newH / 2;
    
    // PPT-style ghost resize:
    const ghost = this.clampFrame(newW, newH, nextX, nextY, 1, 1);
    this._ghostFrame.set(ghost);
    this.guides.updateResize(this.pageId, this.widgetId, ghost, this.pageWidth, this.pageHeight, this.activeHandle);
  }
  
  @HostListener('document:pointerup', ['$event'])
  onResizePointerUp(event: PointerEvent): void {
    // Handle rotation end if rotating
    if (this.isRotating) {
      this.handleRotationEnd();
      return;
    }

    if (!this.isResizing) {
      return;
    }
    
    // Get the final frame (visual preview)
    const previewFrame = this._previewFrame();
    const handle = this.activeHandle;
    const widget = this.displayWidget();
    const ghostFrame = this._ghostFrame();
    
    // Clear resize state
    this.uiState.stopResizing();
    this.guides.end(this.widgetId);
    this.activeHandle = null;
    this.resizeStart = undefined;
    this._previewFrame.set(null);
    this._ghostFrame.set(null);
    
    // NOW commit to store (only once, at the end)
    if (previewFrame) {
      // Apply min constraints + snapping at the end only.
      const { minWidth, minHeight } = this.computeResizeMinConstraints(widget);
      // Prefer the last ghost frame for intent, but fall back to preview if needed.
      const base = ghostFrame ?? previewFrame;
      const clamped = this.clampFrame(base.width, base.height, base.x, base.y, minWidth, minHeight);

      const finalFrame = this.uiState.guidesSnapEnabled() && handle
        ? this.guides.updateResize(this.pageId, this.widgetId, clamped, this.pageWidth, this.pageHeight, handle)
        : clamped;

      this.draftState.updateDraftFrame(this.widgetId, { x: finalFrame.x, y: finalFrame.y }, { width: finalFrame.width, height: finalFrame.height });
      this.draftState.commitDraft(this.widgetId, { recordUndo: true });
    }
  }
  
  // ============================================
  // ROTATION HANDLING
  // ============================================
  
  /** Rotation start state for tracking during the gesture */
  private rotationStartState: {
    centerX: number;
    centerY: number;
    startAngle: number;
    initialRotation: number;
  } | null = null;

  /**
   * Start rotation gesture on pointer down
   */
  onRotatePointerDown(event: PointerEvent): void {
    event.preventDefault();
    event.stopPropagation();

    if (this.isDocumentLocked) return;

    const widget = this.displayWidget();
    if (!widget) return;

    // Calculate the logical center of the widget (unrotated frame center)
    // This ensures the center doesn't shift as the widget rotates
    const frame = this.frame;
    const logicalCenterX = frame.x + frame.width / 2;
    const logicalCenterY = frame.y + frame.height / 2;

    // Get the page canvas element to find its position on screen
    const pageCanvas = this.hostRef.nativeElement.closest('.page-canvas, .page__canvas');
    const pageRect = pageCanvas ? pageCanvas.getBoundingClientRect() : { left: 0, top: 0 };
    
    // Account for zoom scale
    const zoomScale = Math.max(0.1, this.uiState.zoomLevel() / 100);
    
    // Convert logical center to screen coordinates
    const centerX = pageRect.left + logicalCenterX * zoomScale;
    const centerY = pageRect.top + logicalCenterY * zoomScale;

    // Calculate the initial angle from center to pointer
    const dx = event.clientX - centerX;
    const dy = event.clientY - centerY;
    const startAngle = Math.atan2(dy, dx) * (180 / Math.PI);

    this.rotationStartState = {
      centerX,
      centerY,
      startAngle,
      initialRotation: widget.rotation ?? 0,
    };

    this._isRotating.set(true);

    // Capture pointer for smooth tracking
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  }

  /**
   * Track rotation during pointer move (shared with resize handler)
   */
  private handleRotationMove(event: PointerEvent): void {
    if (!this.isRotating || !this.rotationStartState) return;

    event.preventDefault();

    const { centerX, centerY, startAngle, initialRotation } = this.rotationStartState;

    // Calculate current angle from center to pointer
    const dx = event.clientX - centerX;
    const dy = event.clientY - centerY;
    const currentAngle = Math.atan2(dy, dx) * (180 / Math.PI);

    // Calculate the delta angle
    let deltaAngle = currentAngle - startAngle;

    // Add to the initial rotation
    let newRotation = initialRotation + deltaAngle;

    // Normalize to 0-360
    newRotation = ((newRotation % 360) + 360) % 360;

    // Snap to 15-degree increments when holding Shift
    if (event.shiftKey) {
      newRotation = Math.round(newRotation / 15) * 15;
    }

    // Update draft with new rotation
    this.draftState.updateDraftRotation(this.widgetId, newRotation);
  }

  /**
   * Complete rotation on pointer up (shared with resize handler)
   */
  private handleRotationEnd(): void {
    if (!this.isRotating) return;

    const widget = this.displayWidget();
    
    // Clear rotation state
    this._isRotating.set(false);
    this.rotationStartState = null;

    // Commit rotation to store
    if (widget) {
      this.draftState.commitDraft(this.widgetId, { recordUndo: true });
    }
  }
  
  // ============================================
  // CONTENT CHANGE HANDLERS
  // ============================================
  
  onEditingChange(editing: boolean): void {
    if (editing) {
      this.uiState.startEditing(this.widgetId);
    } else {
      this.uiState.stopEditing(this.widgetId);
    }
  }
  
  /**
   * Handle content changes from child widgets
   */
  onContentChange(props: Partial<WidgetProps>): void {
    const currentWidget = this.displayWidget();
    if (!currentWidget) return;

    const nextProps = {
      ...currentWidget.props,
      ...props,
    } as WidgetProps;

    // Treat async "loading" transitions (imports / URL auto-load) as NON-undoable system updates.
    // Otherwise the user ends up with a broken undo step (e.g. undoing imported table data back to a placeholder).
    const touchesLoading =
      Object.prototype.hasOwnProperty.call(props as object, 'loading') ||
      Object.prototype.hasOwnProperty.call(props as object, 'loadingMessage');

    if (touchesLoading) {
      // If this widget was created via an undoable AddWidgetCommand (e.g. user-triggered import placeholder),
      // update the stored snapshot so redo re-adds the FINAL widget state, not the initial placeholder.
      const wasLoading = (currentWidget.props as any)?.loading === true;
      const nowLoaded = (props as any)?.loading === false;
      if (wasLoading && nowLoaded) {
        const { pageId: _pageId, ...withoutPageId } = currentWidget as unknown as WidgetEntity;
        const snapshot: WidgetModel = {
          ...(withoutPageId as unknown as WidgetModel),
          props: nextProps as any,
        };
        this.undoRedo.updateLastAddWidgetSnapshot(this.widgetId, snapshot);
      }

      this.store.dispatch(WidgetActions.updateOne({ id: this.widgetId, changes: { props: nextProps as any } }));
      return;
    }

    // Normal user edits should participate in undo/redo.
    this.documentService.updateWidget(this.pageId, this.widgetId, { props: nextProps as WidgetProps });
  }
  
  onChartPropsChange(props: Partial<any>): void {
    this.onContentChange(props);
  }

  /**
   * Handle connector geometry changes (position, size, and props together)
   * This is needed because connector endpoints affect the widget's bounding box.
   */
  onConnectorGeometryChange(
    change: { position: WidgetPosition; size: { width: number; height: number }; props: Partial<WidgetProps> },
    commit: boolean = true
  ): void {
    const currentWidget = this.displayWidget();
    if (!currentWidget) return;

    // Update draft during the gesture to avoid store churn.
    this.draftState.updateDraftFrame(this.widgetId, change.position, change.size);
    this.draftState.updateDraftProps(this.widgetId, change.props);

    // Commit once at the end of the gesture.
    if (commit) {
      this.draftState.commitDraft(this.widgetId, { recordUndo: true });
    }
  }

  private isLocalPointNearConnectorStroke(
    p: { x: number; y: number },
    widget: WidgetEntity
  ): boolean {
    const props = widget.props as any;
    const start = props?.startPoint;
    const end = props?.endPoint;
    if (!start || !end) return false;

    const shapeType = String(props?.shapeType ?? 'line');
    const control = props?.controlPoint ?? null;
    const strokeWidth = props?.stroke?.width ?? 2;
    const tolerance = Math.max(strokeWidth / 2, 1) + 8;

    // Straight
    const isElbow = shapeType.includes('elbow');
    const isCurved = shapeType.includes('curved') || shapeType.startsWith('s-') || shapeType.includes('s-connector');

    if (!isElbow && !isCurved) {
      return this.distancePointToSegment(p, start, end) <= tolerance;
    }

    if (isElbow) {
      const mid = { x: start.x, y: end.y };
      const d = Math.min(
        this.distancePointToSegment(p, start, mid),
        this.distancePointToSegment(p, mid, end)
      );
      return d <= tolerance;
    }

    if (control) {
      return this.distancePointToQuadratic(p, start, control, end) <= tolerance;
    }

    return this.distancePointToSegment(p, start, end) <= tolerance;
  }

  private distancePointToSegment(
    p: { x: number; y: number },
    a: { x: number; y: number },
    b: { x: number; y: number }
  ): number {
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const apx = p.x - a.x;
    const apy = p.y - a.y;
    const abLen2 = abx * abx + aby * aby;
    if (abLen2 <= 1e-6) {
      return Math.hypot(p.x - a.x, p.y - a.y);
    }
    let t = (apx * abx + apy * aby) / abLen2;
    t = Math.max(0, Math.min(1, t));
    const cx = a.x + t * abx;
    const cy = a.y + t * aby;
    return Math.hypot(p.x - cx, p.y - cy);
  }

  private distancePointToQuadratic(
    p: { x: number; y: number },
    p0: { x: number; y: number },
    p1: { x: number; y: number },
    p2: { x: number; y: number }
  ): number {
    const steps = 24;
    let min = Number.POSITIVE_INFINITY;
    let prev = p0;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const mt = 1 - t;
      const x = mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x;
      const y = mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y;
      const curr = { x, y };
      min = Math.min(min, this.distancePointToSegment(p, prev, curr));
      prev = curr;
    }
    return min;
  }

  /**
   * Calculate the tight bounding box for a connector.
   * For curved connectors, this calculates the actual curve bounds (not just control points).
   * 
   * For a quadratic bezier B(t) = (1-t)²P0 + 2(1-t)tP1 + t²P2, 
   * the extrema occur when dB/dt = 0, which gives t = (P0 - P1) / (P0 - 2P1 + P2)
   * 
   * @param strokeBuffer - Extra padding to account for stroke width (half of stroke width)
   */
  private calculateConnectorBounds(
    start: { x: number; y: number },
    end: { x: number; y: number },
    control: { x: number; y: number } | null,
    strokeBuffer: number = 0,
    shapeType?: string,
    props?: any
  ): { minX: number; minY: number; maxX: number; maxY: number } {
    // Start with endpoints
    let minX = Math.min(start.x, end.x);
    let maxX = Math.max(start.x, end.x);
    let minY = Math.min(start.y, end.y);
    let maxY = Math.max(start.y, end.y);

    if (shapeType && String(shapeType).includes('elbow')) {
      // Elbow connectors are rendered as an orthogonal polyline, not a bezier.
      // Bounds must be computed from the polyline points, otherwise resizing/positioning becomes jumpy.
      const pts = computeElbowPoints({
        start,
        end,
        control,
        startAnchor: props?.startAttachment?.anchor,
        endAnchor: props?.endAttachment?.anchor,
        stub: 30,
      }) as Array<{ x: number; y: number }>;

      for (const p of pts) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      }

      return {
        minX: minX - strokeBuffer,
        minY: minY - strokeBuffer,
        maxX: maxX + strokeBuffer,
        maxY: maxY + strokeBuffer,
      };
    }
    
    if (control) {
      // For quadratic bezier, find the extrema points on the curve
      // The derivative is: B'(t) = 2(1-t)(P1-P0) + 2t(P2-P1)
      // Setting to 0: t = (P0 - P1) / (P0 - 2*P1 + P2)
      
      // X extrema
      const denomX = start.x - 2 * control.x + end.x;
      if (Math.abs(denomX) > 0.0001) {
        const tX = (start.x - control.x) / denomX;
        if (tX > 0 && tX < 1) {
          // Point on curve at tX
          const x = (1 - tX) * (1 - tX) * start.x + 2 * (1 - tX) * tX * control.x + tX * tX * end.x;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
        }
      }
      
      // Y extrema
      const denomY = start.y - 2 * control.y + end.y;
      if (Math.abs(denomY) > 0.0001) {
        const tY = (start.y - control.y) / denomY;
        if (tY > 0 && tY < 1) {
          // Point on curve at tY
          const y = (1 - tY) * (1 - tY) * start.y + 2 * (1 - tY) * tY * control.y + tY * tY * end.y;
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }
    
    // Apply stroke buffer to ensure the stroke is fully within bounds
    return { 
      minX: minX - strokeBuffer, 
      minY: minY - strokeBuffer, 
      maxX: maxX + strokeBuffer, 
      maxY: maxY + strokeBuffer 
    };
  }

  // ============================================
  // CONNECTOR ENDPOINT DRAGGING
  // ============================================

  private connectorDragState: {
    endpoint: 'start' | 'end' | 'control';
    startPointer: { x: number; y: number };
    startWidgetPos: { x: number; y: number };
    startEndpoints: { start: { x: number; y: number }; end: { x: number; y: number }; control: { x: number; y: number } };
    snappedAnchor: AnchorAttachment | null; // Track current snap target
  } | null = null;

  onConnectorEndpointPointerDown(event: PointerEvent, endpoint: 'start' | 'end' | 'control'): void {
    event.preventDefault();
    event.stopPropagation();

    const widget = this.displayWidget();
    if (!widget || widget.type !== 'connector') return;

    const props = widget.props as any;
    const shapeType = String(props?.shapeType ?? '');
    const startPoint = props?.startPoint || { x: 0, y: 0 };
    const endPoint = props?.endPoint || { x: 0, y: 0 };

    // If this is an elbow connector and we don't yet have a stored control point,
    // seed one so the existing "drag midpoint" logic works consistently.
    // We use the same inverse formula used during dragging:
    // control = 2*midpoint - 0.5*(start + end)
    const hasControl = !!props?.controlPoint;
    const isElbow = shapeType.includes('elbow');
    const startDir = getAnchorDirection(props?.startAttachment?.anchor);
    const endDir = getAnchorDirection(props?.endAttachment?.anchor);
    const defaultElbowHandle = this.computeDefaultElbowHandle(startPoint, endPoint, startDir, endDir);
    const seededElbowControl = {
      x: 2 * defaultElbowHandle.x - 0.5 * (startPoint.x + endPoint.x),
      y: 2 * defaultElbowHandle.y - 0.5 * (startPoint.y + endPoint.y),
    };
    const controlPoint = (!hasControl && endpoint === 'control' && isElbow)
      ? seededElbowControl
      : (props?.controlPoint || { x: 0, y: 0 });

    this.connectorDragState = {
      endpoint,
      startPointer: { x: event.clientX, y: event.clientY },
      startWidgetPos: { ...widget.position },
      startEndpoints: {
        start: { ...startPoint },
        end: { ...endPoint },
        control: { ...controlPoint },
      },
      snappedAnchor: null,
    };

    // Notify that we're dragging a connector endpoint (shows anchors on other widgets)
    if (endpoint === 'start' || endpoint === 'end') {
      this.uiState.startDraggingConnectorEndpoint(this.widgetId, endpoint);
    }

    document.addEventListener('pointermove', this.onConnectorEndpointPointerMove);
    document.addEventListener('pointerup', this.onConnectorEndpointPointerUp);
  }

  private onConnectorEndpointPointerMove = (event: PointerEvent): void => {
    if (!this.connectorDragState) return;

    const widget = this.displayWidget();
    if (!widget) return;

    const dx = event.clientX - this.connectorDragState.startPointer.x;
    const dy = event.clientY - this.connectorDragState.startPointer.y;

    // Account for zoom
    const zoom = this.uiState.zoomLevel() / 100;
    const scaledDx = dx / zoom;
    const scaledDy = dy / zoom;

    // Convert stored local endpoints to absolute canvas coordinates
    const widgetX = this.connectorDragState.startWidgetPos.x;
    const widgetY = this.connectorDragState.startWidgetPos.y;

    let absStart = {
      x: widgetX + this.connectorDragState.startEndpoints.start.x,
      y: widgetY + this.connectorDragState.startEndpoints.start.y,
    };
    let absEnd = {
      x: widgetX + this.connectorDragState.startEndpoints.end.x,
      y: widgetY + this.connectorDragState.startEndpoints.end.y,
    };

    const props = widget.props as any;
    const shapeType = String(props?.shapeType ?? '');
    const isElbow = shapeType.includes('elbow');
    
    // Get stored bezier control point (may not exist for straight lines)
    const storedControl = this.connectorDragState.startEndpoints.control;
    const hasStoredControl = storedControl && (storedControl.x !== 0 || storedControl.y !== 0);
    let absControl = hasStoredControl ? {
      x: widgetX + storedControl.x,
      y: widgetY + storedControl.y,
    } : null;

    // For elbows, ensure we always have a control point so the handle/path/bounds stay consistent.
    if (isElbow && !absControl) {
      const startDir = getAnchorDirection(props?.startAttachment?.anchor);
      const endDir = getAnchorDirection(props?.endAttachment?.anchor);
      const defaultHandle = this.computeDefaultElbowHandle(absStart, absEnd, startDir, endDir);
      absControl = {
        x: 2 * defaultHandle.x - 0.5 * (absStart.x + absEnd.x),
        y: 2 * defaultHandle.y - 0.5 * (absStart.y + absEnd.y),
      };
    }

    // Track snap anchor for this drag
    let snappedAnchor: AnchorAttachment | null = null;

    // Apply the drag delta to the dragged endpoint
    if (this.connectorDragState.endpoint === 'start') {
      absStart = { x: absStart.x + scaledDx, y: absStart.y + scaledDy };
      // Update drag position for anchor proximity detection
      this.uiState.updateConnectorEndpointDragPosition(absStart.x, absStart.y);
      
      // Check for snap to anchor
      const nearestAnchor = this.connectorAnchorService.findNearestAnchor(
        this.pageId, absStart, this.widgetId
      );
      if (nearestAnchor) {
        // Snap to anchor position
        absStart = { x: nearestAnchor.x, y: nearestAnchor.y };
        snappedAnchor = { widgetId: nearestAnchor.widgetId, anchor: nearestAnchor.anchor };
      }
    } else if (this.connectorDragState.endpoint === 'end') {
      absEnd = { x: absEnd.x + scaledDx, y: absEnd.y + scaledDy };
      // Update drag position for anchor proximity detection
      this.uiState.updateConnectorEndpointDragPosition(absEnd.x, absEnd.y);
      
      // Check for snap to anchor
      const nearestAnchor = this.connectorAnchorService.findNearestAnchor(
        this.pageId, absEnd, this.widgetId
      );
      if (nearestAnchor) {
        // Snap to anchor position
        absEnd = { x: nearestAnchor.x, y: nearestAnchor.y };
        snappedAnchor = { widgetId: nearestAnchor.widgetId, anchor: nearestAnchor.anchor };
      }
    } else if (this.connectorDragState.endpoint === 'control') {
      if (isElbow) {
        // Elbow connector: the handle is a bend point on the orthogonal polyline.
        // We store elbow control in the same format as curves so we can reuse
        // the existing persistence + drag math.
        const currentHandle = absControl
          ? {
              x: 0.25 * absStart.x + 0.5 * absControl.x + 0.25 * absEnd.x,
              y: 0.25 * absStart.y + 0.5 * absControl.y + 0.25 * absEnd.y,
            }
          : { x: absStart.x, y: absEnd.y };

        const newHandle = {
          x: currentHandle.x + scaledDx,
          y: currentHandle.y + scaledDy,
        };

        // control = 2*handle - 0.5*(start + end)
        absControl = {
          x: 2 * newHandle.x - 0.5 * (absStart.x + absEnd.x),
          y: 2 * newHandle.y - 0.5 * (absStart.y + absEnd.y),
        };
      } else {
        // Curved connector: handle is ON the curve at t=0.5
        let currentMidpoint: { x: number; y: number };
        if (absControl) {
          currentMidpoint = {
            x: 0.25 * absStart.x + 0.5 * absControl.x + 0.25 * absEnd.x,
            y: 0.25 * absStart.y + 0.5 * absControl.y + 0.25 * absEnd.y,
          };
        } else {
          currentMidpoint = {
            x: (absStart.x + absEnd.x) / 2,
            y: (absStart.y + absEnd.y) / 2,
          };
        }

        const newMidpoint = {
          x: currentMidpoint.x + scaledDx,
          y: currentMidpoint.y + scaledDy,
        };

        absControl = {
          x: 2 * newMidpoint.x - 0.5 * (absStart.x + absEnd.x),
          y: 2 * newMidpoint.y - 0.5 * (absStart.y + absEnd.y),
        };
      }
    }

    // Minimal visual buffer so the *entire rendered stroke* (and arrowhead) stays inside bounds.
    const strokeWidth = props?.stroke?.width ?? 2;
    const hasArrow = Boolean(props?.arrowStart || props?.arrowEnd || shapeType.includes('arrow'));
    const arrowBuffer = hasArrow ? 10 : 0; // matches ConnectorWidgetComponent arrowLength
    const visualBuffer = Math.max(strokeWidth / 2, 1) + arrowBuffer + 3; // +2px extra ease

    // Compute bounding box - for curves, calculate actual curve bounds (not control point)
    const curveBounds = this.calculateConnectorBounds(absStart, absEnd, absControl, visualBuffer, shapeType, props);
    
    const newPosition = { x: curveBounds.minX, y: curveBounds.minY };
    const newSize = { 
      width: Math.max(curveBounds.maxX - curveBounds.minX, 1), 
      height: Math.max(curveBounds.maxY - curveBounds.minY, 1) 
    };

    // Convert absolute endpoints back to local coordinates relative to new position
    const newStartPoint = { x: absStart.x - curveBounds.minX, y: absStart.y - curveBounds.minY };
    const newEndPoint = { x: absEnd.x - curveBounds.minX, y: absEnd.y - curveBounds.minY };
    const newControlPoint = absControl ? { x: absControl.x - curveBounds.minX, y: absControl.y - curveBounds.minY } : undefined;

    // Track the snapped anchor for saving on pointer up
    this.connectorDragState.snappedAnchor = snappedAnchor;

    // Update the widget
    this.onConnectorGeometryChange({
      position: newPosition,
      size: newSize,
      props: {
        startPoint: newStartPoint,
        endPoint: newEndPoint,
        controlPoint: newControlPoint,
      },
    }, false);
  };

  private onConnectorEndpointPointerUp = (): void => {
    // Save attachment info if we snapped to an anchor
    let didUpdate = false;
    if (this.connectorDragState?.snappedAnchor) {
      const endpoint = this.connectorDragState.endpoint;
      const attachment = this.connectorDragState.snappedAnchor;
      
      // Get current widget to update attachment props
      const widget = this.displayWidget();
      if (widget && (endpoint === 'start' || endpoint === 'end')) {
        const props = widget.props as any;
        const attachmentKey = endpoint === 'start' ? 'startAttachment' : 'endAttachment';
        
        // Save attachment to connector props
        this.onConnectorGeometryChange({
          position: widget.position,
          size: widget.size,
          props: {
            ...props,
            [attachmentKey]: attachment,
          },
        }, false);
        didUpdate = true;
      }
    } else if (this.connectorDragState) {
      // Clear attachment if not snapped to anchor
      const endpoint = this.connectorDragState.endpoint;
      const widget = this.displayWidget();
      if (widget && (endpoint === 'start' || endpoint === 'end')) {
        const props = widget.props as any;
        const attachmentKey = endpoint === 'start' ? 'startAttachment' : 'endAttachment';
        
        // Clear attachment from connector props
        if (props[attachmentKey]) {
          this.onConnectorGeometryChange({
            position: widget.position,
            size: widget.size,
            props: {
              ...props,
              [attachmentKey]: null,
            },
          }, false);
          didUpdate = true;
        }
      }
    }

    if (didUpdate || this.draftState.hasDraft(this.widgetId)) {
      this.draftState.commitDraft(this.widgetId, { recordUndo: true });
    }
    
    this.connectorDragState = null;
    // Stop showing anchors on other widgets
    this.uiState.stopDraggingConnectorEndpoint();
    document.removeEventListener('pointermove', this.onConnectorEndpointPointerMove);
    document.removeEventListener('pointerup', this.onConnectorEndpointPointerUp);
  };
  
  // ============================================
  // DELETE HANDLING
  // ============================================
  
  onDeleteClick(event: MouseEvent | PointerEvent): void {
    event.stopPropagation();
    event.preventDefault();

    this.deleteWidgetInternal();
  }

  onWidgetContextMenu(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();

    if (this.isResizing || this.isRotating) return;

    // Right-click should select the widget first (unless it's already part of a multi-selection).
    if (!this.isSelected) {
      this.uiState.selectWidget(this.widgetId);
    }

    this.contextMenuX = event.clientX;
    this.contextMenuY = event.clientY;
    this.contextMenuOpen = true;
  }

  onContextMenuItemSelected(actionId: string): void {
    this.contextMenuOpen = false;
    const selectedIds = this.getSelectedIdsForPage();
    const isMulti = selectedIds.length > 1;

    switch (actionId) {
      case 'delete':
        queueMicrotask(() => this.deleteWidgetInternal(selectedIds));
        break;
      case 'cut':
        queueMicrotask(() => {
          if (this.isDocumentLocked) return;
          if (isMulti) {
            this.documentService.cutWidgets(this.pageId, selectedIds);
          } else {
            this.documentService.cutWidget(this.pageId, selectedIds[0]);
          }
          this.uiState.clearSelection();
        });
        break;
      case 'copy':
        if (isMulti) {
          this.documentService.copyWidgets(this.pageId, selectedIds);
        } else {
          this.documentService.copyWidget(this.pageId, selectedIds[0]);
        }
        break;
      case 'paste':
        queueMicrotask(() => {
          if (this.isDocumentLocked) return;
          const pasted = this.documentService.pasteWidgets(this.pageId);
          if (pasted.length > 0) {
            // Select all pasted widgets
            this.uiState.selectMultiple(pasted);
          }
        });
        break;
    }
  }

  private deleteWidgetInternal(widgetIds?: string[]): void {
    if (this.isDocumentLocked) {
      return;
    }

    const ids = widgetIds && widgetIds.length > 0 ? widgetIds : this.getSelectedIdsForPage();
    if (ids.length === 0) return;

    // Discard any drafts for these widgets
    for (const id of ids) {
      this.draftState.discardDraft(id);
    }

    // Use batch delete for single undo operation
    if (ids.length > 1) {
      this.documentService.deleteWidgets(this.pageId, ids);
    } else {
      this.documentService.deleteWidget(this.pageId, ids[0]);
    }

    // Clear selection
    this.uiState.clearSelection();
  }

  private getSelectedIdsForPage(): string[] {
    const selected = Array.from(this.uiState.selectedWidgetIds());
    return selected.length > 0 ? selected : [this.widgetId];
  }
  
  // ============================================
  // HELPERS
  // ============================================
  
  private clampFrame(
    width: number,
    height: number,
    x: number,
    y: number,
    minWidth: number,
    minHeight: number
  ): WidgetFrame {
    let newWidth = width;
    let newHeight = height;
    let newX = x;
    let newY = y;
    
    if (newWidth < minWidth) {
      if (this.activeHandle === 'left' ||
          this.activeHandle === 'corner' ||
          this.activeHandle === 'corner-top-left' ||
          this.activeHandle === 'corner-bottom-left') {
        newX -= minWidth - newWidth;
      }
      newWidth = minWidth;
    }
    
    if (newHeight < minHeight) {
      if (this.activeHandle === 'top' ||
          this.activeHandle === 'corner-top-right' ||
          this.activeHandle === 'corner-top-left') {
        newY -= minHeight - newHeight;
      }
      newHeight = minHeight;
    }
    
    return { width: newWidth, height: newHeight, x: newX, y: newY };
  }

  private computeResizeMinConstraints(widget: WidgetEntity | null): { minWidth: number; minHeight: number } {
    // Keep a usable minimum for text-like widgets (matches rich text feel).
    const baseMinWidth = 20;
    const baseMinHeight = 20;
    if (!widget) return { minWidth: baseMinWidth, minHeight: baseMinHeight };

    // Policy-driven min constraints.
    const policy = getWidgetInteractionPolicy(widget);
    if (policy.preferredHeightPx != null) {
      return { minWidth: 40, minHeight: policy.preferredHeightPx };
    }

    if (widget.type === 'text' || widget.type === 'editastra') {
      // Text-like widgets should not collapse below a caret-friendly baseline.
      // For editastra: additionally clamp to content-min-height from DOM (table-like behavior).
      const baseMinH = widget.type === 'editastra' ? 24 : 50;
      const domMinH = widget.type === 'editastra' ? this.readEditastraMinHeightPxFromDom() : null;
      const contentMinH = domMinH ?? baseMinH;
      return { minWidth: 80, minHeight: Math.max(baseMinH, contentMinH) };
    }

    if (widget.type === 'table') {
      // PPT-like behavior: prevent shrinking a table widget below the minimum size required
      // to keep all currently-visible content visible. If content is already clipped,
      // we do NOT clamp (user is already in an overflow state).
      const currentH = this.frame.height;
      const domMinH = this.readTableMinHeightPxFromDom();
      const computedMinH = this.computeTableMinHeightPx(currentH);

      // Prefer the table widget's own min-height attribute when it is usable AND we're not already clipped.
      // If the content is already clipped at the current height, do not clamp (allow free resize).
      const safeDomMinH =
        domMinH !== null && Number.isFinite(domMinH) && domMinH > 0 && domMinH <= currentH + 1 ? domMinH : null;
      const contentMinH = safeDomMinH ?? computedMinH ?? 20;
      return { minWidth: baseMinWidth, minHeight: Math.max(baseMinHeight, contentMinH) };
    }

    return { minWidth: baseMinWidth, minHeight: baseMinHeight };
  }

  private readTableMinHeightPxFromDom(): number | null {
    const root = this.hostRef.nativeElement;
    const tableEl = root.querySelector('.table-widget[data-tw-min-height]') as HTMLElement | null;
    const raw = tableEl?.getAttribute('data-tw-min-height') ?? '';
    const v = Number(raw);
    return Number.isFinite(v) && v > 0 ? v : null;
  }

  private readEditastraMinHeightPxFromDom(): number | null {
    const root = this.hostRef.nativeElement;
    const el = root.querySelector('.editastra-widget[data-ew-min-height]') as HTMLElement | null;
    const raw = el?.getAttribute('data-ew-min-height') ?? '';
    const v = Number(raw);
    return Number.isFinite(v) && v > 0 ? v : null;
  }

  /**
   * Compute the minimum widget height (layout px) for the current table content so that
   * shrinking further would start clipping text.
   *
   * If any cell is already overflowing at the current size, returns the base minimum (no clamp),
   * because the user is already in a clipped state and should still be able to resize freely.
   */
  private computeTableMinHeightPx(currentTableHeightPx: number): number {
    const baseMin = 20;
    const tableHeight = Number.isFinite(currentTableHeightPx) ? currentTableHeightPx : 0;
    if (tableHeight <= 0) return baseMin;

    const root = this.hostRef.nativeElement;
    const leafEls = Array.from(root.querySelectorAll('.table-widget__cell-editor[data-leaf]')) as HTMLElement[];
    if (leafEls.length === 0) return baseMin;

    const zoomScale = Math.max(0.1, this.uiState.zoomLevel() / 100);

    let hasOverflow = false;
    let minRequiredTableH = 0;

    for (const leafEl of leafEls) {
      const clipEl =
        (leafEl.closest('.table-widget__sub-cell') as HTMLElement | null) ??
        (leafEl.closest('.table-widget__cell') as HTMLElement | null) ??
        leafEl;

      let visibleH = clipEl.clientHeight;
      if (!Number.isFinite(visibleH) || visibleH <= 0) {
        visibleH = clipEl.getBoundingClientRect().height / zoomScale;
      }

      const neededH = Math.max(
        leafEl.scrollHeight || 0,
        leafEl.offsetHeight || 0,
        leafEl.getBoundingClientRect().height / zoomScale || 0
      );

      if (!Number.isFinite(visibleH) || !Number.isFinite(neededH) || visibleH <= 0 || neededH <= 0) continue;

      if (neededH - visibleH > 1) {
        hasOverflow = true;
        break;
      }

      const p = visibleH / tableHeight;
      const eps = 0.02;
      const required = neededH / Math.max(eps, p);
      if (Number.isFinite(required) && required > minRequiredTableH) {
        minRequiredTableH = required;
      }
    }

    if (hasOverflow) return baseMin;
    // Round up slightly to avoid 1px oscillation due to sub-pixel layout.
    return Math.max(baseMin, Math.ceil(minRequiredTableH));
  }
}
