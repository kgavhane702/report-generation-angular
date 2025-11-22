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
        contentHtml: '<p>Double click to edit text…</p>',
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
        provider: 'highcharts',
        chartType: defaultChartData.chartType,
        data: defaultChartData,
        renderMode: 'svg',
      },
    };
  }

  private createTableWidget(): WidgetModel<TableWidgetProps> {
    return {
      id: uuid(),
      type: 'table',
      position: { x: 100, y: 520 },
      size: { width: 520, height: 200 },
      zIndex: 1,
      props: {
        allowIconsInColumns: true,
        columns: [
          {
            id: uuid(),
            title: 'Metric',
            widthPx: 160,
            align: 'left',
            cellType: 'text',
          },
          {
            id: uuid(),
            title: 'Value',
            widthPx: 120,
            align: 'center',
            cellType: 'number',
            icon: {
              name: 'sparkline-up',
              svg: '<svg viewBox="0 0 24 24"><polyline points="2,12 9,5 15,11 22,4" stroke="currentColor" fill="none"/></svg>',
            },
          },
        ],
        rows: [
          { id: uuid(), cells: ['Revenue', 120000] },
          { id: uuid(), cells: ['Net profit', 48000] },
        ],
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
}

