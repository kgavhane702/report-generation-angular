import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostBinding,
  HostListener,
  Input,
  effect,
  inject,
} from '@angular/core';
import { CdkDragEnd } from '@angular/cdk/drag-drop';

import { WidgetModel, WidgetPosition } from '../../../../models/widget.model';
import { PageSize } from '../../../../models/document.model';
import { DocumentService } from '../../../../core/services/document.service';
import { EditorStateService } from '../../../../core/services/editor-state.service';

type ResizeHandle = 'right' | 'bottom' | 'corner' | 'left' | 'top';

@Component({
  selector: 'app-widget-container',
  templateUrl: './widget-container.component.html',
  styleUrls: ['./widget-container.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetContainerComponent {
  @Input({ required: true }) widget!: WidgetModel;
  @Input({ required: true }) pageSize!: PageSize;
  @Input({ required: true }) pageId!: string;
  @Input({ required: true }) subsectionId!: string;
  @Input({ required: true }) pageWidth!: number;
  @Input({ required: true }) pageHeight!: number;
  @Input() dragBoundarySelector = '';

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

  constructor(
    private readonly documentService: DocumentService,
    private readonly cdr: ChangeDetectorRef
  ) {
    effect(() => {
      this.editorState.activeWidgetId();
      this.cdr.markForCheck();
    });
  }

  @HostBinding('class.widget-container--selected')
  get isSelected(): boolean {
    return this.editorState.activeWidgetId() === this.widget?.id;
  }

  get frame(): WidgetFrame {
    if (this.previewFrame) {
      return this.previewFrame;
    }
    return {
      width: this.widget.size.width,
      height: this.widget.size.height,
      x: this.widget.position.x,
      y: this.widget.position.y,
    };
  }

  onDragEnded(event: CdkDragEnd): void {
    const position = event.source.getFreeDragPosition();
    const newX = this.frame.x + position.x;
    const newY = this.frame.y + position.y;
    const clamped = this.clampPosition(newX, newY, this.frame.width, this.frame.height);

    this.documentService.updateWidget(
      this.subsectionId,
      this.pageId,
      this.widget.id,
      {
        position: clamped,
      }
    );

    event.source.reset();
  }

  onEditingChange(editing: boolean): void {
    this.isEditing = editing;
  }

  onContentChange(props: Partial<WidgetModel['props']>): void {
    this.documentService.updateWidget(this.subsectionId, this.pageId, this.widget.id, {
      props: {
        ...this.widget.props,
        ...props,
      },
    });
  }

  onChartPropsChange(props: Partial<WidgetModel['props']>): void {
    this.onContentChange(props);
  }

  onResizePointerDown(event: PointerEvent, handle: ResizeHandle): void {
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
        nextWidth = this.resizeStart.width + deltaX;
        nextHeight = this.resizeStart.height + deltaY;
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

  @HostListener('document:pointerup', ['$event'])
  onResizePointerUp(event: PointerEvent): void {
    if (!this.isResizing) {
      return;
    }
    this.isResizing = false;
    this.activeHandle = null;
    this.resizeStart = undefined;

    if (this.previewFrame) {
      this.documentService.updateWidget(this.subsectionId, this.pageId, this.widget.id, {
        size: { width: this.previewFrame.width, height: this.previewFrame.height },
        position: { x: this.previewFrame.x, y: this.previewFrame.y },
      });
      this.previewFrame = null;
    }
  }

  private clampPosition(x: number, y: number, width: number, height: number) {
    const maxX = Math.max(0, this.pageWidth - width);
    const maxY = Math.max(0, this.pageHeight - height);
    return {
      x: Math.min(Math.max(0, x), maxX),
      y: Math.min(Math.max(0, y), maxY),
    };
  }

  private clampFrame(width: number, height: number, x: number, y: number) {
    const minWidth = 80;
    const minHeight = 60;

    let newWidth = width;
    let newHeight = height;
    let newX = x;
    let newY = y;

    if (newWidth < minWidth) {
      if (this.activeHandle === 'left' || this.activeHandle === 'corner') {
        newX -= minWidth - newWidth;
      }
      newWidth = minWidth;
    }

    if (newHeight < minHeight) {
      if (this.activeHandle === 'top' || this.activeHandle === 'corner') {
        newY -= minHeight - newHeight;
      }
      newHeight = minHeight;
    }

    if (newX < 0) {
      newWidth += newX;
      newX = 0;
    }
    if (newY < 0) {
      newHeight += newY;
      newY = 0;
    }

    const maxWidth = this.pageWidth - newX;
    const maxHeight = this.pageHeight - newY;

    if (newWidth > maxWidth) {
      if (this.activeHandle === 'left' || this.activeHandle === 'corner') {
        newX += newWidth - maxWidth;
      }
      newWidth = maxWidth;
    }

    if (newHeight > maxHeight) {
      if (this.activeHandle === 'top' || this.activeHandle === 'corner') {
        newY += newHeight - maxHeight;
      }
      newHeight = maxHeight;
    }

    return { width: newWidth, height: newHeight, x: newX, y: newY };
  }
}

interface WidgetFrame {
  width: number;
  height: number;
  x: number;
  y: number;
}

