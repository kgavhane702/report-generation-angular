import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostBinding,
  HostListener,
  Input,
  OnInit,
  OnDestroy,
  ViewChild,
  effect,
  inject,
} from '@angular/core';
import { CdkDragEnd } from '@angular/cdk/drag-drop';
import { Subject, Subscription, firstValueFrom } from 'rxjs';
import { debounceTime, distinctUntilChanged, skip, take, timeout } from 'rxjs/operators';

import { WidgetModel } from '../../../../models/widget.model';
import { PageSize, DocumentModel } from '../../../../models/document.model';
import { DocumentService } from '../../../../core/services/document.service';
import { EditorStateService } from '../../../../core/services/editor-state.service';
import { WidgetSaveService } from '../../../../core/services/widget-save.service';

type ResizeHandle = 'right' | 'bottom' | 'corner' | 'corner-top-right' | 'corner-top-left' | 'corner-bottom-left' | 'left' | 'top';

@Component({
  selector: 'app-widget-container',
  templateUrl: './widget-container.component.html',
  styleUrls: ['./widget-container.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetContainerComponent implements OnInit, OnDestroy {
  @Input({ required: true }) widget!: WidgetModel;
  @Input({ required: true }) pageSize!: PageSize;
  @Input({ required: true }) pageId!: string;
  @Input({ required: true }) subsectionId!: string;
  @Input({ required: true }) pageWidth!: number;
  @Input({ required: true }) pageHeight!: number;
  @Input() dragBoundarySelector = '';

  @ViewChild('textWidget') textWidget?: any;
  @ViewChild('chartWidget') chartWidget?: any;
  @ViewChild('tableWidget') tableWidget?: any;
  @ViewChild('imageWidget') imageWidget?: any;

  isEditing = false;
  isResizing = false;
  protected readonly editorState = inject(EditorStateService);
  private activeHandle: ResizeHandle | null = null;
  private resizeStart?: {
    width: number;
    height: number;
    pointerX: number;
    pointerY: number;
    positionX: number;
    positionY: number;
  };
  private previewFrame: WidgetFrame | null = null;
  private pendingPosition: { x: number; y: number } | null = null;
  private pendingSize: { width: number; height: number } | null = null;
  private savedFrame: WidgetFrame | null = null; // Store the saved frame to prevent flicker
  private lastDocumentReference: DocumentModel | null = null; // Track document reference to detect changes
  
  // RxJS Subjects for debounced auto-save
  private dragSaveSubject = new Subject<void>();
  private resizeSaveSubject = new Subject<void>();
  private subscriptions = new Subscription();
  private readonly widgetSaveService = inject(WidgetSaveService);

  constructor(
    private readonly documentService: DocumentService,
    private readonly cdr: ChangeDetectorRef
  ) {
    effect(() => {
      this.editorState.activeWidgetId();
      this.cdr.markForCheck();
    });

    // Setup debounced auto-save for drag
    this.subscriptions.add(
      this.dragSaveSubject.pipe(
        debounceTime(300),
        distinctUntilChanged()
      ).subscribe(() => {
        this.autoSaveAfterDrag();
      })
    );

    // Setup debounced auto-save for resize
    this.subscriptions.add(
      this.resizeSaveSubject.pipe(
        debounceTime(300),
        distinctUntilChanged()
      ).subscribe(() => {
        this.autoSaveAfterResize();
      })
    );

    // Listen for global save all request (before adding new widget)
    this.subscriptions.add(
      this.widgetSaveService.saveAll$.subscribe(() => {
        this.savePendingChangesImmediately();
      })
    );
  }

  ngOnInit(): void {
    // Register this widget container with the save service
    // Widget is guaranteed to be available in ngOnInit
    this.widgetSaveService.registerWidgetContainer(
      this.widget.id,
      () => this.savePendingChangesImmediatelyAsync()
    );
  }

  @HostBinding('class.widget-container--selected')
  get isSelected(): boolean {
    return this.editorState.activeWidgetId() === this.widget?.id;
  }

  get calculatedZIndex(): number {
    const baseZIndex = 2000; // Higher than footer/logo (1000)
    return baseZIndex + (this.widget?.zIndex ?? 1);
  }

  get frame(): WidgetFrame {
    // During resize, use previewFrame
    if (this.previewFrame) {
      return this.previewFrame;
    }
    // After save, use savedFrame to prevent flicker
    if (this.savedFrame) {
      return this.savedFrame;
    }
    // Otherwise use widget's actual position/size
    return {
      width: this.widget.size.width,
      height: this.widget.size.height,
      x: this.widget.position.x,
      y: this.widget.position.y,
    };
  }

  onDragEnded(event: CdkDragEnd): void {
    const position = event.source.getFreeDragPosition();
    const currentFrame = this.savedFrame || {
      width: this.widget.size.width,
      height: this.widget.size.height,
      x: this.widget.position.x,
      y: this.widget.position.y,
    };
    const newPosition = {
      x: currentFrame.x + position.x,
      y: currentFrame.y + position.y,
    };
    // Store pending position for commit
    this.pendingPosition = newPosition;
    // Update saved frame immediately to prevent flicker
    this.savedFrame = {
      ...currentFrame,
      x: newPosition.x,
      y: newPosition.y,
    };
    event.source.reset();
    
    // Trigger debounced auto-save
    this.dragSaveSubject.next();
  }

  onEditingChange(editing: boolean): void {
    this.isEditing = editing;
  }


  onResizePointerDown(event: PointerEvent, handle: ResizeHandle): void {
    if (!this.isSelected) {
      return;
    }
    event.stopPropagation();
    this.isResizing = true;
    this.activeHandle = handle;
    this.resizeStart = {
      width: this.frame.width,
      height: this.frame.height,
      pointerX: event.clientX,
      pointerY: event.clientY,
      positionX: this.frame.x,
      positionY: this.frame.y,
    };
    this.previewFrame = { ...this.frame };
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
        // Bottom-right corner
        nextWidth = this.resizeStart.width + deltaX;
        nextHeight = this.resizeStart.height + deltaY;
        break;
      case 'corner-top-right':
        // Top-right corner
        nextWidth = this.resizeStart.width + deltaX;
        nextHeight = this.resizeStart.height - deltaY;
        nextY = this.resizeStart.positionY + deltaY;
        break;
      case 'corner-top-left':
        // Top-left corner
        nextWidth = this.resizeStart.width - deltaX;
        nextHeight = this.resizeStart.height - deltaY;
        nextX = this.resizeStart.positionX + deltaX;
        nextY = this.resizeStart.positionY + deltaY;
        break;
      case 'corner-bottom-left':
        // Bottom-left corner
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

    const frame = this.clampFrame(nextWidth, nextHeight, nextX, nextY);

    this.previewFrame = frame;
    this.cdr.markForCheck();
  }

  onWidgetPointerDown(): void {
    this.editorState.setActiveWidget(this.widget.id);
  }

  onSaveClick(event: MouseEvent | PointerEvent): void {
    event.stopPropagation();
    event.preventDefault();
    // Get current widget state based on widget type
    let widgetProps: any = null;
    
    switch (this.widget.type) {
      case 'text':
        widgetProps = this.textWidget?.getCurrentState();
        break;
      case 'chart':
        widgetProps = this.chartWidget?.getCurrentState();
        break;
      case 'image':
        widgetProps = this.imageWidget?.getCurrentState();
        break;
      case 'advanced-table':
        widgetProps = this.tableWidget?.getCurrentState();
        if (widgetProps) {
          // Update initial state after getting current state
          this.tableWidget.storeInitialState();
        }
        break;
    }
    
    // Commit everything together: position, size, and widget props
    this.commitChanges(widgetProps);
  }

  private commitChanges(widgetProps: Partial<any> | {
    rows?: number;
    columns?: number;
    cellData?: string[][];
    cellStyles?: Record<string, any>;
    mergedCells?: Record<string, { rowspan: number; colspan: number }>;
  } | null, immediate: boolean = false): void {
    const updates: any = {};
    
    if (this.pendingPosition) {
      updates.position = this.pendingPosition;
    }
    
    if (this.pendingSize) {
      updates.size = this.pendingSize;
    }
    
    // Always preserve existing widget props, merge with new ones if provided
    if (widgetProps && Object.keys(widgetProps).length > 0) {
      // Handle advanced table structure changes
      if ('rows' in widgetProps && 'columns' in widgetProps && 'cellData' in widgetProps) {
        updates.props = {
          ...this.widget.props,
          rows: widgetProps.rows,
          columns: widgetProps.columns,
          cellData: widgetProps.cellData,
          cellStyles: widgetProps.cellStyles || {},
          mergedCells: widgetProps.mergedCells || {},
        };
      } else {
        // Handle other widget props - merge with existing to preserve all data
        updates.props = {
          ...this.widget.props,
          ...widgetProps,
        };
      }
    } else {
      // If no widget props provided, preserve existing props
      updates.props = { ...this.widget.props };
    }
    
    if (Object.keys(updates).length > 0) {
      if (immediate) {
        // Save immediately (synchronous) when called before adding new widget
        this.documentService.updateWidget(
          this.subsectionId,
          this.pageId,
          this.widget.id,
          updates
        );
        // Clear pending changes immediately
        this.pendingPosition = null;
        this.pendingSize = null;
        // Update savedFrame to match committed state
        if (updates.position || updates.size) {
          this.savedFrame = {
            width: updates.size?.width ?? this.widget.size.width,
            height: updates.size?.height ?? this.widget.size.height,
            x: updates.position?.x ?? this.widget.position.x,
            y: updates.position?.y ?? this.widget.position.y,
          };
        }
        this.cdr.markForCheck();
      } else {
        // Save in background without blocking UI (normal auto-save)
        setTimeout(() => {
          this.documentService.updateWidget(
            this.subsectionId,
            this.pageId,
            this.widget.id,
            updates
          );
        }, 0);
        
        // Clear pending changes after commit
        this.pendingPosition = null;
        this.pendingSize = null;
        // Clear savedFrame after a short delay to allow store update
        setTimeout(() => {
          this.savedFrame = null;
          this.cdr.markForCheck();
        }, 100);
      }
    }
  }

  onDeleteClick(event: MouseEvent | PointerEvent): void {
    event.stopPropagation();
    event.preventDefault();
    this.documentService.deleteWidget(
      this.subsectionId,
      this.pageId,
      this.widget.id
    );
    this.editorState.setActiveWidget(null);
  }

  @HostListener('document:pointerup', ['$event'])
  onResizePointerUp(event: PointerEvent): void {
    if (!this.isResizing) {
      return;
    }
    // Store pending size and position for commit
    if (this.previewFrame) {
      this.pendingSize = {
        width: this.previewFrame.width,
        height: this.previewFrame.height,
      };
      this.pendingPosition = {
        x: this.previewFrame.x,
        y: this.previewFrame.y,
      };
      // Update saved frame immediately to prevent flicker
      this.savedFrame = { ...this.previewFrame };
    }
    this.isResizing = false;
    this.activeHandle = null;
    this.resizeStart = undefined;
    this.previewFrame = null;
    
    // Trigger debounced auto-save
    this.resizeSaveSubject.next();
  }


  private autoSaveAfterDrag(): void {
    // Auto-save after drag - save position and preserve widget props
    if (this.pendingPosition) {
      // Get current widget props to preserve data
      const widgetProps = this.getCurrentWidgetProps();
      this.commitChanges(widgetProps);
    }
  }

  private autoSaveAfterResize(): void {
    // Auto-save after resize - save position, size, and preserve widget props
    if (this.pendingPosition || this.pendingSize) {
      // Get current widget props to preserve data
      const widgetProps = this.getCurrentWidgetProps();
      this.commitChanges(widgetProps);
    }
  }

  private getCurrentWidgetProps(): Partial<any> | {
    rows?: number;
    columns?: number;
    cellData?: string[][];
    cellStyles?: Record<string, any>;
    mergedCells?: Record<string, { rowspan: number; colspan: number }>;
  } | null {
    // Get current widget state to preserve data during auto-save
    let widgetProps: any = null;
    
    switch (this.widget.type) {
      case 'text':
        widgetProps = this.textWidget?.getCurrentState();
        break;
      case 'chart':
        widgetProps = this.chartWidget?.getCurrentState();
        break;
      case 'image':
        widgetProps = this.imageWidget?.getCurrentState();
        break;
      case 'advanced-table':
        widgetProps = this.tableWidget?.getCurrentState();
        break;
    }
    
    return widgetProps;
  }

  /**
   * Save pending changes immediately (called before adding new widget)
   * Always saves to capture any content changes, even if position/size haven't changed
   */
  private savePendingChangesImmediately(): void {
    // Always get current widget props to capture any content changes
    const widgetProps = this.getCurrentWidgetProps();
    // Save immediately without debounce
    this.commitChanges(widgetProps, true);
  }

  /**
   * Check if this widget has pending changes (position or size)
   * Content changes are always saved when saveAllPendingChanges is called
   */
  private hasPendingChanges(): boolean {
    return !!(this.pendingPosition || this.pendingSize);
  }

  /**
   * Save pending changes asynchronously and return a Promise
   * Resolves when save is complete and store has been updated
   * Always saves to capture any content changes, even if position/size haven't changed
   */
  private savePendingChangesImmediatelyAsync(): Promise<void> {
    return new Promise<void>((resolve) => {
      // Always get current widget props to capture any content changes
      const widgetProps = this.getCurrentWidgetProps();
      
      // Save immediately without debounce (even if no position/size changes, content may have changed)
      this.commitChanges(widgetProps, true);
      
      // Wait for document observable to emit new value (store updated)
      // This ensures the save has actually propagated to the store
      firstValueFrom(
        this.documentService.document$.pipe(
          skip(1), // Skip the current value
          take(1), // Take the next value (updated document)
          timeout(500) // Max 500ms wait
        )
      )
        .then(() => {
          resolve();
        })
        .catch((error) => {
          // If timeout, log the warning but still resolve
          console.warn(`Widget ${this.widget.id} save may not have propagated to store:`, error);
          resolve(); // Resolve anyway to not block operations
        });
    });
  }

  private clampFrame(width: number, height: number, x: number, y: number) {
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

  ngOnDestroy(): void {
    // Unregister from save service
    this.widgetSaveService.unregisterWidgetContainer(this.widget.id);
    
    // Clean up RxJS subscriptions
    this.subscriptions.unsubscribe();
    this.dragSaveSubject.complete();
    this.resizeSaveSubject.complete();
  }
}

interface WidgetFrame {
  width: number;
  height: number;
  x: number;
  y: number;
}

