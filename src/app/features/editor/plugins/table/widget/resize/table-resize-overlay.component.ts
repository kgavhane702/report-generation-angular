import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';

export type ColResizeSegmentIndex = { boundaryIndex: number; leftPercent: number; topPercent: number; heightPercent: number };
export type RowResizeSegmentIndex = { boundaryIndex: number; topPercent: number; leftPercent: number; widthPercent: number };

export type ColResizeSegmentAbs = { boundaryAbs: number; leftPercent: number; topPercent: number; heightPercent: number };
export type RowResizeSegmentAbs = { boundaryAbs: number; topPercent: number; leftPercent: number; widthPercent: number };

export type GhostColLine = { leftPercent: number; topPercent?: number; heightPercent?: number };
export type GhostRowLine = { topPercent: number; leftPercent?: number; widthPercent?: number };

@Component({
  selector: 'app-table-resize-overlay',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './table-resize-overlay.component.html',
  styleUrls: ['./table-resize-overlay.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class TableResizeOverlayComponent {
  @Input({ required: true }) overlayKind: 'top' | 'shared' | 'split' = 'top';

  @Input() colSegmentsIndex: ColResizeSegmentIndex[] = [];
  @Input() rowSegmentsIndex: RowResizeSegmentIndex[] = [];
  @Input() colSegmentsAbs: ColResizeSegmentAbs[] = [];
  @Input() rowSegmentsAbs: RowResizeSegmentAbs[] = [];

  /** Ghost preview lines (PPT-like). Rendered with pointer-events: none. */
  @Input() ghostCols: GhostColLine[] = [];
  @Input() ghostRows: GhostRowLine[] = [];

  @Output() colPointerDownIndex = new EventEmitter<{ event: PointerEvent; boundaryIndex: number }>();
  @Output() rowPointerDownIndex = new EventEmitter<{ event: PointerEvent; boundaryIndex: number }>();
  @Output() colPointerDownAbs = new EventEmitter<{ event: PointerEvent; boundaryAbs: number }>();
  @Output() rowPointerDownAbs = new EventEmitter<{ event: PointerEvent; boundaryAbs: number }>();

  get overlayClass(): string {
    if (this.overlayKind === 'shared') return 'table-widget__shared-split-resize-overlay';
    if (this.overlayKind === 'split') return 'table-widget__split-resize-overlay';
    return 'table-widget__resize-overlay';
  }

  onColIndexDown(event: PointerEvent, boundaryIndex: number): void {
    this.colPointerDownIndex.emit({ event, boundaryIndex });
  }

  onRowIndexDown(event: PointerEvent, boundaryIndex: number): void {
    this.rowPointerDownIndex.emit({ event, boundaryIndex });
  }

  onColAbsDown(event: PointerEvent, boundaryAbs: number): void {
    this.colPointerDownAbs.emit({ event, boundaryAbs });
  }

  onRowAbsDown(event: PointerEvent, boundaryAbs: number): void {
    this.rowPointerDownAbs.emit({ event, boundaryAbs });
  }
}


