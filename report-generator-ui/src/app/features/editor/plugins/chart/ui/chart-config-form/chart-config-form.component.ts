import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewEncapsulation,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, Subscription, take, takeUntil } from 'rxjs';
import { AppTabsComponent } from '../../../../../../shared/components/tabs/app-tabs/app-tabs.component';
import { AppTabComponent } from '../../../../../../shared/components/tabs/app-tab/app-tab.component';
import { HttpRequestBuilderComponent } from '../../../../../../shared/http-request/components/http-request-builder/http-request-builder.component';
import { ChartImportApi } from '../../../../../../core/chart-import/api/chart-import.api';
import {
  ChartImportAggregation,
  ChartImportMappingDto,
  ChartImportRequestOptions,
  ChartImportResponseDto,
  TabularPreviewDto,
} from '../../../../../../core/chart-import/models/chart-import.model';
import { ImportFormat } from '../../../../../../core/tabular-import/enums/import-format.enum';
import { TabularImportWarningDto } from '../../../../../../core/tabular-import/models/tabular-dataset.model';
import type { HttpRequestSpec } from '../../../../../../shared/http-request/models/http-request.model';
import type { ChartHttpDataSourceConfig } from '../../../../../../shared/http-request/models/http-data-source.model';

import {
  ChartData,
  ChartSeries,
  ChartType,
  type ChartNumberScale,
  createDefaultChartData,
  createEmptyChartData,
} from '../../../../../../models/chart-data.model';

export interface ChartConfigFormData {
  chartData: ChartData;
  widgetId?: string;
  /** Optional initial tab index when opening config from toolbar. */
  initialTabIndex?: number;
  /** When true, the dialog should open directly on the Data tab and prompt for file import. */
  openImportOnOpen?: boolean;
  /** Optional persisted remote source (URL-based chart). */
  dataSource?: ChartHttpDataSourceConfig | null;
}

export interface ChartConfigFormResult {
  chartData: ChartData;
  cancelled: boolean;
  /** When set (including null), updates the widget's persisted data source. */
  dataSource?: ChartHttpDataSourceConfig | null;
}

@Component({
  selector: 'app-chart-config-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AppTabsComponent, AppTabComponent, HttpRequestBuilderComponent],
  exportAs: 'chartConfigForm',
  templateUrl: './chart-config-form.component.html',
  styleUrls: ['./chart-config-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Make BEM classes usable from the modal header/footer projected from the parent template.
  encapsulation: ViewEncapsulation.None,
})
export class ChartConfigFormComponent implements OnInit, OnChanges, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly chartImportApi = inject(ChartImportApi);
  private readonly destroy$ = new Subject<void>();
  private chartTypeSubscription?: Subscription;
  private importPreviewSubscription?: Subscription;

  @Input() data?: ChartConfigFormData;
  @Output() closed = new EventEmitter<ChartConfigFormResult>();

  /** Tabs: 0=Chart, 1=Data, 2=Axes, 3=Legend & Labels */
  activeTabIndex = 0;
  /** Import sub-tabs: 0=Browse, 1=URL, 2=Data (mapping/preview) */
  importTabIndex = 0;

  readonly chartTypes: ChartType[] = [
    'column',
    'bar',
    'line',
    'area',
    'pie',
    'donut',
    'scatter',
    'stackedColumn',
    'stackedBar',
    'stackedBarLine',
    'stackedOverlappedBarLine',
  ];

  readonly chartTypeLabels: Record<ChartType, string> = {
    column: 'Column',
    bar: 'Bar',
    line: 'Line',
    area: 'Area',
    pie: 'Pie',
    donut: 'Donut',
    scatter: 'Scatter',
    stackedColumn: 'Stacked Column',
    stackedBar: 'Stacked Bar',
    stackedBarLine: 'Stacked Bar/Line',
    stackedOverlappedBarLine: 'Stacked Overlapped Bar/Line',
  };

  readonly legendPositions: Array<'top' | 'bottom' | 'left' | 'right'> = ['top', 'bottom', 'left', 'right'];
  readonly valueLabelPositions: Array<'inside' | 'top' | 'bottom' | 'left' | 'right'> = [
    'inside',
    'top',
    'bottom',
    'left',
    'right',
  ];

  readonly numberScales: ChartNumberScale[] = ['auto', 'none', 'thousand', 'million', 'billion'];
  readonly wrapModes: Array<'word' | 'char'> = ['word', 'char'];

  readonly lineStyles: Array<'solid' | 'dashed' | 'dotted' | 'dashDot' | 'longDash' | 'longDashDot' | 'longDashDotDot'> = [
    'solid',
    'dashed',
    'dotted',
    'dashDot',
    'longDash',
    'longDashDot',
    'longDashDotDot',
  ];

  readonly lineStyleLabels: Record<string, string> = {
    solid: 'Solid',
    dashed: 'Dashed',
    dotted: 'Dotted',
    dashDot: 'Dash Dot',
    longDash: 'Long Dash',
    longDashDot: 'Long Dash Dot',
    longDashDotDot: 'Long Dash Dot Dot',
  };

  form!: FormGroup;
  selectedFileName: string | null = null;

  // Import (backend-driven)
  importInProgress = false;
  importError: string | null = null;
  importResponse: ChartImportResponseDto | null = null;
  importPreview: TabularPreviewDto | null = null;
  importMapping: ChartImportMappingDto | null = null;
  importWarnings: TabularImportWarningDto[] = [];
  selectedImportFile: File | null = null;
  detectedImportFormat: ImportFormat | null = null;
  selectedSeriesColumns = new Set<number>();

  importSourceMode: 'file' | 'url' = 'file';
  urlRequest: HttpRequestSpec = {
    url: '',
    method: 'GET',
    timeoutMs: 20000,
    followRedirects: true,
    queryParams: [{ key: '', value: '', enabled: true }],
    headers: [{ key: '', value: '', enabled: true }],
  };
  /** Optional format override for URL imports; otherwise backend detects. */
  urlFormatOverride: ImportFormat | null = null;

  readonly aggregationOptions: ChartImportAggregation[] = ['SUM', 'AVG', 'COUNT'];

  // Expose enum for template comparisons.
  readonly ImportFormat = ImportFormat;

  readonly importForm = this.fb.group({
    sheetIndex: [0],
    delimiter: [','],
    hasHeader: [true],
    headerRowIndex: [0],
    categoryColumnIndex: [0],
    aggregation: ['SUM' as ChartImportAggregation],
  });

  setImportSourceMode(mode: 'file' | 'url'): void {
    if (this.importInProgress) return;
    if (this.importSourceMode === mode) return;

    this.importSourceMode = mode;

    // Reset last results
    this.importError = null;
    this.importResponse = null;
    this.importPreview = null;
    this.importMapping = null;
    this.importWarnings = [];
    this.selectedSeriesColumns.clear();

    if (mode === 'url') {
      // Clear file-specific state
      this.selectedFileName = null;
      this.selectedImportFile = null;
      this.detectedImportFormat = null;
    }

    this.updateImportFormDisabledState();
    this.cdr.markForCheck();
  }

  private updateImportFormDisabledState(): void {
    if (this.importInProgress) {
      // Disable all import form controls when importing
      this.importForm.get('sheetIndex')?.disable();
      this.importForm.get('delimiter')?.disable();
      this.importForm.get('headerRowIndex')?.disable();
      this.importForm.get('categoryColumnIndex')?.disable();
      this.importForm.get('aggregation')?.disable();
    } else {
      // Enable controls based on conditions
      this.importForm.get('sheetIndex')?.enable();
      this.importForm.get('delimiter')?.enable();
      this.importForm.get('headerRowIndex')?.enable();
      
      // categoryColumnIndex should be disabled if no preview yet
      if (!this.importPreview) {
        this.importForm.get('categoryColumnIndex')?.disable();
      } else {
        this.importForm.get('categoryColumnIndex')?.enable();
      }
      
      this.importForm.get('aggregation')?.enable();
    }
  }

  ngOnInit(): void {
    if (this.data) {
      this.initializeFormFromData();
    }

    // Allow opening a specific tab directly (e.g., from chart toolbar buttons).
    if (Number.isFinite(this.data?.initialTabIndex as any)) {
      this.activeTabIndex = Math.max(0, Math.min(3, Number(this.data?.initialTabIndex)));
    }

    if (this.data?.openImportOnOpen) {
      this.openImportFlow();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] && this.data) {
      if (!changes['data'].firstChange) {
        this.initializeFormFromData();
        this.cdr.markForCheck();
      }

      if (Number.isFinite(this.data?.initialTabIndex as any)) {
        this.activeTabIndex = Math.max(0, Math.min(3, Number(this.data?.initialTabIndex)));
      }

      if (this.data?.openImportOnOpen) {
        this.openImportFlow();
      }
    }
  }

  ngOnDestroy(): void {
    if (this.chartTypeSubscription) {
      this.chartTypeSubscription.unsubscribe();
    }
    if (this.importPreviewSubscription) {
      this.importPreviewSubscription.unsubscribe();
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  private openImportFlow(): void {
    // Data tab
    this.activeTabIndex = 1;
    this.importTabIndex = 0;
    this.setImportSourceMode('file');
    this.cdr.markForCheck();
  }

  private initializeFormFromData(): void {
    const chartData = this.normalizeChartDataForForm(this.data?.chartData || createEmptyChartData());
    this.initializeForm(chartData);

    // Initialize URL-based source if present.
    const ds = this.data?.dataSource ?? null;
    if (ds && ds.kind === 'http') {
      this.importSourceMode = 'url';
      this.importTabIndex = 1;
      this.urlRequest = ds.request;
      this.urlFormatOverride = ds.format ?? null;
      this.importForm.patchValue(
        {
          sheetIndex: ds.sheetIndex ?? 0,
          delimiter: ds.delimiter ?? ',',
          hasHeader: ds.hasHeader ?? true,
          headerRowIndex: ds.headerRowIndex ?? 0,
          categoryColumnIndex: ds.categoryColumnIndex ?? 0,
          aggregation: (ds.aggregation as any) ?? ('SUM' as ChartImportAggregation),
        },
        { emitEvent: false }
      );
      this.selectedSeriesColumns = new Set(ds.seriesColumnIndexes || []);
    } else {
      this.importSourceMode = 'file';
      this.importTabIndex = 0;
    }

    if (this.chartTypeSubscription) {
      this.chartTypeSubscription.unsubscribe();
    }

    this.chartTypeSubscription = this.form
      .get('chartType')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((chartType: ChartType) => {
        if ((chartType === 'stackedBarLine' || chartType === 'stackedOverlappedBarLine') && this.seriesFormArray.length > 1) {
          this.seriesFormArray.controls.forEach((seriesGroup, index) => {
            const group = seriesGroup as FormGroup;
            const seriesTypeControl = group.get('seriesType');
            if (seriesTypeControl) {
              seriesTypeControl.setValue(index === 0 ? 'bar' : 'line', { emitEvent: false });
            } else {
              group.addControl('seriesType', this.fb.control(index === 0 ? 'bar' : 'line'));
            }
          });
        }
      });
  }

  private initializeForm(chartData: ChartData): void {
    const normalized = this.normalizeChartDataForForm(chartData);
    const visibility = (normalized.labelVisibility ?? (normalized.labels || []).map(() => true)).map((v) => v !== false);
    const numberFormat = normalized.numberFormat ?? { scale: 'auto', decimals: 1, useGrouping: true };
    const labelWrap = normalized.labelWrap ?? { enabled: true, maxLines: 2, mode: 'word' as const };
    const typography = normalized.typography ?? { responsive: true, scaleFactor: 1 };
    const textStyles = normalized.textStyles ?? {};
    const titleStyle = textStyles.title ?? {};
    const legendStyle = textStyles.legend ?? {};
    const axisStyle = textStyles.axis ?? {};
    const valueLabelStyle = textStyles.valueLabel ?? {};

    this.form = this.fb.group({
      chartType: [normalized.chartType, Validators.required],
      title: [normalized.title || ''],
      xAxisLabel: [normalized.xAxisLabel || ''],
      yAxisLabel: [normalized.yAxisLabel || ''],
      showLegend: [normalized.showLegend !== false],
      legendPosition: [normalized.legendPosition || 'bottom'],
      showAxisLines: [normalized.showAxisLines === true],
      showValueLabels: [normalized.showValueLabels !== false],
      valueLabelPosition: [normalized.valueLabelPosition || 'inside'],

      // Chart-level formatting defaults
      numberScale: [numberFormat.scale],
      numberDecimals: [numberFormat.decimals],
      numberUseGrouping: [numberFormat.useGrouping !== false],
      numberLocale: [numberFormat.locale || ''],

      // Wrapping (applies to category + legend labels)
      wrapEnabled: [labelWrap.enabled !== false],
      wrapMaxLines: [labelWrap.maxLines ?? 2],
      wrapMode: [labelWrap.mode ?? 'word'],

      // Typography responsiveness
      typographyResponsive: [typography.responsive !== false],
      typographyScaleFactor: [Number.isFinite((typography as any).scaleFactor) ? (typography as any).scaleFactor : 1],

      // Text styles (color + bold)
      titleTextColor: [titleStyle.color || ''],
      titleTextBold: [!!titleStyle.bold],
      legendTextColor: [legendStyle.color || ''],
      legendTextBold: [!!legendStyle.bold],
      axisTextColor: [axisStyle.color || ''],
      axisTextBold: [!!axisStyle.bold],
      valueLabelTextColor: [valueLabelStyle.color || ''],
      valueLabelTextBold: [!!valueLabelStyle.bold],

      labels: this.fb.array((normalized.labels || []).map((label: string) => this.fb.control(label))),
      labelVisibility: this.fb.array(visibility.map((v) => this.fb.control(v))),
      series: this.fb.array(
        normalized.series.map((series: ChartSeries, index: number) =>
          this.createSeriesFormGroup(series, index, normalized.chartType, normalized.numberFormat)
        )
      ),
    });
  }

  private createSeriesFormGroup(
    series: ChartSeries = { name: '', data: [] },
    index: number = 0,
    chartType: ChartType = 'column',
    chartNumberFormat?: ChartData['numberFormat']
  ): FormGroup {
    const dataArray = this.fb.array((series.data || []).map((value: number) => this.fb.control(value)));

    const defaultSeriesType =
      chartType === 'stackedBarLine' || chartType === 'stackedOverlappedBarLine' ? (index === 0 ? 'bar' : 'line') : undefined;
    const seriesType = series.type || defaultSeriesType;

    const seriesNumberFormat = series.numberFormat ?? chartNumberFormat ?? { scale: 'auto', decimals: 1, useGrouping: true };
    const numberFormatMode: 'inherit' | 'custom' = series.numberFormat ? 'custom' : 'inherit';
    const valueLabelsMode: 'inherit' | 'show' | 'hide' =
      typeof series.showValueLabels === 'boolean' ? (series.showValueLabels ? 'show' : 'hide') : 'inherit';

    return this.fb.group({
      name: [series.name || '', Validators.required],
      color: [series.color || ''],
      data: dataArray,
      seriesType: [seriesType],
      lineStyle: [series.lineStyle || 'solid'],

      // Per-series overrides (optional)
      valueLabelsMode: [valueLabelsMode],
      valueLabelPositionOverride: [series.valueLabelPosition || ''],

      numberFormatMode: [numberFormatMode],
      numberScale: [seriesNumberFormat.scale],
      numberDecimals: [seriesNumberFormat.decimals],
      numberUseGrouping: [seriesNumberFormat.useGrouping !== false],
      numberLocale: [seriesNumberFormat.locale || ''],
    });
  }

  get labelsFormArray(): FormArray {
    return this.form.get('labels') as FormArray;
  }

  get labelVisibilityFormArray(): FormArray {
    return this.form.get('labelVisibility') as FormArray;
  }

  get seriesFormArray(): FormArray {
    return this.form.get('series') as FormArray;
  }

  get visibleLabelIndexes(): number[] {
    const values = (this.labelVisibilityFormArray?.value as boolean[] | undefined) ?? [];
    const out: number[] = [];
    for (let i = 0; i < values.length; i++) {
      if (values[i]) out.push(i);
    }
    return out;
  }

  get areAllLabelsSelected(): boolean {
    const values = (this.labelVisibilityFormArray?.value as boolean[] | undefined) ?? [];
    return values.length > 0 && values.every(Boolean);
  }

  get isLabelSelectionIndeterminate(): boolean {
    const values = (this.labelVisibilityFormArray?.value as boolean[] | undefined) ?? [];
    const selected = values.filter(Boolean).length;
    return selected > 0 && selected < values.length;
  }

  get selectedLabelCount(): number {
    const values = (this.labelVisibilityFormArray?.value as boolean[] | undefined) ?? [];
    return values.filter(Boolean).length;
  }

  get currentChartType(): ChartType {
    return this.form?.value?.chartType || 'column';
  }

  get isStackedBarLineChart(): boolean {
    return this.currentChartType === 'stackedBarLine' || this.currentChartType === 'stackedOverlappedBarLine';
  }

  get hasMultipleSeries(): boolean {
    return this.seriesFormArray.length > 1;
  }

  get shouldShowSeriesTypeSelector(): boolean {
    // Show bar/line selector for combo chart types even when there is only one series.
    // This lets users switch a single imported series between bar and line and then pick line styles.
    return this.isStackedBarLineChart;
  }

  shouldShowLineStyle(seriesIndex: number): boolean {
    const chartType = this.currentChartType;
    if (chartType === 'line' || chartType === 'area') return true;
    if (chartType === 'stackedBarLine' || chartType === 'stackedOverlappedBarLine') {
      const seriesGroup = this.seriesFormArray.at(seriesIndex) as FormGroup;
      const seriesType = seriesGroup?.get('seriesType')?.value;
      return seriesType === 'line';
    }
    return false;
  }

  get previewColumnIndexes(): number[] {
    const cols = this.importPreview?.totalCols ?? 0;
    return Array.from({ length: cols }, (_, i) => i);
  }

  addLabel(): void {
    this.labelsFormArray.push(this.fb.control(''));
    this.labelVisibilityFormArray.push(this.fb.control(true));
    // Keep all series aligned with labels (new label = new data point).
    this.seriesFormArray.controls.forEach((seriesGroup) => {
      const dataArray = seriesGroup.get('data') as FormArray;
      dataArray.push(this.fb.control(0));
    });
  }

  removeLabel(index: number): void {
    this.labelsFormArray.removeAt(index);
    if (this.labelVisibilityFormArray.length > index) {
      this.labelVisibilityFormArray.removeAt(index);
    }
    this.seriesFormArray.controls.forEach((seriesGroup) => {
      const dataArray = seriesGroup.get('data') as FormArray;
      if (dataArray.length > index) {
        dataArray.removeAt(index);
      }
    });
  }

  addSeries(): void {
    const dataLength = this.labelsFormArray.length || 4;
    const emptyData = Array(dataLength).fill(0);
    const chartType = this.form.value.chartType;
    const newIndex = this.seriesFormArray.length;
    this.seriesFormArray.push(
      this.createSeriesFormGroup({ name: 'New Series', data: emptyData }, newIndex, chartType, this.buildChartNumberFormatFromForm())
    );
  }

  removeSeries(index: number): void {
    this.seriesFormArray.removeAt(index);
  }

  getSeriesDataArray(index: number): FormArray {
    const seriesGroup = this.seriesFormArray.at(index) as FormGroup;
    return seriesGroup.get('data') as FormArray;
  }

  addDataPoint(seriesIndex: number): void {
    const dataArray = this.getSeriesDataArray(seriesIndex);
    dataArray.push(this.fb.control(0));
    if (this.labelsFormArray.length < dataArray.length) {
      // New category added - keep everything aligned.
      this.labelsFormArray.push(this.fb.control(`Item ${dataArray.length}`));
      this.labelVisibilityFormArray.push(this.fb.control(true));
      this.seriesFormArray.controls.forEach((seriesGroup, idx) => {
        if (idx === seriesIndex) return;
        const otherDataArray = seriesGroup.get('data') as FormArray;
        while (otherDataArray.length < this.labelsFormArray.length) {
          otherDataArray.push(this.fb.control(0));
        }
      });
    }
  }

  removeDataPoint(seriesIndex: number, dataIndex: number): void {
    const dataArray = this.getSeriesDataArray(seriesIndex);
    dataArray.removeAt(dataIndex);

    if (this.allSeriesEmptyAt(dataIndex)) {
      this.labelsFormArray.removeAt(dataIndex);
      if (this.labelVisibilityFormArray.length > dataIndex) {
        this.labelVisibilityFormArray.removeAt(dataIndex);
      }
    }

    this.seriesFormArray.controls.forEach((seriesGroup, idx) => {
      if (idx !== seriesIndex) {
        const otherDataArray = seriesGroup.get('data') as FormArray;
        if (otherDataArray.length > dataIndex) {
          otherDataArray.removeAt(dataIndex);
        }
      }
    });
  }

  private allSeriesEmptyAt(index: number): boolean {
    return this.seriesFormArray.controls.every((seriesGroup) => {
      const dataArray = seriesGroup.get('data') as FormArray;
      return dataArray.length <= index;
    });
  }

  syncDataPoints(): void {
    const labelCount = this.labelsFormArray.length;
    this.seriesFormArray.controls.forEach((seriesGroup) => {
      const dataArray = seriesGroup.get('data') as FormArray;
      while (dataArray.length < labelCount) dataArray.push(this.fb.control(0));
      while (dataArray.length > labelCount) dataArray.removeAt(dataArray.length - 1);
    });

    // Keep visibility array aligned with labels.
    while (this.labelVisibilityFormArray.length < labelCount) this.labelVisibilityFormArray.push(this.fb.control(true));
    while (this.labelVisibilityFormArray.length > labelCount) this.labelVisibilityFormArray.removeAt(this.labelVisibilityFormArray.length - 1);
  }

  toggleAllLabels(event: Event): void {
    const input = event.target as HTMLInputElement;
    const checked = !!input.checked;
    this.labelVisibilityFormArray.controls.forEach((ctrl) => ctrl.setValue(checked));
  }

  trackByIndex(index: number): number {
    return index;
  }

  private normalizeChartDataForForm(input: ChartData): ChartData {
    const labels = [...(input.labels ?? [])];
    const normalizedSeries = (input.series ?? []).map((s) => ({
      ...s,
      data: [...(s.data ?? [])],
    }));
    const labelVisibility = [...(input.labelVisibility ?? [])];

    const maxLength = Math.max(labels.length, labelVisibility.length, ...normalizedSeries.map((s) => s.data.length), 0);

    while (labels.length < maxLength) {
      labels.push(`Item ${labels.length + 1}`);
    }

    normalizedSeries.forEach((s) => {
      while (s.data.length < maxLength) s.data.push(0);
      while (s.data.length > maxLength) s.data.pop();
    });

    while (labelVisibility.length < maxLength) labelVisibility.push(true);
    while (labelVisibility.length > maxLength) labelVisibility.pop();

    return {
      ...input,
      labels,
      series: normalizedSeries,
      labelVisibility: labelVisibility.map((v) => v !== false),
    };
  }

  onImportFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const detected = this.detectImportFormat(file.name);
    if (!detected) {
      this.importError = 'Unsupported file format. Please select .xlsx, .csv, .json, or .xml.';
      this.selectedFileName = null;
      this.selectedImportFile = null;
      this.detectedImportFormat = null;
      this.cdr.markForCheck();
      return;
    }

    this.selectedImportFile = file;
    this.selectedFileName = file.name;
    this.detectedImportFormat = detected;
    this.importSourceMode = 'file';

    // Reset last results
    this.importError = null;
    this.importResponse = null;
    this.importPreview = null;
    this.importMapping = null;
    this.importWarnings = [];
    this.selectedSeriesColumns.clear();

    // Auto-run preview import
    this.importTabIndex = 2;
    this.previewImport();
  }

  onImportTabChanged(index: number): void {
    this.importTabIndex = index;
    if (index === 0) {
      this.setImportSourceMode('file');
    } else if (index === 1) {
      this.setImportSourceMode('url');
    }
  }

  submitUrlImport(): void {
    if (this.importInProgress) return;
    this.setImportSourceMode('url');
    this.importTabIndex = 2;
    this.previewImport();
  }

  previewImport(): void {
    if (!this.form) return;

    // Cancel any in-flight preview import to avoid race conditions (spinner hiding too early, stale preview, etc).
    if (this.importPreviewSubscription) {
      this.importPreviewSubscription.unsubscribe();
      this.importPreviewSubscription = undefined;
    }

    const chartType: ChartType = (this.form.value.chartType as ChartType) || 'column';

    const hasHeader = !!this.importForm.value.hasHeader;
    const seriesColumnIndexes = Array.from(this.selectedSeriesColumns.values()).sort((a, b) => a - b);

    this.importInProgress = true;
    this.importError = null;
    this.updateImportFormDisabledState();
    this.cdr.markForCheck();

    if (this.importSourceMode === 'file') {
      if (!this.selectedImportFile) {
        this.importError = 'No file selected.';
        this.cdr.markForCheck();
        return;
      }

      const req = {
        file: this.selectedImportFile,
        chartType,
        format: this.detectedImportFormat ?? undefined,
        sheetIndex: this.detectedImportFormat === ImportFormat.XLSX ? (this.importForm.value.sheetIndex ?? undefined) : undefined,
        delimiter: this.detectedImportFormat === ImportFormat.CSV ? (this.importForm.value.delimiter ?? undefined) : undefined,
        hasHeader,
        headerRowIndex: this.importForm.value.headerRowIndex ?? 0,
        categoryColumnIndex: this.importForm.value.categoryColumnIndex ?? 0,
        seriesColumnIndexes: seriesColumnIndexes.length > 0 ? seriesColumnIndexes : undefined,
        aggregation: (this.importForm.value.aggregation as ChartImportAggregation) ?? 'SUM',
      } satisfies ChartImportRequestOptions;

      this.importPreviewSubscription = this.chartImportApi
        .importChart(req)
        .pipe(take(1))
        .subscribe(this.buildPreviewSubscribeHandlers());
      return;
    }

    // URL mode
    const url = (this.urlRequest?.url ?? '').trim();
    if (!url) {
      this.importError = 'No URL provided.';
      this.cdr.markForCheck();
      return;
    }

    const urlReq = {
      request: this.urlRequest,
      chartType,
      format: this.urlFormatOverride ?? undefined,
      sheetIndex: this.importForm.value.sheetIndex ?? undefined,
      delimiter: this.importForm.value.delimiter ?? undefined,
      hasHeader,
      headerRowIndex: this.importForm.value.headerRowIndex ?? 0,
      categoryColumnIndex: this.importForm.value.categoryColumnIndex ?? 0,
      seriesColumnIndexes: seriesColumnIndexes.length > 0 ? seriesColumnIndexes : undefined,
      aggregation: (this.importForm.value.aggregation as ChartImportAggregation) ?? 'SUM',
    };

    this.importPreviewSubscription = this.chartImportApi
      .importChartFromUrl(urlReq as any)
      .pipe(take(1))
      .subscribe(this.buildPreviewSubscribeHandlers());
  }

  private buildPreviewSubscribeHandlers(): {
    next: (resp: any) => void;
    error: (err: any) => void;
  } {
    return {
      next: (resp) => {
        this.importInProgress = false;
        this.importPreviewSubscription = undefined;
        this.updateImportFormDisabledState();

        if (!resp?.success || !resp.data) {
          this.importError = resp?.error?.message || 'Chart import failed';
          this.importWarnings = [];
          this.cdr.markForCheck();
          return;
        }

        this.importResponse = resp.data;
        this.importPreview = resp.data.preview;
        this.importMapping = resp.data.mapping;
        this.importWarnings = resp.data.warnings || [];

        // Sync mapping controls with backend-inferred mapping.
        this.importForm.patchValue(
          {
            hasHeader: resp.data.mapping.hasHeader,
            headerRowIndex: resp.data.mapping.headerRowIndex,
            categoryColumnIndex: resp.data.mapping.categoryColumnIndex,
            aggregation: resp.data.mapping.aggregation,
          },
          { emitEvent: false }
        );
        this.selectedSeriesColumns = new Set(resp.data.mapping.seriesColumnIndexes || []);

        this.cdr.markForCheck();
      },
      error: (err) => {
        this.importInProgress = false;
        this.importPreviewSubscription = undefined;
        this.updateImportFormDisabledState();
        // eslint-disable-next-line no-console
        console.error('Chart import failed', err);
        const msg =
          err?.error?.error?.message ||
          err?.error?.message ||
          err?.message ||
          'Chart import failed. Please verify the backend is running and the input is valid.';
        this.importError = msg;
        this.cdr.markForCheck();
      },
    };
  }

  applyImportToChart(): void {
    const imported = this.importResponse?.chartData as unknown as ChartData | undefined;
    if (!imported) return;
    this.applyImportedDataset(imported);
    this.cdr.markForCheck();
  }

  isSeriesColumnSelected(colIndex: number): boolean {
    return this.selectedSeriesColumns.has(colIndex);
  }

  toggleSeriesColumn(colIndex: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const checked = !!input.checked;
    if (checked) this.selectedSeriesColumns.add(colIndex);
    else this.selectedSeriesColumns.delete(colIndex);
  }

  previewColumnLabel(colIndex: number): string {
    const preview = this.importPreview;
    if (!preview) return `Column ${colIndex + 1}`;
    const hasHeader = !!this.importForm.value.hasHeader;
    const headerRowIndex = this.importForm.value.headerRowIndex ?? 0;
    if (hasHeader && headerRowIndex >= 0 && headerRowIndex < preview.rows.length) {
      const headerRow = preview.rows[headerRowIndex];
      const text = (headerRow?.[colIndex] ?? '').trim();
      if (text) return text;
    }
    return `Column ${colIndex + 1}`;
  }

  private detectImportFormat(fileName: string): ImportFormat | null {
    const lower = (fileName || '').toLowerCase();
    if (lower.endsWith('.xlsx')) return ImportFormat.XLSX;
    if (lower.endsWith('.csv')) return ImportFormat.CSV;
    if (lower.endsWith('.json')) return ImportFormat.JSON;
    if (lower.endsWith('.xml')) return ImportFormat.XML;
    return null;
  }

  private applyImportedDataset(imported: ChartData): void {
    if (!this.form) return;

    // Preserve chart presentation config.
    const preserved = {
      title: this.form.value.title,
      xAxisLabel: this.form.value.xAxisLabel,
      yAxisLabel: this.form.value.yAxisLabel,
      showLegend: this.form.value.showLegend,
      legendPosition: this.form.value.legendPosition,
      showAxisLines: this.form.value.showAxisLines,
      showValueLabels: this.form.value.showValueLabels,
      valueLabelPosition: this.form.value.valueLabelPosition,

      numberScale: this.form.value.numberScale,
      numberDecimals: this.form.value.numberDecimals,
      numberUseGrouping: this.form.value.numberUseGrouping,
      numberLocale: this.form.value.numberLocale,

      wrapEnabled: this.form.value.wrapEnabled,
      wrapMaxLines: this.form.value.wrapMaxLines,
      wrapMode: this.form.value.wrapMode,

      typographyResponsive: this.form.value.typographyResponsive,
      typographyScaleFactor: this.form.value.typographyScaleFactor,

      titleTextColor: this.form.value.titleTextColor,
      titleTextBold: this.form.value.titleTextBold,
      legendTextColor: this.form.value.legendTextColor,
      legendTextBold: this.form.value.legendTextBold,
      axisTextColor: this.form.value.axisTextColor,
      axisTextBold: this.form.value.axisTextBold,
      valueLabelTextColor: this.form.value.valueLabelTextColor,
      valueLabelTextBold: this.form.value.valueLabelTextBold,
    };

    const chartType: ChartType = (this.form.value.chartType as ChartType) || 'column';

    const nextLabels = [...(imported.labels ?? [])];
    this.labelsFormArray.clear();
    this.labelVisibilityFormArray.clear();
    nextLabels.forEach((label) => {
      this.labelsFormArray.push(this.fb.control(label));
      this.labelVisibilityFormArray.push(this.fb.control(true));
    });

    // Preserve per-series styling (color/lineStyle) by index when possible.
    const existingSeries = (this.seriesFormArray?.value as any[] | undefined) ?? [];
    const importedSeries = imported.series ?? [];

    this.seriesFormArray.clear();
    importedSeries.forEach((s: any, index: number) => {
      const existing = existingSeries[index] || {};
      const data: number[] = Array.isArray(s.data) ? [...s.data] : [];

      // Keep series aligned with labels.
      while (data.length < nextLabels.length) data.push(0);
      while (data.length > nextLabels.length) data.pop();

      const merged: ChartSeries = {
        name: (s.name ?? existing.name ?? `Series ${index + 1}`) as string,
        data,
        color: (s.color || existing.color || undefined) as string | undefined,
        type: (s.type || existing.seriesType || undefined) as ChartType | undefined,
        lineStyle: (s.lineStyle || existing.lineStyle || undefined) as any,
        ...this.buildSeriesOverridesFromForm(existing),
      };

      this.seriesFormArray.push(this.createSeriesFormGroup(merged, index, chartType, this.buildChartNumberFormatFromForm(preserved)));
    });

    this.form.patchValue(preserved, { emitEvent: false });
  }

  private buildChartNumberFormatFromForm(source?: any): ChartData['numberFormat'] {
    // Allow building from a saved "preserved" object or from the current form.
    const v = source ?? this.form?.value ?? {};
    const locale = (v.numberLocale ?? '').toString().trim();
    return {
      scale: (v.numberScale ?? 'auto') as any,
      decimals: clampInt(v.numberDecimals, 0, 8),
      useGrouping: v.numberUseGrouping !== false,
      locale: locale || undefined,
    };
  }

  private buildSeriesOverridesFromForm(existingSeriesFormValue: any): Partial<ChartSeries> {
    if (!existingSeriesFormValue) return {};

    // Value labels
    const valueLabelsMode = (existingSeriesFormValue.valueLabelsMode ?? 'inherit') as 'inherit' | 'show' | 'hide';
    const showValueLabels =
      valueLabelsMode === 'inherit' ? undefined : valueLabelsMode === 'show' ? true : false;
    const valueLabelPosition = (existingSeriesFormValue.valueLabelPositionOverride ?? '').toString().trim();

    // Number formatting
    const numberFormatMode = (existingSeriesFormValue.numberFormatMode ?? 'inherit') as 'inherit' | 'custom';
    const locale = (existingSeriesFormValue.numberLocale ?? '').toString().trim();
    const numberFormat =
      numberFormatMode === 'custom'
        ? {
            scale: (existingSeriesFormValue.numberScale ?? 'auto') as any,
            decimals: clampInt(existingSeriesFormValue.numberDecimals, 0, 8),
            useGrouping: existingSeriesFormValue.numberUseGrouping !== false,
            locale: locale || undefined,
          }
        : undefined;

    return {
      showValueLabels,
      valueLabelPosition: valueLabelPosition ? (valueLabelPosition as any) : undefined,
      numberFormat: numberFormat as any,
    };
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const formValue = this.form.value;
    const labels: string[] = (formValue.labels || []).map((l: string, idx: number) => {
      const trimmed = (l ?? '').trim();
      return trimmed ? trimmed : `Item ${idx + 1}`;
    });
    const visibilityRaw: boolean[] = (formValue.labelVisibility || []) as boolean[];
    const labelVisibility: boolean[] = labels.map((_, idx) => visibilityRaw[idx] !== false);
    const chartData: ChartData = {
      chartType: formValue.chartType,
      labels,
      labelVisibility,
      series: formValue.series.map((s: any) => ({
        name: s.name,
        data: s.data || [],
        color: s.color || undefined,
        type: s.seriesType || undefined,
        lineStyle: s.lineStyle || undefined,
        showValueLabels:
          s.valueLabelsMode === 'inherit' ? undefined : s.valueLabelsMode === 'show' ? true : false,
        valueLabelPosition: (s.valueLabelPositionOverride || '').toString().trim() || undefined,
        numberFormat:
          s.numberFormatMode === 'custom'
            ? {
                scale: s.numberScale,
                decimals: clampInt(s.numberDecimals, 0, 8),
                useGrouping: s.numberUseGrouping !== false,
                locale: (s.numberLocale || '').toString().trim() || undefined,
              }
            : undefined,
      })),
      title: formValue.title || undefined,
      xAxisLabel: formValue.xAxisLabel || undefined,
      yAxisLabel: formValue.yAxisLabel || undefined,
      showLegend: formValue.showLegend,
      legendPosition: formValue.legendPosition,
      showAxisLines: formValue.showAxisLines || false,
      showValueLabels: formValue.showValueLabels || false,
      valueLabelPosition: formValue.valueLabelPosition || undefined,

      numberFormat: this.buildChartNumberFormatFromForm(formValue),
      labelWrap: {
        enabled: formValue.wrapEnabled !== false,
        maxLines: clampInt(formValue.wrapMaxLines, 1, 6),
        mode: formValue.wrapMode === 'char' ? 'char' : 'word',
      },
      typography: {
        responsive: formValue.typographyResponsive !== false,
        scaleFactor: clampNum(formValue.typographyScaleFactor, 0.2, 3),
      },
      textStyles: buildTextStylesFromForm(formValue),
    };

    const dataSource = this.buildDataSourceForSave();
    this.closed.emit({ chartData, cancelled: false, dataSource });
  }

  private buildDataSourceForSave(): ChartHttpDataSourceConfig | null {
    if (this.importSourceMode !== 'url') {
      return null;
    }
    const url = (this.urlRequest?.url ?? '').trim();
    if (!url) return null;

    const chartType: ChartType = (this.form.value.chartType as ChartType) || 'column';
    const seriesColumnIndexes = Array.from(this.selectedSeriesColumns.values()).sort((a, b) => a - b);

    return {
      kind: 'http',
      request: this.urlRequest,
      format: this.urlFormatOverride ?? undefined,
      sheetIndex: this.importForm.value.sheetIndex ?? undefined,
      delimiter: this.importForm.value.delimiter ?? undefined,

      chartType,
      hasHeader: !!this.importForm.value.hasHeader,
      headerRowIndex: this.importForm.value.headerRowIndex ?? 0,
      categoryColumnIndex: this.importForm.value.categoryColumnIndex ?? 0,
      seriesColumnIndexes,
      aggregation: (this.importForm.value.aggregation as ChartImportAggregation) ?? 'SUM',
    };
  }

  cancel(): void {
    this.closed.emit({
      chartData: this.data?.chartData || createEmptyChartData(),
      cancelled: true,
    });
  }
}

function clampInt(value: any, min: number, max: number): number {
  const n = Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : min;
  return Math.max(min, Math.min(max, n));
}

function clampNum(value: any, min: number, max: number): number {
  const n = Number.isFinite(Number(value)) ? Number(value) : min;
  return Math.max(min, Math.min(max, n));
}

function buildTextStylesFromForm(formValue: any): ChartData['textStyles'] | undefined {
  const title = normalizeTextStyle(formValue?.titleTextColor, formValue?.titleTextBold);
  const legend = normalizeTextStyle(formValue?.legendTextColor, formValue?.legendTextBold);
  const axis = normalizeTextStyle(formValue?.axisTextColor, formValue?.axisTextBold);
  const valueLabel = normalizeTextStyle(formValue?.valueLabelTextColor, formValue?.valueLabelTextBold);

  const out: any = {};
  if (title) out.title = title;
  if (legend) out.legend = legend;
  if (axis) out.axis = axis;
  if (valueLabel) out.valueLabel = valueLabel;

  return Object.keys(out).length ? out : undefined;
}

function normalizeTextStyle(colorRaw: any, boldRaw: any): { color?: string; bold?: boolean } | null {
  const color = (colorRaw ?? '').toString().trim();
  const bold = !!boldRaw;
  if (!color && !bold) return null;
  return {
    color: color || undefined,
    bold: bold || undefined,
  };
}


