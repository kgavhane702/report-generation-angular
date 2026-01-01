import { Injectable } from '@angular/core';
import type { ChartWidgetProps } from '../../../../../models/widget.model';
import type { ChartData } from '../../../../../models/chart-data.model';
import type {
  ChartConfigFormData,
  ChartConfigFormResult,
} from '../ui/chart-config-form/chart-config-form.component';

/**
 * ChartDialogCoordinatorService
 *
 * Pure coordinator for the chart config dialog:
 * - Builds dialog input data (deep-cloned, stable)
 * - Translates dialog results into widget prop patches + pending state
 *
 * This keeps ChartWidgetComponent focused on rendering and interaction wiring.
 */
@Injectable({
  providedIn: 'root',
})
export class ChartDialogCoordinatorService {
  buildDialogData(args: {
    widgetId: string;
    chartProps: ChartWidgetProps;
    pendingChartData?: ChartData;
    opts?: { openImportOnOpen?: boolean; initialTabIndex?: number };
  }): ChartConfigFormData {
    const { widgetId, chartProps, pendingChartData, opts } = args;

    const openImportOnOpen = opts?.openImportOnOpen === true;
    const initialTabIndex =
      Number.isFinite(opts?.initialTabIndex as any) ? Number(opts?.initialTabIndex) : undefined;

    // Use pendingChartData if available (most recent unsaved changes), otherwise use widget data
    const sourceChartData = pendingChartData || (chartProps.data as ChartData);

    const chartData =
      sourceChartData || {
        chartType: 'column',
        labels: [],
        series: [],
      };

    return {
      chartData: this.deepCloneChartData(chartData),
      widgetId,
      initialTabIndex,
      openImportOnOpen,
      dataSource: chartProps.dataSource ?? null,
    };
  }

  applyDialogResult(args: {
    result: ChartConfigFormResult;
    currentProps: ChartWidgetProps;
  }): { pendingChartData?: ChartData; patch?: Partial<ChartWidgetProps> } {
    const { result } = args;

    if (result.cancelled) {
      return {};
    }

    const pendingChartData = result.chartData;
    const patch: Partial<ChartWidgetProps> = {
      chartType: result.chartData.chartType,
      data: result.chartData,
    };

    if (result.dataSource !== undefined) {
      patch.dataSource = result.dataSource;
    }

    return { pendingChartData, patch };
  }

  private deepCloneChartData(data: ChartData): ChartData {
    return {
      ...data,
      labels: data.labels ? [...data.labels] : [],
      labelVisibility: data.labelVisibility ? [...data.labelVisibility] : undefined,
      series: data.series
        ? data.series.map((series) => ({
            ...series,
            data: series.data ? [...series.data] : [],
          }))
        : [],
    };
  }
}


