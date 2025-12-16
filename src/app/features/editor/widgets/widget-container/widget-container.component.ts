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
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { CdkDragEnd } from '@angular/cdk/drag-drop';

import { WidgetModel, WidgetPosition, WidgetProps } from '../../../../models/widget.model';
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
 * REFACTORED to use the new architecture:
 * 1. Takes widgetId as input instead of full widget object
 * 2. Selects widget data using granular selector (only updates when THIS widget changes)
 * 3. Uses DraftStateService for in-progress changes (resize, drag)
 * 4. Only commits to store when interaction completes
 * 
 * This prevents:
 * - Widget re-renders when other widgets change
 * - Interrupted resize/drag operations
 * - Focus loss during text editing
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
   * This is the key change: we pass ID, not the full object
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
  
  /**
   * Legacy input for backward compatibility during migration
   * @deprecated Use widgetId instead
   */
  @Input() widget?: WidgetModel;
  
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
   * Computed signal that merges persisted data with any draft changes
   * This is what the template uses for rendering
   */
  readonly displayWidget = computed<WidgetEntity | null>(() => {
    const persisted = this.persistedWidget();
    if (!persisted) {
      // Fall back to legacy input during migration
      if (this.widget) {
        return {
          ...this.widget,
          pageId: this.pageId,
        } as WidgetEntity;
      }
      return null;
    }
    
    // Merge with draft if exists
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
    this.subscribeToWidgetData();
  }
  
  ngOnDestroy(): void {
    // Commit any pending drafts before destroying
    if (this.draftState.hasDraft(this.widgetId)) {
      this.draftState.commitDraft(this.widgetId);
    }
  }
  
  private subscribeToWidgetData(): void {
    // Use the granular selector - this only emits when THIS widget changes
    const effectiveWidgetId = this.widgetId || this.widget?.id;
    if (!effectiveWidgetId) return;
    
    this.store.select(DocumentSelectors.selectWidgetById(effectiveWidgetId))
      .subscribe(widget => {
        this.persistedWidget.set(widget);
      });
  }
  
  // ============================================
  // DRAG HANDLING
  // ============================================
  
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
   * This uses draft state to batch changes
   */
  onContentChange(props: Partial<WidgetProps>): void {
    const currentWidget = this.displayWidget();
    if (!currentWidget) return;
    
    // Update via document service for undo support
    this.documentService.updateWidget(this.subsectionId, this.pageId, this.widgetId, {
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
    
    this.documentService.updateWidget(this.subsectionId, this.pageId, this.widgetId, {
      props: {
        ...currentWidget.props,
        cellData,
      } as any,
    });
  }
  
  onAdvancedTableCellStylesChange(cellStyles: Record<string, any>): void {
    const currentWidget = this.displayWidget();
    if (!currentWidget) return;
    
    this.documentService.updateWidget(this.subsectionId, this.pageId, this.widgetId, {
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
    
    this.documentService.updateWidget(this.subsectionId, this.pageId, this.widgetId, {
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
    this.documentService.deleteWidget(this.subsectionId, this.pageId, this.widgetId);
    
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
