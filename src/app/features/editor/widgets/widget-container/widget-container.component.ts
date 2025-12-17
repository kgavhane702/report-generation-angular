import {
  ChangeDetectionStrategy,
  Component,
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
import { CdkDragEnd } from '@angular/cdk/drag-drop';

import { WidgetPosition, WidgetProps } from '../../../../models/widget.model';
import { PageSize } from '../../../../models/document.model';
import { DocumentService } from '../../../../core/services/document.service';
import { DraftStateService } from '../../../../core/services/draft-state.service';
import { UIStateService } from '../../../../core/services/ui-state.service';
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
  private resizeStart?: {
    width: number;
    height: number;
    pointerX: number;
    pointerY: number;
    positionX: number;
    positionY: number;
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
      });
  }
  
  ngOnDestroy(): void {
    // Clean up subscription
    this.widgetSubscription?.unsubscribe();
    
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
  
  onDragEnded(event: CdkDragEnd): void {
    const position = event.source.getFreeDragPosition();
    const newPosition: WidgetPosition = {
      x: this.frame.x + position.x,
      y: this.frame.y + position.y,
    };
    
    // Update draft and immediately commit
    this.draftState.updateDraftPosition(this.widgetId, newPosition);
    this.draftState.commitDraft(this.widgetId);
    
    // Stop drag tracking
    this.uiState.stopDragging();
    
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
    
    this.resizeStart = {
      width: this.frame.width,
      height: this.frame.height,
      pointerX: event.clientX,
      pointerY: event.clientY,
      positionX: this.frame.x,
      positionY: this.frame.y,
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
    const frame = this.clampFrame(nextWidth, nextHeight, nextX, nextY);
    this._previewFrame.set(frame);
  }
  
  @HostListener('document:pointerup', ['$event'])
  onResizePointerUp(event: PointerEvent): void {
    if (!this.isResizing) {
      return;
    }
    
    // Get the final frame
    const finalFrame = this._previewFrame();
    
    // Clear resize state
    this.uiState.stopResizing();
    this.activeHandle = null;
    this.resizeStart = undefined;
    this._previewFrame.set(null);
    
    // NOW commit to store (only once, at the end)
    if (finalFrame) {
      this.draftState.updateDraftFrame(
        this.widgetId,
        { x: finalFrame.x, y: finalFrame.y },
        { width: finalFrame.width, height: finalFrame.height }
      );
      this.draftState.commitDraft(this.widgetId);
    }
  }
  
  // ============================================
  // CONTENT CHANGE HANDLERS
  // ============================================
  
  onEditingChange(editing: boolean): void {
    if (editing) {
      this.uiState.startEditing(this.widgetId);
    } else {
      this.uiState.stopEditing();
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
  
  onAdvancedTableCellDataChange(cellData: string[][]): void {
    const currentWidget = this.displayWidget();
    if (!currentWidget) return;
    
    this.documentService.updateWidget(this.pageId, this.widgetId, {
      props: {
        ...currentWidget.props,
        cellData,
      } as any,
    });
  }
  
  onAdvancedTableCellStylesChange(cellStyles: Record<string, any>): void {
    const currentWidget = this.displayWidget();
    if (!currentWidget) return;
    
    this.documentService.updateWidget(this.pageId, this.widgetId, {
      props: {
        ...currentWidget.props,
        cellStyles,
      } as any,
    });
  }
  
  onAdvancedTableStructureChange(structure: {
    rows: number;
    columns: number;
    cellData: string[][];
    cellStyles: Record<string, any>;
    mergedCells?: Record<string, { rowspan: number; colspan: number }>;
  }): void {
    const currentWidget = this.displayWidget();
    if (!currentWidget) return;
    
    this.documentService.updateWidget(this.pageId, this.widgetId, {
      props: {
        ...currentWidget.props,
        rows: structure.rows,
        columns: structure.columns,
        cellData: structure.cellData,
        cellStyles: structure.cellStyles,
        mergedCells: structure.mergedCells,
      } as any,
    });
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
  
  private clampFrame(width: number, height: number, x: number, y: number): WidgetFrame {
    const minWidth = 20;
    const minHeight = 20;
    
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
}
