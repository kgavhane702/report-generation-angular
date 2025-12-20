import { Injectable } from '@angular/core';
import { v4 as uuid } from 'uuid';

import {
  WidgetModel,
  WidgetType,
  ChartWidgetProps,
  TextWidgetProps,
  ImageWidgetProps,
  TableWidgetProps,
  TableRow,
  WidgetProps,
} from '../../../models/widget.model';
import { createDefaultChartData } from '../../../models/chart-data.model';

@Injectable({
  providedIn: 'root',
})
export class WidgetFactoryService {
  createWidget(type: WidgetType, props?: Partial<WidgetProps>): WidgetModel {
    switch (type) {
      case 'text':
        return this.createTextWidget();
      case 'chart':
        return this.createChartWidget();
      case 'image':
        return this.createImageWidget();
      case 'table':
        return this.createTableWidget(props as Partial<TableWidgetProps>);
      default:
        return this.createFallbackWidget(type);
    }
  }

  private createTextWidget(): WidgetModel<TextWidgetProps> {
    return {
      id: uuid(),
      type: 'text',
      position: { x: 80, y: 80 },
      size: { width: 320, height: 140 },
      zIndex: 1,
      props: {
        contentHtml: '<p></p>',
        flowEnabled: true,
      },
    };
  }

  private createChartWidget(): WidgetModel<ChartWidgetProps> {
    const defaultChartData = createDefaultChartData('column');
    
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
        fit: 'cover',
      },
    };
  }

  private createTableWidget(props?: Partial<TableWidgetProps>): WidgetModel<TableWidgetProps> {
    const rows = props?.rows ?? this.createDefaultTableRows(3, 3);
    const rowCount = Math.max(1, rows.length);
    const colCount = Math.max(1, rows[0]?.cells?.length ?? 1);
    const defaultRowFractions = Array.from({ length: rowCount }, () => 1 / rowCount);
    const defaultColFractions = Array.from({ length: colCount }, () => 1 / colCount);
    
    return {
      id: uuid(),
      type: 'table',
      position: { x: 80, y: 80 },
      size: { width: 400, height: 200 },
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

