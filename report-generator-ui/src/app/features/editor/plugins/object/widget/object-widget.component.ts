import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import { ObjectWidgetProps, WidgetModel } from '../../../../../models/widget.model';
import { UIStateService } from '../../../../../core/services/ui-state.service';
import { getShapeSvgPath, isComplexShape, getShapeRenderType, isStrokeOnlyShape } from '../config';

@Component({
  selector: 'app-object-widget',
  templateUrl: './object-widget.component.html',
  styleUrls: ['./object-widget.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ObjectWidgetComponent implements OnInit, OnDestroy {
  @Input({ required: true }) widget!: WidgetModel;
  @Output() propsChange = new EventEmitter<Partial<ObjectWidgetProps>>();

  private readonly cdr = inject(ChangeDetectorRef);
  private readonly uiState = inject(UIStateService);
  private readonly sanitizer = inject(DomSanitizer);

  private subscriptions: Subscription[] = [];

  get objectProps(): ObjectWidgetProps {
    return this.widget.props as ObjectWidgetProps;
  }

  get shapeType(): string {
    return this.objectProps?.shapeType || 'rectangle';
  }

  get fillColor(): string {
    return this.objectProps?.fillColor || '#3b82f6';
  }

  get opacity(): number {
    return (this.objectProps?.opacity ?? 100) / 100;
  }

  get strokeColor(): string {
    return this.objectProps?.stroke?.color || '#000000';
  }

  get strokeWidth(): number {
    return this.objectProps?.stroke?.width || 0;
  }

  get strokeStyle(): string {
    return this.objectProps?.stroke?.style || 'solid';
  }

  get borderStyle(): string {
    const stroke = this.objectProps?.stroke;
    if (!stroke || !stroke.width || stroke.width === 0) {
      return 'none';
    }
    const style = stroke.style || 'solid';
    return `${stroke.width}px ${style} ${stroke.color || '#000000'}`;
  }

  get borderRadius(): string {
    if (this.shapeType === 'circle' || this.shapeType === 'ellipse') {
      return '50%';
    }
    const radius = this.objectProps?.borderRadius ?? 0;
    return radius > 0 ? `${radius}px` : '0';
  }

  /** Check if this is a CSS-renderable shape (rectangle, circle, ellipse, square, rounded-rectangle) */
  get isCssShape(): boolean {
    return getShapeRenderType(this.shapeType) === 'css';
  }

  /** Check if this is an SVG-renderable shape */
  get isSvgShape(): boolean {
    return getShapeRenderType(this.shapeType) === 'svg';
  }

  /** Get CSS class for the shape */
  get shapeClass(): string {
    const type = this.shapeType;
    if (type === 'circle' || type === 'ellipse') return 'object-widget__shape--circle';
    if (type === 'rounded-rectangle') return 'object-widget__shape--rounded';
    return 'object-widget__shape--rectangle';
  }

  /** Get SVG path for complex shapes */
  get svgPath(): string {
    return getShapeSvgPath(this.shapeType);
  }

  /** Check if this is a stroke-only shape (like line) */
  get isLineShape(): boolean {
    return isStrokeOnlyShape(this.shapeType);
  }

  /** Get the effective stroke width for SVG (lines always have stroke) */
  get effectiveStrokeWidth(): number {
    if (this.isLineShape) {
      // Lines need a minimum stroke width to be visible
      return Math.max(this.strokeWidth || 2, 2);
    }
    return this.strokeWidth;
  }

  /** Get the effective stroke color for SVG */
  get effectiveStrokeColor(): string {
    if (this.isLineShape) {
      // For lines, use fill color as the stroke color
      return this.fillColor;
    }
    return this.strokeColor;
  }

  /** Get the fill for SVG shapes (lines have no fill) */
  get svgFill(): string {
    if (this.isLineShape) {
      return 'none';
    }
    return this.fillColor;
  }

  /** Get stroke dasharray for SVG */
  get svgStrokeDasharray(): string {
    if (this.strokeStyle === 'dashed') return '8,4';
    if (this.strokeStyle === 'dotted') return '2,2';
    return 'none';
  }

  ngOnInit(): void {
    // Future: Add toolbar service integration here
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((s) => s.unsubscribe());
  }

  onShapeClick(): void {
    // Select this widget
    this.uiState.selectWidget(this.widget.id);
  }

  updateShapeType(shapeType: string): void {
    this.propsChange.emit({ shapeType });
  }

  updateFillColor(fillColor: string): void {
    this.propsChange.emit({ fillColor });
  }

  updateOpacity(opacity: number): void {
    this.propsChange.emit({ opacity });
  }

  updateStroke(stroke: { color: string; width: number; style?: 'solid' | 'dashed' | 'dotted' }): void {
    this.propsChange.emit({ stroke });
  }

  updateBorderRadius(borderRadius: number): void {
    this.propsChange.emit({ borderRadius });
  }
}
