import type { ConnectorAnchorAttachment, ConnectorPoint } from '../../models/widget.model';

export type AnchorDirection = 'up' | 'down' | 'left' | 'right';
type AxisPreference = 'h' | 'v';

// Value export to guarantee this file is treated as a module in all build modes.
export const ELBOW_ROUTING_VERSION = 1 as const;

export function getAnchorDirection(anchor: ConnectorAnchorAttachment['anchor'] | undefined): AnchorDirection | null {
  if (!anchor) return null;
  switch (anchor) {
    case 'top':
    case 'top-left':
    case 'top-right':
      return 'up';
    case 'bottom':
    case 'bottom-left':
    case 'bottom-right':
      return 'down';
    case 'left':
      return 'left';
    case 'right':
      return 'right';
    default:
      return null;
  }
}

export function computeElbowHandleFromControl(
  start: ConnectorPoint,
  end: ConnectorPoint,
  control: ConnectorPoint | null
): ConnectorPoint {
  if (!control) return { x: start.x, y: end.y };
  return {
    x: 0.25 * start.x + 0.5 * control.x + 0.25 * end.x,
    y: 0.25 * start.y + 0.5 * control.y + 0.25 * end.y,
  };
}

export function computeElbowPoints(params: {
  start: ConnectorPoint;
  end: ConnectorPoint;
  control: ConnectorPoint | null;
  startAnchor?: ConnectorAnchorAttachment['anchor'];
  endAnchor?: ConnectorAnchorAttachment['anchor'];
  stub?: number;
}): ConnectorPoint[] {
  const { start, end, control } = params;
  const STUB = params.stub ?? 30;

  const handle = computeElbowHandleFromControl(start, end, control);
  const startDir = getAnchorDirection(params.startAnchor);
  const endDir = getAnchorDirection(params.endAnchor);

  const startStub = startDir ? offsetPoint(start, startDir, STUB) : start;
  const endStub = endDir ? offsetPoint(end, endDir, STUB) : end;

  const startPref: AxisPreference = isHorizontalDir(startDir) ? 'h' : 'v';
  const endPref: AxisPreference = isHorizontalDir(endDir) ? 'h' : 'v';

  const candidates: ConnectorPoint[][] = [];
  for (const leg1Pref of axisPrefs(startPref)) {
    for (const leg2Pref of axisPrefs(endPref)) {
      const leg1 = connectOrthogonal(startStub, handle, leg1Pref);
      const leg2 = connectOrthogonal(handle, endStub, leg2Pref);

      const pts: ConnectorPoint[] = [];
      pts.push(start);
      if (startStub.x !== start.x || startStub.y !== start.y) pts.push(startStub);
      pts.push(...leg1.slice(1));
      pts.push(...leg2.slice(1));
      if (endStub.x !== end.x || endStub.y !== end.y) pts.push(end);

      const compact = compactOrthogonalPoints(pts, handle);
      if (!isRouteValid(compact, startDir, endDir)) continue;
      candidates.push(compact);
    }
  }

  if (candidates.length === 0) {
    return compactOrthogonalPoints(
      [
        start,
        startStub,
        { x: handle.x, y: startStub.y },
        handle,
        { x: endStub.x, y: handle.y },
        endStub,
        end,
      ],
      handle
    );
  }

  return pickBestElbowCandidate(candidates);
}

function axisPrefs(preferred: AxisPreference): AxisPreference[] {
  return preferred === 'h' ? ['h', 'v'] : ['v', 'h'];
}

function isHorizontalDir(dir: AnchorDirection | null): boolean {
  return dir === 'left' || dir === 'right';
}

function offsetPoint(p: ConnectorPoint, dir: AnchorDirection, dist: number): ConnectorPoint {
  switch (dir) {
    case 'left':
      return { x: p.x - dist, y: p.y };
    case 'right':
      return { x: p.x + dist, y: p.y };
    case 'up':
      return { x: p.x, y: p.y - dist };
    case 'down':
      return { x: p.x, y: p.y + dist };
  }
}

function connectOrthogonal(a: ConnectorPoint, b: ConnectorPoint, pref: AxisPreference): ConnectorPoint[] {
  if (a.x === b.x || a.y === b.y) return [a, b];
  if (pref === 'h') {
    return [a, { x: b.x, y: a.y }, b];
  }
  return [a, { x: a.x, y: b.y }, b];
}

function compactOrthogonalPoints(points: ConnectorPoint[], keepPoint: ConnectorPoint): ConnectorPoint[] {
  const dedup: ConnectorPoint[] = [];
  for (const p of points) {
    const last = dedup[dedup.length - 1];
    if (!last || last.x !== p.x || last.y !== p.y) dedup.push(p);
  }

  const out: ConnectorPoint[] = [];
  for (const p of dedup) {
    out.push(p);
    while (out.length >= 3) {
      const c = out[out.length - 1];
      const b = out[out.length - 2];
      const a = out[out.length - 3];

      // Never remove the visual handle point even if collinear.
      if (b.x === keepPoint.x && b.y === keepPoint.y) break;

      const collinear = (a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y);
      if (!collinear) break;
      out.splice(out.length - 2, 1);
    }
  }

  return out;
}

function isRouteValid(points: ConnectorPoint[], startDir: AnchorDirection | null, endDir: AnchorDirection | null): boolean {
  if (points.length < 2) return false;

  if (startDir && points.length >= 3) {
    const p0 = points[0];
    const p1 = points[1];
    const p2 = points[2];
    if (!isTurnAllowed(p0, p1, p2, startDir, true)) return false;
  }

  if (endDir && points.length >= 3) {
    const pn = points.length;
    const pA = points[pn - 3];
    const pB = points[pn - 2];
    const pC = points[pn - 1];
    if (!isTurnAllowed(pA, pB, pC, endDir, false)) return false;
  }

  return countSelfIntersections(points) === 0;
}

function isTurnAllowed(
  prev: ConnectorPoint,
  at: ConnectorPoint,
  next: ConnectorPoint,
  anchorDir: AnchorDirection,
  isStart: boolean
): boolean {
  const dx2 = next.x - at.x;
  const dy2 = next.y - at.y;
  const seg2IsHorizontal = dy2 === 0 && dx2 !== 0;
  const seg2IsVertical = dx2 === 0 && dy2 !== 0;

  if (!seg2IsHorizontal && !seg2IsVertical) return true;

  const dir = isStart ? anchorDir : oppositeDir(anchorDir);

  if ((dir === 'left' || dir === 'right') && seg2IsHorizontal) {
    if (dir === 'right') return dx2 >= 0;
    return dx2 <= 0;
  }
  if ((dir === 'up' || dir === 'down') && seg2IsVertical) {
    if (dir === 'down') return dy2 >= 0;
    return dy2 <= 0;
  }
  return true;
}

function oppositeDir(dir: AnchorDirection): AnchorDirection {
  switch (dir) {
    case 'left':
      return 'right';
    case 'right':
      return 'left';
    case 'up':
      return 'down';
    case 'down':
      return 'up';
  }
}

function pickBestElbowCandidate(candidates: ConnectorPoint[][]): ConnectorPoint[] {
  let best = candidates[0];
  let bestScore = Number.POSITIVE_INFINITY;
  for (const c of candidates) {
    const intersections = countSelfIntersections(c);
    const length = manhattanLength(c);
    const bends = countBends(c);
    const score = intersections * 1_000_000 + bends * 10_000 + length;
    if (score < bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

function countBends(points: ConnectorPoint[]): number {
  let bends = 0;
  for (let i = 2; i < points.length; i++) {
    const a = points[i - 2];
    const b = points[i - 1];
    const c = points[i];
    const dir1 = a.x === b.x ? 'v' : 'h';
    const dir2 = b.x === c.x ? 'v' : 'h';
    if (dir1 !== dir2) bends++;
  }
  return bends;
}

function manhattanLength(points: ConnectorPoint[]): number {
  let sum = 0;
  for (let i = 1; i < points.length; i++) {
    sum += Math.abs(points[i].x - points[i - 1].x) + Math.abs(points[i].y - points[i - 1].y);
  }
  return sum;
}

function countSelfIntersections(points: ConnectorPoint[]): number {
  const segs = [] as Array<{ a: ConnectorPoint; b: ConnectorPoint }>;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a.x === b.x && a.y === b.y) continue;
    segs.push({ a, b });
  }

  let count = 0;
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      if (Math.abs(i - j) <= 1) continue;
      if (segmentsIntersect(segs[i].a, segs[i].b, segs[j].a, segs[j].b)) {
        count++;
      }
    }
  }
  return count;
}

function segmentsIntersect(a1: ConnectorPoint, a2: ConnectorPoint, b1: ConnectorPoint, b2: ConnectorPoint): boolean {
  const aHoriz = a1.y === a2.y;
  const bHoriz = b1.y === b2.y;

  // Shared endpoints are allowed.
  if (
    (a1.x === b1.x && a1.y === b1.y) ||
    (a1.x === b2.x && a1.y === b2.y) ||
    (a2.x === b1.x && a2.y === b1.y) ||
    (a2.x === b2.x && a2.y === b2.y)
  ) {
    return false;
  }

  // Perpendicular intersection
  if (aHoriz !== bHoriz) {
    const h1 = aHoriz ? a1 : b1;
    const h2 = aHoriz ? a2 : b2;
    const v1 = aHoriz ? b1 : a1;
    const v2 = aHoriz ? b2 : a2;

    const hxMin = Math.min(h1.x, h2.x);
    const hxMax = Math.max(h1.x, h2.x);
    const vyMin = Math.min(v1.y, v2.y);
    const vyMax = Math.max(v1.y, v2.y);

    const ix = v1.x;
    const iy = h1.y;

    return ix >= hxMin && ix <= hxMax && iy >= vyMin && iy <= vyMax;
  }

  // Collinear overlap (touching) counts
  if (aHoriz && bHoriz && a1.y === b1.y) {
    const aMin = Math.min(a1.x, a2.x);
    const aMax = Math.max(a1.x, a2.x);
    const bMin = Math.min(b1.x, b2.x);
    const bMax = Math.max(b1.x, b2.x);
    return Math.max(aMin, bMin) <= Math.min(aMax, bMax);
  }

  if (!aHoriz && !bHoriz && a1.x === b1.x) {
    const aMin = Math.min(a1.y, a2.y);
    const aMax = Math.max(a1.y, a2.y);
    const bMin = Math.min(b1.y, b2.y);
    const bMax = Math.max(b1.y, b2.y);
    return Math.max(aMin, bMin) <= Math.min(aMax, bMax);
  }

  return false;
}
