import { Injectable } from '@angular/core';
import { v4 as uuid } from 'uuid';

import {
  WidgetModel,
  WidgetType,
  ChartWidgetProps,
  ImageWidgetProps,
  EditastraWidgetProps,
  TableWidgetProps,
  ObjectWidgetProps,
  ConnectorWidgetProps,
  TableRow,
  WidgetProps,
} from '../../../models/widget.model';
import { createEmptyChartData } from '../../../models/chart-data.model';
import { TABLE_DEFAULT_WIDTH_PX, TABLE_INITIAL_ROW_PX } from '../plugins/table/table-constants';

@Injectable({
  providedIn: 'root',
})
export class WidgetFactoryService {
  createWidget(type: WidgetType, props?: Partial<WidgetProps>): WidgetModel {
    switch (type) {
      case 'chart':
        return this.createChartWidget();
      case 'image':
        return this.createImageWidget();
      case 'editastra':
        return this.createEditastraWidget();
      case 'table':
        return this.createTableWidget(props as Partial<TableWidgetProps>);
      case 'object':
        return this.createObjectWidget(props as Partial<ObjectWidgetProps>);
      case 'connector':
        return this.createConnectorWidget(props as Partial<ConnectorWidgetProps>);
      default:
        return this.createFallbackWidget(type);
    }
  }

  private createChartWidget(): WidgetModel<ChartWidgetProps> {
    // Always start with a placeholder dataset (no environment-dependent behavior).
    // Users can choose Sample / Placeholder / Import from the chart config dropdown.
    const defaultChartData = createEmptyChartData('column');
    
    return {
      id: uuid(),
      type: 'chart',
      position: { x: 120, y: 260 },
      size: { width: 360, height: 240 },
      zIndex: 1,
      props: {
        provider: 'echarts',
        chartType: defaultChartData.chartType,
        data: defaultChartData,
        backgroundColor: '',
        renderMode: 'canvas',
      },
    };
  }

  private createImageWidget(): WidgetModel<ImageWidgetProps> {
    return {
      id: uuid(),
      type: 'image',
      position: { x: 460, y: 120 },
      size: { width: 300, height: 220 },
      zIndex: 1,
      props: {
        src: '',
        alt: '',
        // Default to contain so the full image is always visible (no cropping) when resizing.
        fit: 'contain',
        backgroundColor: '',
      },
    };
  }

  private createEditastraWidget(): WidgetModel<EditastraWidgetProps> {
    return {
      id: uuid(),
      type: 'editastra',
      position: { x: 140, y: 140 },
      size: { width: 360, height: 220 },
      zIndex: 1,
      props: {
        contentHtml: '',
        placeholder: 'Type here…',
        isTemplatePlaceholder: false,
        placeholderResolved: true,
        backgroundColor: 'transparent',
        verticalAlign: 'top',
      },
    };
  }

  private createObjectWidget(props?: Partial<ObjectWidgetProps>): WidgetModel<ObjectWidgetProps> {
    const shapeType = props?.shapeType || 'rectangle';
    const svgPath = this.getShapeSvgPath(shapeType);

    const strokeOnlyShapes = new Set([
      'line',
      'elbow-connector',
      'elbow-arrow',
      'line-arrow',
      'line-arrow-double',
    ]);

    const defaultSize = strokeOnlyShapes.has(shapeType)
      ? { width: 260, height: shapeType === 'line' ? 36 : 90 }
      : { width: 200, height: shapeType === 'circle' ? 200 : 150 };

    return {
      id: uuid(),
      type: 'object',
      position: { x: 100, y: 100 },
      size: defaultSize,
      zIndex: 1,
      props: {
        shapeType,
        svgPath,
        // Empty string represents transparent (matches ColorPicker behavior).
        fillColor: props?.fillColor ?? '',
        opacity: props?.opacity ?? 100,
        // Default to a subtle border so transparent objects are still visible.
        stroke: props?.stroke || { color: '#94a3b8', width: 1, style: 'solid' },
        borderRadius: props?.borderRadius ?? 0,
      },
    };
  }

  private createConnectorWidget(props?: Partial<ConnectorWidgetProps>): WidgetModel<ConnectorWidgetProps> {
    const shapeType = props?.shapeType || 'line';

    const horizontal = new Set(['line', 'line-arrow', 'line-arrow-double']);
    const elbow = new Set(['elbow-connector', 'elbow-arrow']);
    const curved = new Set(['curved-connector', 'curved-arrow', 's-connector', 's-arrow']);

    let defaultSize: { width: number; height: number };
    let startPoint: { x: number; y: number };
    let endPoint: { x: number; y: number };
    let controlPoint: { x: number; y: number } | undefined;
    let arrowEnd = shapeType.includes('arrow');

    if (horizontal.has(shapeType)) {
      // Horizontal line: 200px long, no padding
      defaultSize = { width: 200, height: 1 };
      startPoint = { x: 0, y: 0 };
      endPoint = { x: 200, y: 0 };
    } else if (elbow.has(shapeType)) {
      // Elbow connector: 150x100
      defaultSize = { width: 150, height: 100 };
      startPoint = { x: 0, y: 0 };
      endPoint = { x: 150, y: 100 };

      // Provide a default controlPoint so the existing midpoint-handle UI works.
      // We want the default elbow to match the classic L-shape corner at (start.x, end.y).
      const defaultMidpoint = { x: startPoint.x, y: endPoint.y };
      controlPoint = {
        x: 2 * defaultMidpoint.x - 0.5 * (startPoint.x + endPoint.x),
        y: 2 * defaultMidpoint.y - 0.5 * (startPoint.y + endPoint.y),
      };
    } else if (curved.has(shapeType)) {
      // Curved connector - endpoints at bottom, curve goes up
      // Using bezier math: for control at top-center, the curve peak is at t=0.5
      // Peak Y = 0.25*startY + 0.5*controlY + 0.25*endY
      const curveHeight = 50;
      defaultSize = { width: 200, height: curveHeight };
      startPoint = { x: 0, y: curveHeight };
      endPoint = { x: 200, y: curveHeight };
      // Control point creates the curve - positioned so curve peak is at top
      controlPoint = { x: 100, y: -curveHeight };
    } else {
      defaultSize = { width: 200, height: 1 };
      startPoint = { x: 0, y: 0 };
      endPoint = { x: 200, y: 0 };
    }

    return {
      id: uuid(),
      type: 'connector',
      position: { x: 100, y: 100 },
      size: defaultSize,
      zIndex: 1,
      props: {
        shapeType,
        startPoint,
        endPoint,
        controlPoint,
        // Use same subtle color as object widget borders for consistency.
        fillColor: props?.fillColor || '#94a3b8',
        opacity: props?.opacity ?? 100,
        stroke: props?.stroke || { color: '#94a3b8', width: 1, style: 'solid' },
        arrowEnd,
      },
    };
  }

  /**
   * Get the SVG path for a shape type.
   * Returns empty string for CSS-renderable shapes (rectangle, circle, etc.)
   */
  private getShapeSvgPath(shapeType: string): string {
    // CSS shapes don't need SVG paths
    const cssShapes = ['rectangle', 'square', 'rounded-rectangle', 'circle', 'ellipse'];
    if (cssShapes.includes(shapeType)) {
      return '';
    }
    
    // Import dynamically to avoid circular dependencies
    const paths: Record<string, string> = {
      'triangle': 'M 50 5 L 95 95 L 5 95 Z',
      'diamond': 'M 50 5 L 95 50 L 50 95 L 5 50 Z',
      'pentagon': 'M 50 5 L 95 38 L 79 95 L 21 95 L 5 38 Z',
      'hexagon': 'M 25 5 L 75 5 L 100 50 L 75 95 L 25 95 L 0 50 Z',
      'octagon': 'M 30 5 L 70 5 L 95 30 L 95 70 L 70 95 L 30 95 L 5 70 L 5 30 Z',
      'parallelogram': 'M 20 5 L 95 5 L 80 95 L 5 95 Z',
      'trapezoid': 'M 20 5 L 80 5 L 95 95 L 5 95 Z',
      'line': 'M 0 50 L 100 50',
      'elbow-connector': 'M 10 15 L 10 75 L 90 75',
      'elbow-arrow': 'M 10 15 L 10 75 L 90 75 M 84 69 L 90 75 L 84 81',
      'line-arrow': 'M 0 50 L 100 50 M 92 44 L 100 50 L 92 56',
      'line-arrow-double': 'M 0 50 L 100 50 M 8 44 L 0 50 L 8 56 M 92 44 L 100 50 L 92 56',
      'curved-connector': 'M 0 50 Q 50 10 100 50',
      'curved-arrow': 'M 0 50 Q 50 10 100 50 M 92 44 L 100 50 L 92 56',
      's-connector': 'M 0 20 C 30 20 70 80 100 80',
      's-arrow': 'M 0 20 C 30 20 70 80 100 80 M 92 74 L 100 80 L 92 86',
      'arrow-right': 'M 5 40 L 60 40 L 60 20 L 95 50 L 60 80 L 60 60 L 5 60 Z',
      'arrow-left': 'M 95 40 L 40 40 L 40 20 L 5 50 L 40 80 L 40 60 L 95 60 Z',
      'arrow-up': 'M 40 95 L 40 40 L 20 40 L 50 5 L 80 40 L 60 40 L 60 95 Z',
      'arrow-down': 'M 40 5 L 40 60 L 20 60 L 50 95 L 80 60 L 60 60 L 60 5 Z',
      'arrow-double': 'M 5 50 L 25 25 L 25 40 L 75 40 L 75 25 L 95 50 L 75 75 L 75 60 L 25 60 L 25 75 Z',
      'flowchart-process': 'M 5 5 L 95 5 L 95 95 L 5 95 Z',
      'flowchart-decision': 'M 50 5 L 95 50 L 50 95 L 5 50 Z',
      'flowchart-data': 'M 20 5 L 95 5 L 80 95 L 5 95 Z',
      'flowchart-terminator': 'M 20 5 Q 5 5 5 50 Q 5 95 20 95 L 80 95 Q 95 95 95 50 Q 95 5 80 5 Z',
      'callout-rectangle': 'M 5 5 L 95 5 L 95 70 L 50 70 L 35 95 L 35 70 L 5 70 Z',
      'callout-rounded': 'M 15 5 Q 5 5 5 15 L 5 55 Q 5 65 15 65 L 30 65 L 35 80 L 40 65 L 85 65 Q 95 65 95 55 L 95 15 Q 95 5 85 5 Z',
      'callout-cloud': 'M 30 20 Q 5 15 15 40 Q 0 50 15 65 Q 10 85 35 80 L 25 95 L 40 80 Q 60 90 75 75 Q 95 80 90 60 Q 100 45 85 35 Q 95 15 70 20 Q 55 5 30 20 Z',
      'star-4': 'M 50 5 L 60 40 L 95 50 L 60 60 L 50 95 L 40 60 L 5 50 L 40 40 Z',
      'star-5': 'M 50 5 L 61 38 L 95 38 L 68 59 L 79 95 L 50 73 L 21 95 L 32 59 L 5 38 L 39 38 Z',
      'star-6': 'M 50 5 L 62 30 L 93 20 L 75 45 L 93 80 L 62 70 L 50 95 L 38 70 L 7 80 L 25 45 L 7 20 L 38 30 Z',
      'star-8': 'M 50 5 L 60 25 L 85 10 L 75 35 L 95 50 L 75 65 L 85 90 L 60 75 L 50 95 L 40 75 L 15 90 L 25 65 L 5 50 L 25 35 L 15 10 L 40 25 Z',
      'banner': 'M 5 20 L 95 20 L 85 50 L 95 80 L 5 80 L 15 50 Z',
      'cross': 'M 35 5 L 65 5 L 65 35 L 95 35 L 95 65 L 65 65 L 65 95 L 35 95 L 35 65 L 5 65 L 5 35 L 35 35 Z',
      'heart': 'M 50 90 Q 5 55 5 35 Q 5 10 27 10 Q 45 10 50 30 Q 55 10 73 10 Q 95 10 95 35 Q 95 55 50 90 Z',
      'lightning': 'M 60 5 L 20 50 L 40 50 L 35 95 L 80 45 L 55 45 Z',
      'moon': 'M 70 10 Q 30 10 30 50 Q 30 90 70 90 Q 45 80 45 50 Q 45 20 70 10 Z',
      'cloud': 'M 25 70 Q 5 70 5 55 Q 5 40 20 40 Q 20 25 35 25 Q 45 10 60 20 Q 75 10 85 25 Q 95 30 95 45 Q 100 60 85 70 Z',
    };
    return paths[shapeType] || '';
  }

  private createTableWidget(props?: Partial<TableWidgetProps>): WidgetModel<TableWidgetProps> {
    const rows = props?.rows ?? this.createDefaultTableRows(3, 3);
    const rowCount = Math.max(1, rows.length);
    const colCount = Math.max(1, rows[0]?.cells?.length ?? 1);
    const defaultRowFractions = Array.from({ length: rowCount }, () => 1 / rowCount);
    const defaultColFractions = Array.from({ length: colCount }, () => 1 / colCount);

    // PPT-like default sizing:
    // - Keep a reasonable default width
    // - Start with a small, consistent initial row height so a freshly inserted table doesn't look "huge"
    //   and then collapse when the user types the first character.
    // Keep this in sync with `TABLE_INITIAL_ROW_PX`.
    const defaultWidthPx = TABLE_DEFAULT_WIDTH_PX;
    const initialRowPx = TABLE_INITIAL_ROW_PX;
    const defaultHeightPx = Math.max(20, rowCount * initialRowPx);
    
    return {
      id: uuid(),
      type: 'table',
      position: { x: 80, y: 80 },
      size: { width: defaultWidthPx, height: defaultHeightPx },
      zIndex: 1,
      props: {
        rows,
        showBorders: true,
        rowFractions: props?.rowFractions && props.rowFractions.length === rowCount ? props.rowFractions : defaultRowFractions,
        columnFractions: props?.columnFractions && props.columnFractions.length === colCount ? props.columnFractions : defaultColFractions,
      },
    };
  }

  private createDefaultTableRows(rowCount: number, colCount: number): TableRow[] {
    const rows: TableRow[] = [];
    for (let r = 0; r < rowCount; r++) {
      const cells = [];
      for (let c = 0; c < colCount; c++) {
        cells.push({
          id: `cell-${r}-${c}-${uuid()}`,
          contentHtml: '',
        });
      }
      rows.push({
        id: `row-${r}-${uuid()}`,
        cells,
      });
    }
    return rows;
  }

  private createFallbackWidget(type: WidgetType): WidgetModel {
    return {
      id: uuid(),
      type,
      position: { x: 40, y: 40 },
      size: { width: 200, height: 120 },
      zIndex: 1,
      props: {} as WidgetProps,
    };
  }

  /**
   * Clone a widget with a new ID and optionally offset position
   */
  cloneWidget(widget: WidgetModel, positionOffset?: { x: number; y: number }): WidgetModel {
    const clonedWidget: WidgetModel = {
      ...widget,
      id: uuid(),
      position: positionOffset
        ? {
            x: widget.position.x + positionOffset.x,
            y: widget.position.y + positionOffset.y,
          }
        : { ...widget.position },
    };

    // Deep clone props to avoid reference issues
    clonedWidget.props = JSON.parse(JSON.stringify(widget.props));

    // Deep clone style if it exists
    if (widget.style) {
      clonedWidget.style = { ...widget.style };
    }

    return clonedWidget;
  }
}

