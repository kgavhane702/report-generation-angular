import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';

import type { ConnectorWidgetProps, ConnectorPoint, WidgetModel } from '../../../../../models/widget.model';
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
    if (!this.isCurved) return null;
    return this.connectorProps?.controlPoint || this.defaultControlPoint;
  }

  private get defaultControlPoint(): ConnectorPoint {
    // Default control point is above the midpoint for curved connectors
    const midX = (this.startPoint.x + this.endPoint.x) / 2;
    const midY = (this.startPoint.y + this.endPoint.y) / 2;
    return { x: midX, y: midY - 50 };
  }

  // ============================================
  // SVG PATH GENERATION
  // ============================================

  get svgPath(): string {
    const start = this.startPoint;
    const end = this.endPoint;

    if (this.isElbow) {
      return this.generateElbowPath(start, end);
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

  private generateElbowPath(start: ConnectorPoint, end: ConnectorPoint): string {
    // L-shaped elbow: go down from start, then right to end
    const midY = end.y;
    let path = `M ${start.x} ${start.y} L ${start.x} ${midY} L ${end.x} ${end.y}`;

    if (this.connectorProps?.arrowEnd || this.shapeType.includes('arrow')) {
      const prevPoint = { x: start.x, y: midY };
      path += this.generateArrowhead(prevPoint, end, end);
    }

    return path;
  }

  private generateCurvedPath(start: ConnectorPoint, end: ConnectorPoint, control: ConnectorPoint): string {
    let path = `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`;

    if (this.connectorProps?.arrowEnd || this.shapeType.includes('arrow')) {
      path += this.generateArrowhead(control, end, end);
    }

    return path;
  }

  private generateArrowhead(from: ConnectorPoint, to: ConnectorPoint, tip: ConnectorPoint): string {
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const arrowLength = 10;
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
