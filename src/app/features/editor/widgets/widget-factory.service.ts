import { Injectable } from '@angular/core';
import { v4 as uuid } from 'uuid';

import {
  WidgetModel,
  WidgetType,
  ChartWidgetProps,
  AdvancedTableWidgetProps,
  TextWidgetProps,
  WidgetProps,
} from '../../../models/widget.model';
import { createDefaultChartData } from '../../../models/chart-data.model';

@Injectable({
  providedIn: 'root',
})
export class WidgetFactoryService {
  createWidget(type: WidgetType, options?: { rows?: number; columns?: number }): WidgetModel {
    switch (type) {
      case 'text':
        return this.createTextWidget();
      case 'chart':
        return this.createChartWidget();
      case 'advanced-table':
        return this.createAdvancedTableWidget(options?.rows || 3, options?.columns || 3);
      case 'image':
        return this.createImageWidget();
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

  private createAdvancedTableWidget(rows: number, columns: number): WidgetModel<AdvancedTableWidgetProps> {
    // Calculate default size based on rows and columns
    const cellWidth = 100;
    const cellHeight = 40;
    const defaultWidth = Math.max(columns * cellWidth, 300);
    const defaultHeight = Math.max(rows * cellHeight, 150);
    
    return {
      id: uuid(),
      type: 'advanced-table',
      position: { x: 100, y: 100 },
      size: { width: defaultWidth, height: defaultHeight },
      zIndex: 1,
      props: {
        rows,
        columns,
      },
    };
  }

  private createImageWidget(): WidgetModel {
    return {
      id: uuid(),
      type: 'image',
      position: { x: 460, y: 120 },
      size: { width: 300, height: 220 },
      zIndex: 1,
      props: {
        src: 'https://placehold.co/600x400/png',
        fit: 'cover',
      },
    } as WidgetModel;
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

