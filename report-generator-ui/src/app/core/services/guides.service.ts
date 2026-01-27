import { Injectable, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import type { Dictionary } from '@ngrx/entity';

import type { AppState } from '../../store/app.state';
import { DocumentSelectors } from '../../store/document/document.selectors';
import type { WidgetEntity } from '../../store/document/document.state';
import { DraftStateService } from './draft-state.service';
import { UIStateService } from './ui-state.service';

export type GuideOrientation = 'vertical' | 'horizontal';
export type GuideKind = 'page' | 'widget';

export interface GuideLine {
  orientation: GuideOrientation;
  /** X for vertical, Y for horizontal (page coordinate px) */
  posPx: number;
  /** Span start along the other axis (page coordinate px) */
  fromPx: number;
  /** Span end along the other axis (page coordinate px) */
  toPx: number;
  kind: GuideKind;
}

export interface WidgetFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GuidesState {
  pageId: string;
  widgetId: string;
  mode: 'drag' | 'resize';
  resizeHandle?: string;
  guides: GuideLine[];
  snappedFrame?: WidgetFrame;
}

@Injectable({ providedIn: 'root' })
export class GuidesService {
  private readonly store = inject(Store<AppState>);
  private readonly drafts = inject(DraftStateService);
  private readonly uiState = inject(UIStateService);

  private readonly widgetEntities = toSignal(
    this.store.select(DocumentSelectors.selectWidgetEntities),
    { initialValue: {} as Dictionary<WidgetEntity> }
  );
  private readonly widgetIdsByPageId = toSignal(
    this.store.select(DocumentSelectors.selectWidgetIdsByPageId),
    { initialValue: {} as Record<string, string[]> }
  );

  private readonly _state = signal<GuidesState | null>(null);
  readonly state = this._state.asReadonly();

  clear(): void {
    this._state.set(null);
  }

  start(pageId: string, widgetId: string, mode: 'drag' | 'resize', resizeHandle?: string): void {
    if (this.uiState.guidesEnabled() === false) return;
    this._state.set({ pageId, widgetId, mode, resizeHandle, guides: [] });
  }

  updateDrag(pageId: string, widgetId: string, frame: WidgetFrame, pageWidth: number, pageHeight: number): WidgetFrame {
    if (this.uiState.guidesEnabled() === false) return frame;
    const next = this.compute(pageId, widgetId, frame, pageWidth, pageHeight, 'drag');
    this._state.set({ pageId, widgetId, mode: 'drag', guides: next.guides, snappedFrame: next.snappedFrame });
    return next.snappedFrame ?? frame;
  }

  updateResize(
    pageId: string,
    widgetId: string,
    frame: WidgetFrame,
    pageWidth: number,
    pageHeight: number,
    resizeHandle: string
  ): WidgetFrame {
    if (this.uiState.guidesEnabled() === false) return frame;
    const next = this.compute(pageId, widgetId, frame, pageWidth, pageHeight, 'resize', resizeHandle);
    this._state.set({ pageId, widgetId, mode: 'resize', resizeHandle, guides: next.guides, snappedFrame: next.snappedFrame });
    return next.snappedFrame ?? frame;
  }

  end(widgetId?: string): void {
    const st = this._state();
    if (!st) return;
    if (widgetId && st.widgetId !== widgetId) return;
    this._state.set(null);
  }

  private compute(
    pageId: string,
    widgetId: string,
    frame: WidgetFrame,
    pageWidth: number,
    pageHeight: number,
    mode: 'drag' | 'resize',
    resizeHandle?: string
  ): { guides: GuideLine[]; snappedFrame?: WidgetFrame } {
    const threshold = this.uiState.guidesSnapThresholdPx();
    const snapEnabled = this.uiState.guidesSnapEnabled();

    const others = this.getOtherWidgetFrames(pageId, widgetId);

    const targetsX: Array<{ x: number; kind: GuideKind }> = [
      { x: 0, kind: 'page' },
      { x: pageWidth / 2, kind: 'page' },
      { x: pageWidth, kind: 'page' },
    ];
    const targetsY: Array<{ y: number; kind: GuideKind }> = [
      { y: 0, kind: 'page' },
      { y: pageHeight / 2, kind: 'page' },
      { y: pageHeight, kind: 'page' },
    ];

    for (const o of others) {
      targetsX.push({ x: o.x, kind: 'widget' }, { x: o.x + o.width / 2, kind: 'widget' }, { x: o.x + o.width, kind: 'widget' });
      targetsY.push({ y: o.y, kind: 'widget' }, { y: o.y + o.height / 2, kind: 'widget' }, { y: o.y + o.height, kind: 'widget' });
    }

    const left = frame.x;
    const right = frame.x + frame.width;
    const cx = frame.x + frame.width / 2;

    const top = frame.y;
    const bottom = frame.y + frame.height;
    const cy = frame.y + frame.height / 2;

    const bestX = findBestAlignment(
      [
        { pos: left, type: 'left' as const },
        { pos: cx, type: 'center' as const },
        { pos: right, type: 'right' as const },
      ],
      targetsX.map((t) => ({ pos: t.x, kind: t.kind })),
      threshold
    );

    const bestY = findBestAlignment(
      [
        { pos: top, type: 'top' as const },
        { pos: cy, type: 'middle' as const },
        { pos: bottom, type: 'bottom' as const },
      ],
      targetsY.map((t) => ({ pos: t.y, kind: t.kind })),
      threshold
    );

    const guides: GuideLine[] = [];
    if (bestX) {
      guides.push({ orientation: 'vertical', posPx: bestX.targetPos, fromPx: 0, toPx: pageHeight, kind: bestX.kind });
    }
    if (bestY) {
      guides.push({ orientation: 'horizontal', posPx: bestY.targetPos, fromPx: 0, toPx: pageWidth, kind: bestY.kind });
    }

    if (!snapEnabled) return { guides };

    // Snap logic: for drag we snap the whole frame; for resize we snap the affected edge when possible.
    let snapped: WidgetFrame | undefined;
    if (mode === 'drag') {
      let x = frame.x;
      let y = frame.y;
      if (bestX) {
        if (bestX.sourceType === 'left') x = bestX.targetPos;
        else if (bestX.sourceType === 'center') x = bestX.targetPos - frame.width / 2;
        else x = bestX.targetPos - frame.width;
      }
      if (bestY) {
        if (bestY.sourceType === 'top') y = bestY.targetPos;
        else if (bestY.sourceType === 'middle') y = bestY.targetPos - frame.height / 2;
        else y = bestY.targetPos - frame.height;
      }
      snapped = { ...frame, x, y };
    } else {
      // Minimal resize snapping: snap the edge being dragged to the guide target.
      snapped = snapResize(frame, bestX?.targetPos, bestY?.targetPos, resizeHandle);
    }

    return { guides, snappedFrame: snapped };
  }

  private getOtherWidgetFrames(pageId: string, excludeWidgetId: string): WidgetFrame[] {
    const ids = this.widgetIdsByPageId()?.[pageId] ?? [];
    const entities = this.widgetEntities();

    const out: WidgetFrame[] = [];
    for (const id of ids) {
      if (id === excludeWidgetId) continue;
      const persisted = entities[id] ?? null;
      const merged = this.drafts.getMergedWidget(id, persisted as any);
      if (!merged) continue;
      const p = merged.position;
      const s = merged.size;
      if (!p || !s) continue;
      out.push({ x: p.x, y: p.y, width: s.width, height: s.height });
    }
    return out;
  }
}

function findBestAlignment<TSource extends { pos: number; type: any }, TTarget extends { pos: number; kind: GuideKind }>(
  sources: TSource[],
  targets: TTarget[],
  threshold: number
): { targetPos: number; sourceType: TSource['type']; kind: GuideKind } | null {
  let best: { dist: number; targetPos: number; sourceType: TSource['type']; kind: GuideKind } | null = null;

  for (const s of sources) {
    for (const t of targets) {
      const dist = Math.abs(s.pos - t.pos);
      if (dist <= threshold) {
        if (!best || dist < best.dist) {
          best = { dist, targetPos: t.pos, sourceType: s.type, kind: t.kind };
        }
      }
    }
  }
  return best ? { targetPos: best.targetPos, sourceType: best.sourceType, kind: best.kind } : null;
}

function snapResize(frame: WidgetFrame, snapX: number | undefined, snapY: number | undefined, handle?: string): WidgetFrame {
  if (!handle) return frame;

  let { x, y, width, height } = frame;
  const right = x + width;
  const bottom = y + height;

  if (snapX !== undefined) {
    if (handle.includes('right')) {
      width = Math.max(1, snapX - x);
    } else if (handle.includes('left')) {
      const nextX = snapX;
      width = Math.max(1, right - nextX);
      x = nextX;
    }
  }

  if (snapY !== undefined) {
    if (handle.includes('bottom')) {
      height = Math.max(1, snapY - y);
    } else if (handle.includes('top')) {
      const nextY = snapY;
      height = Math.max(1, bottom - nextY);
      y = nextY;
    }
  }

  return { x, y, width, height };
}


