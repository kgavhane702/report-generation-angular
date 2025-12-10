import { Injectable } from '@angular/core';
import { v4 as uuid } from 'uuid';

import {
  WidgetModel,
  WidgetType,
  ChartWidgetProps,
  TableWidgetProps,
  TextWidgetProps,
  WidgetProps,
} from '../../../models/widget.model';
import { createDefaultChartData } from '../../../models/chart-data.model';
import { createDefaultTableData } from '../../../models/table-data.model';

@Injectable({
  providedIn: 'root',
})
export class WidgetFactoryService {
  createWidget(type: WidgetType): WidgetModel {
    switch (type) {
      case 'text':
        return this.createTextWidget();
      case 'chart':
        return this.createChartWidget();
      case 'table':
        return this.createTableWidget();
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
        provider: 'chartjs',
        chartType: defaultChartData.chartType,
        data: defaultChartData,
        renderMode: 'canvas',
      },
    };
  }

  private createTableWidget(): WidgetModel<TableWidgetProps> {
    const defaultTableData = createDefaultTableData();
    
    return {
      id: uuid(),
      type: 'table',
      position: { x: 100, y: 520 },
      size: { width: 520, height: 200 },
      zIndex: 1,
      props: {
        provider: 'html-table',
        allowIconsInColumns: true,
        ...defaultTableData,
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

