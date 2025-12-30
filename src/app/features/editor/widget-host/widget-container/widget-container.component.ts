import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostBinding,
  HostListener,
  Input,
  OnInit,
  OnDestroy,
  computed,
  inject,
  signal,
} from '@angular/core';
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
import { AppState } from '../../../../store/app.state';
import { DocumentSelectors } from '../../../../store/document/document.selectors';
import { WidgetEntity } from '../../../../store/document/document.state';

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
  private readonly hostRef = inject(ElementRef<HTMLElement>);
  
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
  private resizeStart?: {
    width: number;
    height: number;
    pointerX: number;
    pointerY: number;
    positionX: number;
    positionY: number;
    minWidth: number;
    minHeight: number;
  };
  
  /** Local preview frame for smooth resize without store updates */
  private readonly _previewFrame = signal<WidgetFrame | null>(null);
  
  // ============================================
  // COMPUTED PROPERTIES
  // ============================================
  
  @HostBinding('class.widget-container--selected')
  get isSelected(): boolean {
    return this.uiState.activeWidgetId() === this.widgetId;
  }
  
  get isEditing(): boolean {
    return this.uiState.isEditing(this.widgetId);
  }
  
  get isResizing(): boolean {
    return this.uiState.isResizing(this.widgetId);
  }
  
  get calculatedZIndex(): number {
    const baseZIndex = 2000;
    const widget = this.displayWidget();
    return baseZIndex + (widget?.zIndex ?? 1);
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
    // Subscribe to widget data using granular selector
    // This ONLY emits when THIS widget's data changes in the store
    this.widgetSubscription = this.store
      .select(DocumentSelectors.selectWidgetById(this.widgetId))
      .subscribe(widget => {
        this.persistedWidget.set(widget);

        // If the widget is removed (e.g., via undo), ensure we don't leave UI in a stuck "editing" state.
        // Otherwise global shortcuts like Ctrl+Y can be blocked because UIState still thinks we're editing.
        if (!widget && this.uiState.isEditing(this.widgetId)) {
          this.uiState.stopEditing(this.widgetId);
        }

        // Auto-load URL-based widgets (non-blocking) after document import/open.
        if (widget) {
          this.remoteAutoLoad.maybeAutoLoad(widget, this.pageId);
        }
      });
  }
  
  ngOnDestroy(): void {
    // Clean up subscription
    this.widgetSubscription?.unsubscribe();

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
    if (!this.isSelected) {
      this.uiState.selectWidget(this.widgetId);
    }
    
    // Start drag tracking - CDK Drag will handle its own pointer capture
    this.uiState.startDragging(this.widgetId);
  }

  onDragStarted(event: CdkDragStart): void {
    // Capture starting frame so we can compute an absolute frame during drag moves.
    this.dragStartFrame = { ...this.frame };
    this.guides.start(this.pageId, this.widgetId, 'drag');
  }

  onDragMoved(event: CdkDragMove): void {
    if (!this.dragStartFrame) return;

    const dx = event.distance?.x ?? 0;
    const dy = event.distance?.y ?? 0;

    const rawFrame: WidgetFrame = {
      x: this.dragStartFrame.x + dx,
      y: this.dragStartFrame.y + dy,
      width: this.dragStartFrame.width,
      height: this.dragStartFrame.height,
    };

    // IMPORTANT: Guides must be "virtual" and must not interfere with CDK drag.
    // We only update the guides overlay here (no snapping / no drag position mutation).
    this.guides.updateDrag(this.pageId, this.widgetId, rawFrame, this.pageWidth, this.pageHeight);
  }
  
  onDragEnded(event: CdkDragEnd): void {
    const position = event.source.getFreeDragPosition();

    const rawFrame: WidgetFrame = {
      x: this.frame.x + position.x,
      y: this.frame.y + position.y,
      width: this.frame.width,
      height: this.frame.height,
    };

    // If snapping is enabled, apply it at the end only (no mid-gesture interference).
    const finalFrame = this.uiState.guidesSnapEnabled()
      ? this.guides.updateDrag(this.pageId, this.widgetId, rawFrame, this.pageWidth, this.pageHeight)
      : rawFrame;

    const newPosition: WidgetPosition = { x: finalFrame.x, y: finalFrame.y };
    
    // Update draft and immediately commit
    this.draftState.updateDraftPosition(this.widgetId, newPosition);
    this.draftState.commitDraft(this.widgetId, { recordUndo: true });
    
    // Stop drag tracking
    this.uiState.stopDragging();
    this.guides.end(this.widgetId);
    this.dragStartFrame = null;
    
    event.source.reset();
  }
  
  onWidgetPointerDown(): void {
    this.uiState.selectWidget(this.widgetId);
  }
  
  // ============================================
  // RESIZE HANDLING
  // ============================================
  
  onResizePointerDown(event: PointerEvent, handle: ResizeHandle): void {
    if (!this.isSelected) {
      return;
    }
    
    event.stopPropagation();
    
    // Start resize tracking
    this.uiState.startResizing(this.widgetId);
    this.activeHandle = handle;
    this.guides.start(this.pageId, this.widgetId, 'resize', handle);

    const widget = this.displayWidget();
    const { minWidth, minHeight } = this.computeResizeMinConstraints(widget);
    
    this.resizeStart = {
      width: this.frame.width,
      height: this.frame.height,
      pointerX: event.clientX,
      pointerY: event.clientY,
      positionX: this.frame.x,
      positionY: this.frame.y,
      minWidth,
      minHeight,
    };
    
    // Initialize preview frame
    this._previewFrame.set({ ...this.frame });
    
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  }
  
  @HostListener('document:pointermove', ['$event'])
  onResizePointerMove(event: PointerEvent): void {
    if (!this.isResizing || !this.resizeStart || !this.activeHandle) {
      return;
    }
    
    event.preventDefault();
    
    const deltaX = event.clientX - this.resizeStart.pointerX;
    const deltaY = event.clientY - this.resizeStart.pointerY;
    
    let nextWidth = this.resizeStart.width;
    let nextHeight = this.resizeStart.height;
    let nextX = this.resizeStart.positionX;
    let nextY = this.resizeStart.positionY;
    
    switch (this.activeHandle) {
      case 'right':
        nextWidth = this.resizeStart.width + deltaX;
        break;
      case 'bottom':
        nextHeight = this.resizeStart.height + deltaY;
        break;
      case 'corner':
        nextWidth = this.resizeStart.width + deltaX;
        nextHeight = this.resizeStart.height + deltaY;
        break;
      case 'corner-top-right':
        nextWidth = this.resizeStart.width + deltaX;
        nextHeight = this.resizeStart.height - deltaY;
        nextY = this.resizeStart.positionY + deltaY;
        break;
      case 'corner-top-left':
        nextWidth = this.resizeStart.width - deltaX;
        nextHeight = this.resizeStart.height - deltaY;
        nextX = this.resizeStart.positionX + deltaX;
        nextY = this.resizeStart.positionY + deltaY;
        break;
      case 'corner-bottom-left':
        nextWidth = this.resizeStart.width - deltaX;
        nextHeight = this.resizeStart.height + deltaY;
        nextX = this.resizeStart.positionX + deltaX;
        break;
      case 'left':
        nextWidth = this.resizeStart.width - deltaX;
        nextX = this.resizeStart.positionX + deltaX;
        break;
      case 'top':
        nextHeight = this.resizeStart.height - deltaY;
        nextY = this.resizeStart.positionY + deltaY;
        break;
    }
    
    // Clamp and set preview frame (LOCAL state only, no store update!)
    //
    // IMPORTANT: For tables, the true minimum height is computed asynchronously (after DOM updates).
    // If we only capture minHeight once on pointerdown, the *first* resize attempt may feel broken:
    // the first drag "calculates" and the second drag works.
    // Fix: recompute min constraints live during the drag so the first drag uses the latest value.
    const widget = this.displayWidget();
    const live = this.computeResizeMinConstraints(widget);
    const frame = this.clampFrame(nextWidth, nextHeight, nextX, nextY, live.minWidth, live.minHeight);

    // Keep resize behavior unchanged during the gesture; guides are visual only.
    this._previewFrame.set(frame);
    this.guides.updateResize(this.pageId, this.widgetId, frame, this.pageWidth, this.pageHeight, this.activeHandle);
  }
  
  @HostListener('document:pointerup', ['$event'])
  onResizePointerUp(event: PointerEvent): void {
    if (!this.isResizing) {
      return;
    }
    
    // Get the final frame (visual preview)
    const previewFrame = this._previewFrame();
    const handle = this.activeHandle;
    
    // Clear resize state
    this.uiState.stopResizing();
    this.guides.end(this.widgetId);
    this.activeHandle = null;
    this.resizeStart = undefined;
    this._previewFrame.set(null);
    
    // NOW commit to store (only once, at the end)
    if (previewFrame) {
      // If snapping is enabled, apply it at the end only.
      const finalFrame = this.uiState.guidesSnapEnabled() && handle
        ? this.guides.updateResize(this.pageId, this.widgetId, previewFrame, this.pageWidth, this.pageHeight, handle)
        : previewFrame;

      this.draftState.updateDraftFrame(this.widgetId, { x: finalFrame.x, y: finalFrame.y }, { width: finalFrame.width, height: finalFrame.height });
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
    
    // Update via document service for undo support
    this.documentService.updateWidget(this.pageId, this.widgetId, {
      props: {
        ...currentWidget.props,
        ...props,
      } as WidgetProps,
    });
  }
  
  onChartPropsChange(props: Partial<any>): void {
    this.onContentChange(props);
  }
  
  // ============================================
  // DELETE HANDLING
  // ============================================
  
  onDeleteClick(event: MouseEvent | PointerEvent): void {
    event.stopPropagation();
    event.preventDefault();
    
    // Discard any drafts for this widget
    this.draftState.discardDraft(this.widgetId);
    
    // Delete the widget
    this.documentService.deleteWidget(this.pageId, this.widgetId);
    
    // Clear selection
    this.uiState.selectWidget(null);
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

    if (widget.type === 'text' || widget.type === 'editastra') {
      // Rich text widgets should not collapse to tiny sizes where editing becomes impossible.
      return { minWidth: 80, minHeight: 50 };
    }

    if (widget.type === 'table') {
      // PPT-like behavior: prevent shrinking a table widget below the minimum size required
      // to keep all currently-visible content visible. If content is already clipped,
      // we do NOT clamp (user is already in an overflow state).
      const currentH = this.frame.height;
      const domMinH = this.readTableMinHeightPxFromDom();
      // If the table hasn't computed its min height yet (first interaction / immediately after style changes),
      // do NOT block the first drag. We'll pick up the DOM-provided value as soon as it's available.
      const contentMinH = domMinH ?? 20;
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
