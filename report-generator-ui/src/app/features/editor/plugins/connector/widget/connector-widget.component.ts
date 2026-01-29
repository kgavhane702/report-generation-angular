import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';

import type { ConnectorWidgetProps, ConnectorPoint, WidgetModel } from '../../../../../models/widget.model';
import { computeElbowHandleFromControl, computeElbowPoints, getAnchorDirection } from '../../../../../core/geometry/connector-elbow-routing';
import {
  isElbowConnectorShapeType,
  isCurvedConnectorShapeType,
} from '../../../widget-host/widget-interaction-policy';

@Component({
  selector: 'app-connector-widget',
  templateUrl: './connector-widget.component.html',
  styleUrls: ['./connector-widget.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConnectorWidgetComponent {
  @Input({ required: true }) widget!: WidgetModel;
  @Output() propsChange = new EventEmitter<Partial<ConnectorWidgetProps>>();
  
  /**
   * Emitted when the user clicks on the connector stroke (hit area).
   * Used by widget-container to select and initiate drag.
   */
  @Output() strokePointerDown = new EventEmitter<PointerEvent>();

  /**
   * Handle pointerdown on the SVG stroke hit area.
   * Emits the event so parent can handle selection/drag.
   */
  onStrokePointerDown(event: PointerEvent): void {
    this.strokePointerDown.emit(event);
  }

  get connectorProps(): ConnectorWidgetProps {
    return this.widget.props as ConnectorWidgetProps;
  }

  get shapeType(): string {
    return this.connectorProps?.shapeType || 'line';
  }

  // ============================================
  // ENDPOINT POSITIONS
  // ============================================

  get startPoint(): ConnectorPoint {
    return this.connectorProps?.startPoint || { x: 0, y: this.widget.size.height / 2 };
  }

  get endPoint(): ConnectorPoint {
    return this.connectorProps?.endPoint || { x: this.widget.size.width, y: this.widget.size.height / 2 };
  }

  get controlPoint(): ConnectorPoint | null {
    // We reuse the same controlPoint semantics for curved AND elbow connectors.
    // For curves: controlPoint is the quadratic-bezier control.
    // For elbows: controlPoint is still stored the same way (so the same UI handle logic works),
    // but we render an orthogonal polyline instead of a curve.
    if (!this.isCurved && !this.isElbow) return null;
    return this.connectorProps?.controlPoint || (this.isElbow ? this.defaultElbowControlPoint : this.defaultControlPoint);
  }

  private get defaultControlPoint(): ConnectorPoint {
    // Default control point is above the midpoint for curved connectors
    const midX = (this.startPoint.x + this.endPoint.x) / 2;
    const midY = (this.startPoint.y + this.endPoint.y) / 2;
    return { x: midX, y: midY - 50 };
  }

  private get defaultElbowControlPoint(): ConnectorPoint {
    // Use anchor-aware default if attachments exist, otherwise classic L-bend.
    const start = this.startPoint;
    const end = this.endPoint;
    const startDir = getAnchorDirection(this.connectorProps?.startAttachment?.anchor);
    const endDir = getAnchorDirection(this.connectorProps?.endAttachment?.anchor);

    // Compute a sensible default handle based on anchor directions.
    const defaultHandle = this.computeDefaultElbowHandle(start, end, startDir, endDir);

    // Inverse of the quadratic midpoint formula at t=0.5:
    // midpoint = 0.25*start + 0.5*control + 0.25*end
    // control = 2*midpoint - 0.5*(start + end)
    return {
      x: 2 * defaultHandle.x - 0.5 * (start.x + end.x),
      y: 2 * defaultHandle.y - 0.5 * (start.y + end.y),
    };
  }

  /**
   * Compute a sensible default elbow handle based on anchor exit directions.
   * This ensures the elbow doesn't overlap the connected widgets.
   */
  private computeDefaultElbowHandle(
    start: ConnectorPoint,
    end: ConnectorPoint,
    startDir: ReturnType<typeof getAnchorDirection>,
    endDir: ReturnType<typeof getAnchorDirection>
  ): ConnectorPoint {
    const STUB = 30; // Minimum distance to go in exit direction before turning

    // If no anchor info, use classic L-bend
    if (!startDir && !endDir) {
      return { x: start.x, y: end.y };
    }

    // Determine if start exits horizontally or vertically
    const startHoriz = startDir === 'left' || startDir === 'right';
    const endHoriz = endDir === 'left' || endDir === 'right';

    // Case 1: Both horizontal (e.g., left→right or right→left)
    // Route: horizontal stub → vertical middle → horizontal stub
    if (startHoriz && endHoriz) {
      const midX = (start.x + end.x) / 2;
      const midY = (start.y + end.y) / 2;
      return { x: midX, y: midY };
    }

    // Case 2: Both vertical (e.g., top→bottom or bottom→top)
    // Route: vertical stub → horizontal middle → vertical stub
    if (!startHoriz && !endHoriz) {
      const midX = (start.x + end.x) / 2;
      const midY = (start.y + end.y) / 2;
      return { x: midX, y: midY };
    }

    // Case 3: Start horizontal, end vertical
    // L-bend at (end.x, start.y)
    if (startHoriz && !endHoriz) {
      return { x: end.x, y: start.y };
    }

    // Case 4: Start vertical, end horizontal
    // L-bend at (start.x, end.y)
    if (!startHoriz && endHoriz) {
      return { x: start.x, y: end.y };
    }

    // Fallback
    return { x: start.x, y: end.y };
  }

  // ============================================
  // SVG PATH GENERATION
  // ============================================

  get svgPath(): string {
    const start = this.startPoint;
    const end = this.endPoint;

    if (this.isElbow) {
      const ctrl = this.controlPoint || this.defaultElbowControlPoint;
      return this.generateElbowPath(start, end, ctrl);
    }

    if (this.isCurved) {
      const ctrl = this.controlPoint || this.defaultControlPoint;
      return this.generateCurvedPath(start, end, ctrl);
    }

    // Straight line
    return this.generateStraightPath(start, end);
  }

  private generateStraightPath(start: ConnectorPoint, end: ConnectorPoint): string {
    let path = `M ${start.x} ${start.y} L ${end.x} ${end.y}`;

    // Add arrowheads
    if (this.connectorProps?.arrowStart) {
      path += this.generateArrowhead(end, start, start);
    }
    if (this.connectorProps?.arrowEnd || this.shapeType.includes('arrow')) {
      path += this.generateArrowhead(start, end, end);
    }

    return path;
  }

  private generateElbowPath(start: ConnectorPoint, end: ConnectorPoint, control: ConnectorPoint): string {
    const handle = computeElbowHandleFromControl(start, end, control);
    const points = computeElbowPoints({
      start,
      end,
      control,
      startAnchor: this.connectorProps?.startAttachment?.anchor,
      endAnchor: this.connectorProps?.endAttachment?.anchor,
      stub: 30,
    });

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }

    if (this.connectorProps?.arrowEnd || this.shapeType.includes('arrow')) {
      const prev = this.findPrevPointForArrow(points);
      if (prev) {
        path += this.generateArrowhead(prev, end, end);
      }
    }

    return path;
  }

  private findPrevDistinctPoint(points: ConnectorPoint[]): ConnectorPoint | null {
    if (points.length < 2) return null;
    const end = points[points.length - 1];
    for (let i = points.length - 2; i >= 0; i--) {
      const p = points[i];
      if (p.x !== end.x || p.y !== end.y) return p;
    }
    return null;
  }

  private findPrevPointForArrow(points: ConnectorPoint[]): ConnectorPoint | null {
    if (points.length < 2) return null;
    const end = points[points.length - 1];
    // Skip tiny segments (can happen when the handle aligns with end).
    const MIN_SEGMENT = 0.5;
    for (let i = points.length - 2; i >= 0; i--) {
      const p = points[i];
      const len = Math.hypot(end.x - p.x, end.y - p.y);
      if (len >= MIN_SEGMENT) return p;
    }
    return null;
  }

  private generateCurvedPath(start: ConnectorPoint, end: ConnectorPoint, control: ConnectorPoint): string {
    let path = `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`;

    if (this.connectorProps?.arrowEnd || this.shapeType.includes('arrow')) {
      path += this.generateArrowhead(control, end, end);
    }

    return path;
  }

  private generateArrowhead(from: ConnectorPoint, to: ConnectorPoint, tip: ConnectorPoint): string {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const segLen = Math.hypot(dx, dy);
    if (segLen < 1e-3) return '';

    const angle = Math.atan2(dy, dx);
    const arrowLength = Math.min(10, segLen * 0.8);
    const arrowAngle = Math.PI / 6; // 30 degrees

    const x1 = tip.x - arrowLength * Math.cos(angle - arrowAngle);
    const y1 = tip.y - arrowLength * Math.sin(angle - arrowAngle);
    const x2 = tip.x - arrowLength * Math.cos(angle + arrowAngle);
    const y2 = tip.y - arrowLength * Math.sin(angle + arrowAngle);

    return ` M ${x1} ${y1} L ${tip.x} ${tip.y} L ${x2} ${y2}`;
  }

  // ============================================
  // VIEWBOX
  // ============================================

  get svgViewBox(): string {
    // ViewBox matches the widget size - endpoints are stored in widget-local coordinates
    const width = this.widget.size.width;
    const height = this.widget.size.height;
    return `0 0 ${width} ${height}`;
  }

  // ============================================
  // STYLING
  // ============================================

  get opacity(): number {
    return (this.connectorProps?.opacity ?? 100) / 100;
  }

  get strokeWidth(): number {
    const w = this.connectorProps?.stroke?.width ?? 2;
    return Math.max(w, 2);
  }

  get hitStrokeWidth(): number {
    // Add ~2px padding on each side of the stroke for easier grabbing.
    return this.strokeWidth + 4;
  }

  get strokeStyle(): string {
    return this.connectorProps?.stroke?.style || 'solid';
  }

  get strokeDasharray(): string {
    if (this.strokeStyle === 'dashed') return '8,4';
    if (this.strokeStyle === 'dotted') return '2,2';
    return 'none';
  }

  get strokeColor(): string {
    return this.connectorProps?.fillColor || '#3b82f6';
  }

  get strokeLinejoin(): string {
    return this.isElbow ? 'round' : 'miter';
  }

  get isElbow(): boolean {
    return isElbowConnectorShapeType(this.shapeType);
  }

  get isCurved(): boolean {
    return isCurvedConnectorShapeType(this.shapeType);
  }

  get isStraight(): boolean {
    return !this.isElbow && !this.isCurved;
  }
}
