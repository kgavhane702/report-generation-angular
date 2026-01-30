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
export type GuideKind = 'page' | 'widget' | 'spacing';
export type GuideAlignType = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';

export interface GuideLine {
  orientation: GuideOrientation;
  /** X for vertical, Y for horizontal (page coordinate px) */
  posPx: number;
  /** Span start along the other axis (page coordinate px) */
  fromPx: number;
  /** Span end along the other axis (page coordinate px) */
  toPx: number;
  kind: GuideKind;
  /** What type of alignment this represents */
  alignType?: GuideAlignType;
  /** Whether this is a center alignment (for visual emphasis) */
  isCenter?: boolean;
}

export interface SpacingGuide {
  orientation: 'horizontal' | 'vertical';
  /** The gap value in pixels */
  gapPx: number;
  /** Position of gap indicator */
  posPx: number;
  /** Start of the gap region */
  fromPx: number;
  /** End of the gap region */
  toPx: number;
}

export interface WidgetFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface WidgetFrameWithId extends WidgetFrame {
  id: string;
}

export interface GuidesState {
  pageId: string;
  widgetId: string;
  mode: 'drag' | 'resize';
  resizeHandle?: string;
  guides: GuideLine[];
  spacingGuides: SpacingGuide[];
  snappedFrame?: WidgetFrame;
}

interface AlignmentMatch {
  targetPos: number;
  sourceType: GuideAlignType;
  kind: GuideKind;
  distance: number;
  /** The target widget frame (for segment calculation) */
  targetFrame?: WidgetFrame;
  /** Page dimensions for page guides */
  pageSize?: { width: number; height: number };
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
    this._state.set({ pageId, widgetId, mode, resizeHandle, guides: [], spacingGuides: [] });
  }

  updateDrag(pageId: string, widgetId: string, frame: WidgetFrame, pageWidth: number, pageHeight: number): WidgetFrame {
    if (this.uiState.guidesEnabled() === false) return frame;
    const next = this.compute(pageId, widgetId, frame, pageWidth, pageHeight, 'drag');
    this._state.set({
      pageId,
      widgetId,
      mode: 'drag',
      guides: next.guides,
      spacingGuides: next.spacingGuides,
      snappedFrame: next.snappedFrame,
    });
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
    this._state.set({
      pageId,
      widgetId,
      mode: 'resize',
      resizeHandle,
      guides: next.guides,
      spacingGuides: next.spacingGuides,
      snappedFrame: next.snappedFrame,
    });
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
  ): { guides: GuideLine[]; spacingGuides: SpacingGuide[]; snappedFrame?: WidgetFrame } {
    const threshold = this.uiState.guidesSnapThresholdPx();
    const snapEnabled = this.uiState.guidesSnapEnabled();

    const others = this.getOtherWidgetFrames(pageId, widgetId);

    // Build targets with their source frames for segment calculation
    const targetsX = this.buildXTargets(pageWidth, pageHeight, others);
    const targetsY = this.buildYTargets(pageWidth, pageHeight, others);

    // Source edges of the moving widget
    const left = frame.x;
    const right = frame.x + frame.width;
    const cx = frame.x + frame.width / 2;
    const top = frame.y;
    const bottom = frame.y + frame.height;
    const cy = frame.y + frame.height / 2;

    // Find ALL matches within threshold (not just best)
    const xMatches = this.findAllAlignments(
      [
        { pos: left, type: 'left' as const },
        { pos: cx, type: 'center' as const },
        { pos: right, type: 'right' as const },
      ],
      targetsX,
      threshold
    );

    const yMatches = this.findAllAlignments(
      [
        { pos: top, type: 'top' as const },
        { pos: cy, type: 'middle' as const },
        { pos: bottom, type: 'bottom' as const },
      ],
      targetsY,
      threshold
    );

    // Pick a single best match per axis (for clean, non-noisy guides)
    const bestX = (() => {
      if (xMatches.length === 0) return null;
      if (mode !== 'resize') return xMatches.reduce((a, b) => (a.distance < b.distance ? a : b));

      const h = resizeHandle ?? '';
      const allowed = new Set<GuideAlignType>();
      if (h.includes('left')) allowed.add('left');
      if (h.includes('right')) allowed.add('right');

      const candidates = xMatches.filter((m) => allowed.has(m.sourceType));
      if (candidates.length === 0) return null;
      return candidates.reduce((a, b) => (a.distance < b.distance ? a : b));
    })();

    const bestY = (() => {
      if (yMatches.length === 0) return null;
      if (mode !== 'resize') return yMatches.reduce((a, b) => (a.distance < b.distance ? a : b));

      const h = resizeHandle ?? '';
      const allowed = new Set<GuideAlignType>();
      if (h.includes('top')) allowed.add('top');
      if (h.includes('bottom')) allowed.add('bottom');

      const candidates = yMatches.filter((m) => allowed.has(m.sourceType));
      if (candidates.length === 0) return null;
      return candidates.reduce((a, b) => (a.distance < b.distance ? a : b));
    })();

    // Build guide lines with proper segments
    const guides: GuideLine[] = [];

    if (bestX) {
      const segment = this.computeVerticalSegment(frame, bestX, pageHeight);
      guides.push({
        orientation: 'vertical',
        posPx: bestX.targetPos,
        fromPx: segment.from,
        toPx: segment.to,
        kind: bestX.kind,
        alignType: bestX.sourceType,
        isCenter: bestX.sourceType === 'center',
      });
    }

    if (bestY) {
      const segment = this.computeHorizontalSegment(frame, bestY, pageWidth);
      guides.push({
        orientation: 'horizontal',
        posPx: bestY.targetPos,
        fromPx: segment.from,
        toPx: segment.to,
        kind: bestY.kind,
        alignType: bestY.sourceType,
        isCenter: bestY.sourceType === 'middle',
      });
    }

    // Compute spacing guides (equal gaps)
    const spacingGuides = this.computeSpacingGuides(frame, others, threshold);

    if (!snapEnabled) return { guides, spacingGuides };

    // Snap to the best (closest) match per axis.
    // IMPORTANT: during resize we ONLY snap the actively resized edge(s).
    // Snapping a center/middle alignment while resizing can collapse width/height or feel "blocked".
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
      snapped = snapResize(frame, bestX?.targetPos, bestY?.targetPos, resizeHandle);
    }

    return { guides, spacingGuides, snappedFrame: snapped };
  }

  private buildXTargets(
    pageWidth: number,
    pageHeight: number,
    others: WidgetFrameWithId[]
  ): Array<{ pos: number; kind: GuideKind; type: GuideAlignType; frame?: WidgetFrame; pageSize?: { width: number; height: number } }> {
    const targets: Array<{ pos: number; kind: GuideKind; type: GuideAlignType; frame?: WidgetFrame; pageSize?: { width: number; height: number } }> = [
      { pos: 0, kind: 'page', type: 'left', pageSize: { width: pageWidth, height: pageHeight } },
      { pos: pageWidth / 2, kind: 'page', type: 'center', pageSize: { width: pageWidth, height: pageHeight } },
      { pos: pageWidth, kind: 'page', type: 'right', pageSize: { width: pageWidth, height: pageHeight } },
    ];

    for (const o of others) {
      targets.push(
        { pos: o.x, kind: 'widget', type: 'left', frame: o },
        { pos: o.x + o.width / 2, kind: 'widget', type: 'center', frame: o },
        { pos: o.x + o.width, kind: 'widget', type: 'right', frame: o }
      );
    }

    return targets;
  }

  private buildYTargets(
    pageWidth: number,
    pageHeight: number,
    others: WidgetFrameWithId[]
  ): Array<{ pos: number; kind: GuideKind; type: GuideAlignType; frame?: WidgetFrame; pageSize?: { width: number; height: number } }> {
    const targets: Array<{ pos: number; kind: GuideKind; type: GuideAlignType; frame?: WidgetFrame; pageSize?: { width: number; height: number } }> = [
      { pos: 0, kind: 'page', type: 'top', pageSize: { width: pageWidth, height: pageHeight } },
      { pos: pageHeight / 2, kind: 'page', type: 'middle', pageSize: { width: pageWidth, height: pageHeight } },
      { pos: pageHeight, kind: 'page', type: 'bottom', pageSize: { width: pageWidth, height: pageHeight } },
    ];

    for (const o of others) {
      targets.push(
        { pos: o.y, kind: 'widget', type: 'top', frame: o },
        { pos: o.y + o.height / 2, kind: 'widget', type: 'middle', frame: o },
        { pos: o.y + o.height, kind: 'widget', type: 'bottom', frame: o }
      );
    }

    return targets;
  }

  private findAllAlignments<TSource extends { pos: number; type: GuideAlignType }>(
    sources: TSource[],
    targets: Array<{ pos: number; kind: GuideKind; type: GuideAlignType; frame?: WidgetFrame; pageSize?: { width: number; height: number } }>,
    threshold: number
  ): AlignmentMatch[] {
    const matches: AlignmentMatch[] = [];
    const seen = new Set<string>(); // Dedupe by targetPos + sourceType

    for (const s of sources) {
      for (const t of targets) {
        const dist = Math.abs(s.pos - t.pos);
        if (dist <= threshold) {
          const key = `${t.pos.toFixed(1)}_${s.type}`;
          if (!seen.has(key)) {
            seen.add(key);
            matches.push({
              targetPos: t.pos,
              sourceType: s.type,
              kind: t.kind,
              distance: dist,
              targetFrame: t.frame,
              pageSize: t.pageSize,
            });
          }
        }
      }
    }

    // Sort by distance (closest first), then by kind (widget before page for priority)
    matches.sort((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance;
      if (a.kind === 'widget' && b.kind === 'page') return -1;
      if (a.kind === 'page' && b.kind === 'widget') return 1;
      return 0;
    });

    return matches;
  }

  /**
   * Compute the vertical segment span (top to bottom) for a vertical guide line.
   * For stacked widgets, this spans across both widgets including the gap between them.
   */
  private computeVerticalSegment(
    movingFrame: WidgetFrame,
    match: AlignmentMatch,
    pageHeight: number
  ): { from: number; to: number } {
    if (match.kind === 'page') {
      // Page guides span full height
      return { from: 0, to: pageHeight };
    }

    if (!match.targetFrame) {
      return { from: 0, to: pageHeight };
    }

    const target = match.targetFrame;

    // Calculate the span to connect both widgets visually
    const movingTop = movingFrame.y;
    const movingBottom = movingFrame.y + movingFrame.height;
    const targetTop = target.y;
    const targetBottom = target.y + target.height;

    const from = Math.min(movingTop, targetTop);
    const to = Math.max(movingBottom, targetBottom);

    // Ensure minimum visible length (at least 50px or the span, whichever is greater)
    const minLength = 50;
    const length = to - from;
    if (length < minLength) {
      const center = (from + to) / 2;
      return { 
        from: Math.max(0, center - minLength / 2), 
        to: Math.min(pageHeight, center + minLength / 2) 
      };
    }

    return { from: Math.max(0, from), to: Math.min(pageHeight, to) };
  }

  /**
   * Compute the horizontal segment span (left to right) for a horizontal guide line.
   * For side-by-side widgets, this spans across both widgets including the gap between them.
   */
  private computeHorizontalSegment(
    movingFrame: WidgetFrame,
    match: AlignmentMatch,
    pageWidth: number
  ): { from: number; to: number } {
    if (match.kind === 'page') {
      // Page guides span full width
      return { from: 0, to: pageWidth };
    }

    if (!match.targetFrame) {
      return { from: 0, to: pageWidth };
    }

    const target = match.targetFrame;

    const movingLeft = movingFrame.x;
    const movingRight = movingFrame.x + movingFrame.width;
    const targetLeft = target.x;
    const targetRight = target.x + target.width;

    // Span from leftmost edge to rightmost edge of both widgets
    const from = Math.min(movingLeft, targetLeft);
    const to = Math.max(movingRight, targetRight);

    // Ensure minimum visible length (at least 50px or the span, whichever is greater)
    const minLength = 50;
    const length = to - from;
    if (length < minLength) {
      const center = (from + to) / 2;
      return { 
        from: Math.max(0, center - minLength / 2), 
        to: Math.min(pageWidth, center + minLength / 2) 
      };
    }

    return { from: Math.max(0, from), to: Math.min(pageWidth, to) };
  }

  /**
   * Compute spacing guides for equal horizontal/vertical gaps.
   */
  private computeSpacingGuides(
    frame: WidgetFrame,
    others: WidgetFrameWithId[],
    threshold: number
  ): SpacingGuide[] {
    const spacingGuides: SpacingGuide[] = [];

    if (others.length < 2) return spacingGuides;

    // Horizontal spacing: find widgets to the left and right
    const leftNeighbors = others
      .filter((o) => o.x + o.width <= frame.x)
      .sort((a, b) => (b.x + b.width) - (a.x + a.width)); // closest first

    const rightNeighbors = others
      .filter((o) => o.x >= frame.x + frame.width)
      .sort((a, b) => a.x - b.x); // closest first

    // Check for equal horizontal spacing
    if (leftNeighbors.length > 0 && rightNeighbors.length > 0) {
      const leftGap = frame.x - (leftNeighbors[0].x + leftNeighbors[0].width);
      const rightGap = rightNeighbors[0].x - (frame.x + frame.width);

      if (Math.abs(leftGap - rightGap) <= threshold && leftGap > 0 && rightGap > 0) {
        const avgGap = (leftGap + rightGap) / 2;
        // Left gap indicator
        spacingGuides.push({
          orientation: 'horizontal',
          gapPx: avgGap,
          posPx: frame.y + frame.height / 2,
          fromPx: leftNeighbors[0].x + leftNeighbors[0].width,
          toPx: frame.x,
        });
        // Right gap indicator
        spacingGuides.push({
          orientation: 'horizontal',
          gapPx: avgGap,
          posPx: frame.y + frame.height / 2,
          fromPx: frame.x + frame.width,
          toPx: rightNeighbors[0].x,
        });
      }
    }

    // Vertical spacing: find widgets above and below
    const topNeighbors = others
      .filter((o) => o.y + o.height <= frame.y)
      .sort((a, b) => (b.y + b.height) - (a.y + a.height));

    const bottomNeighbors = others
      .filter((o) => o.y >= frame.y + frame.height)
      .sort((a, b) => a.y - b.y);

    if (topNeighbors.length > 0 && bottomNeighbors.length > 0) {
      const topGap = frame.y - (topNeighbors[0].y + topNeighbors[0].height);
      const bottomGap = bottomNeighbors[0].y - (frame.y + frame.height);

      if (Math.abs(topGap - bottomGap) <= threshold && topGap > 0 && bottomGap > 0) {
        const avgGap = (topGap + bottomGap) / 2;
        spacingGuides.push({
          orientation: 'vertical',
          gapPx: avgGap,
          posPx: frame.x + frame.width / 2,
          fromPx: topNeighbors[0].y + topNeighbors[0].height,
          toPx: frame.y,
        });
        spacingGuides.push({
          orientation: 'vertical',
          gapPx: avgGap,
          posPx: frame.x + frame.width / 2,
          fromPx: frame.y + frame.height,
          toPx: bottomNeighbors[0].y,
        });
      }
    }

    return spacingGuides;
  }

  private getOtherWidgetFrames(pageId: string, excludeWidgetId: string): WidgetFrameWithId[] {
    const ids = this.widgetIdsByPageId()?.[pageId] ?? [];
    const entities = this.widgetEntities();

    const out: WidgetFrameWithId[] = [];
    for (const id of ids) {
      if (id === excludeWidgetId) continue;
      const persisted = entities[id] ?? null;
      const merged = this.drafts.getMergedWidget(id, persisted as any);
      if (!merged) continue;
      const p = merged.position;
      const s = merged.size;
      if (!p || !s) continue;
      out.push({ id, x: p.x, y: p.y, width: s.width, height: s.height });
    }
    return out;
  }
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


