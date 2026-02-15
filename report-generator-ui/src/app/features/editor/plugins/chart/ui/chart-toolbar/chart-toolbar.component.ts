import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EditorStateService } from '../../../../../../core/services/editor-state.service';
import { ChartToolbarService } from '../../../../../../core/services/chart-toolbar.service';
import { DocumentService } from '../../../../../../core/services/document.service';
import type { ChartWidgetProps } from '../../../../../../models/widget.model';
import type { ChartData, ChartTextStyles } from '../../../../../../models/chart-data.model';
import { ColorPickerComponent, type ColorOption } from '../../../../../../shared/components/color-picker/color-picker.component';
import { AppIconComponent } from '../../../../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-chart-toolbar',
  standalone: true,
  imports: [CommonModule, ColorPickerComponent, AppIconComponent],
  templateUrl: './chart-toolbar.component.html',
  styleUrls: ['./chart-toolbar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChartToolbarComponent {
  private readonly editorState = inject(EditorStateService);
  private readonly chartToolbar = inject(ChartToolbarService);
  private readonly documentService = inject(DocumentService);

  readonly isChartWidgetActive = computed(() => {
    const w = this.editorState.activeWidget();
    return w?.type === 'chart';
  });

  readonly activeChartWidgetId = computed(() => {
    const w = this.editorState.activeWidget();
    return w?.type === 'chart' ? w.id : null;
  });

  readonly activeChartData = computed<ChartData | null>(() => {
    const ctx = this.editorState.activeWidgetContext();
    if (!ctx || ctx.widget.type !== 'chart') return null;
    const props = ctx.widget.props as ChartWidgetProps;
    return (props.data as ChartData) ?? null;
  });

  readonly chartBackgroundColor = computed(() => {
    const ctx = this.editorState.activeWidgetContext();
    if (!ctx || ctx.widget.type !== 'chart') return '';
    const props = ctx.widget.props as ChartWidgetProps;
    return props.backgroundColor || '';
  });

  readonly colorPalette: ColorOption[] = [
    { value: '', label: 'Default' },
    { value: '#ffffff', label: 'White' },
    { value: '#ef4444', label: 'Red' },
    { value: '#10b981', label: 'Green' },
    { value: '#f59e0b', label: 'Orange' },
    { value: '#8b5cf6', label: 'Purple' },
    { value: '#ec4899', label: 'Pink' },
    { value: '#06b6d4', label: 'Cyan' },
    { value: '#84cc16', label: 'Lime' },
    { value: '#6366f1', label: 'Indigo' },
    { value: '#f3f4f6', label: 'Light Gray' },
    { value: '#9ca3af', label: 'Gray' },
    { value: '#1f2937', label: 'Dark Gray' },
    { value: '#000000', label: 'Black' },
  ];

  readonly seriesColorItems = computed(() => {
    const data = this.activeChartData();
    const series = data?.series ?? [];
    return series.slice(0, 6).map((s, index) => ({
      index,
      label: s.name?.trim() || `Series ${index + 1}`,
      color: s.color || data?.colors?.[index] || '',
    }));
  });

  openTab(tabIndex: 0 | 1 | 2 | 3): void {
    const id = this.activeChartWidgetId();
    if (!id) return;
    this.chartToolbar.requestOpenTab(id, tabIndex);
  }

  openImport(): void {
    const id = this.activeChartWidgetId();
    if (!id) return;
    this.chartToolbar.requestOpenImport(id);
  }

  getStyle(part: keyof ChartTextStyles): { color: string; bold: boolean } {
    const d = this.activeChartData();
    const s = d?.textStyles?.[part] as any;
    return {
      color: (s?.color ?? '') as string,
      bold: !!s?.bold,
    };
  }

  isBold(part: keyof ChartTextStyles): boolean {
    return this.getStyle(part).bold;
  }

  toggleBold(part: keyof ChartTextStyles): void {
    const current = this.getStyle(part);
    this.patchTextStyle(part, { bold: !current.bold });
  }

  setColor(part: keyof ChartTextStyles, color: string): void {
    this.patchTextStyle(part, { color: color || undefined });
  }

  setChartBackground(color: string): void {
    const ctx = this.editorState.activeWidgetContext();
    if (!ctx || ctx.widget.type !== 'chart') return;

    const { widget, pageId } = ctx;
    const props = widget.props as ChartWidgetProps;

    this.documentService.updateWidget(pageId, widget.id, {
      props: {
        ...props,
        backgroundColor: color || '',
      } as ChartWidgetProps,
    });
  }

  setSeriesColor(index: number, color: string): void {
    const ctx = this.editorState.activeWidgetContext();
    if (!ctx || ctx.widget.type !== 'chart') return;

    const { widget, pageId } = ctx;
    const props = widget.props as ChartWidgetProps;
    const data = (props.data as ChartData) ?? ({ chartType: 'column', series: [] } as any);
    const nextSeries = [...(data.series ?? [])];

    if (!nextSeries[index]) return;

    nextSeries[index] = {
      ...nextSeries[index],
      color: color || undefined,
    };

    const next: ChartData = {
      ...(data as any),
      series: nextSeries,
      colors: this.buildPaletteFromSeries(nextSeries, data.colors),
    };

    this.documentService.updateWidget(pageId, widget.id, {
      props: {
        ...props,
        data: next,
      } as ChartWidgetProps,
    });
  }

  private buildPaletteFromSeries(series: ChartData['series'], existing?: string[]): string[] | undefined {
    const max = Math.max(series.length, existing?.length ?? 0);
    if (max === 0) return undefined;

    const next = Array.from({ length: max }, (_, i) => series[i]?.color || existing?.[i] || '').filter(Boolean);
    return next.length > 0 ? next : undefined;
  }

  private patchTextStyle(part: keyof ChartTextStyles, patch: { color?: string; bold?: boolean }): void {
    const ctx = this.editorState.activeWidgetContext();
    if (!ctx || ctx.widget.type !== 'chart') return;

    const { widget, pageId } = ctx;
    const props = widget.props as ChartWidgetProps;
    const data = (props.data as ChartData) ?? ({ chartType: 'column', series: [] } as any);

    const next: ChartData = {
      ...(data as any),
      textStyles: {
        ...(data.textStyles ?? {}),
        [part]: {
          ...(data.textStyles?.[part] ?? {}),
          ...patch,
        },
      },
    };

    this.documentService.updateWidget(pageId, widget.id, {
      props: {
        ...props,
        data: next,
      } as ChartWidgetProps,
    });
  }
}


