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

import {
  ChartData,
  ChartSeries,
  ChartType,
  createDefaultChartData,
  createEmptyChartData,
} from '../../../../../../models/chart-data.model';

export interface ChartConfigFormData {
  chartData: ChartData;
  widgetId?: string;
  /** When true, the dialog should open directly on the Data tab and prompt for file import. */
  openImportOnOpen?: boolean;
}

export interface ChartConfigFormResult {
  chartData: ChartData;
  cancelled: boolean;
}

@Component({
  selector: 'app-chart-config-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AppTabsComponent, AppTabComponent],
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

  ngOnInit(): void {
    if (this.data) {
      this.initializeFormFromData();
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
    this.cdr.markForCheck();
  }

  private initializeFormFromData(): void {
    const chartData = this.normalizeChartDataForForm(this.data?.chartData || createEmptyChartData());
    this.initializeForm(chartData);

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
      labels: this.fb.array((normalized.labels || []).map((label: string) => this.fb.control(label))),
      labelVisibility: this.fb.array(visibility.map((v) => this.fb.control(v))),
      series: this.fb.array(
        normalized.series.map((series: ChartSeries, index: number) => this.createSeriesFormGroup(series, index, normalized.chartType))
      ),
    });
  }

  private createSeriesFormGroup(series: ChartSeries = { name: '', data: [] }, index: number = 0, chartType: ChartType = 'column'): FormGroup {
    const dataArray = this.fb.array((series.data || []).map((value: number) => this.fb.control(value)));

    const defaultSeriesType =
      chartType === 'stackedBarLine' || chartType === 'stackedOverlappedBarLine' ? (index === 0 ? 'bar' : 'line') : undefined;
    const seriesType = series.type || defaultSeriesType;

    return this.fb.group({
      name: [series.name || '', Validators.required],
      color: [series.color || ''],
      data: dataArray,
      seriesType: [seriesType],
      lineStyle: [series.lineStyle || 'solid'],
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
    this.seriesFormArray.push(this.createSeriesFormGroup({ name: 'New Series', data: emptyData }, newIndex, chartType));
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

    // Reset last results
    this.importError = null;
    this.importResponse = null;
    this.importPreview = null;
    this.importMapping = null;
    this.importWarnings = [];
    this.selectedSeriesColumns.clear();

    // Auto-run preview import
    this.previewImport();
  }

  previewImport(): void {
    if (!this.selectedImportFile) {
      this.importError = 'No file selected.';
      this.cdr.markForCheck();
      return;
    }
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
    this.cdr.markForCheck();

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
      .subscribe({
        next: (resp) => {
          this.importInProgress = false;
          this.importPreviewSubscription = undefined;

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
          // eslint-disable-next-line no-console
          console.error('Chart import failed', err);
          const msg =
            err?.error?.error?.message ||
            err?.error?.message ||
            err?.message ||
            'Chart import failed. Please verify the backend is running and the file is valid.';
          this.importError = msg;
          this.cdr.markForCheck();
        },
      });
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
      };

      this.seriesFormArray.push(this.createSeriesFormGroup(merged, index, chartType));
    });

    this.form.patchValue(preserved, { emitEvent: false });
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
      })),
      title: formValue.title || undefined,
      xAxisLabel: formValue.xAxisLabel || undefined,
      yAxisLabel: formValue.yAxisLabel || undefined,
      showLegend: formValue.showLegend,
      legendPosition: formValue.legendPosition,
      showAxisLines: formValue.showAxisLines || false,
      showValueLabels: formValue.showValueLabels || false,
      valueLabelPosition: formValue.valueLabelPosition || undefined,
    };

    this.closed.emit({ chartData, cancelled: false });
  }

  cancel(): void {
    this.closed.emit({
      chartData: this.data?.chartData || createEmptyChartData(),
      cancelled: true,
    });
  }
}


