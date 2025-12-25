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
import { Subject, Subscription, takeUntil } from 'rxjs';
import * as XLSX from 'xlsx';
import { AppTabsComponent } from '../../../../../../shared/components/tabs/app-tabs/app-tabs.component';
import { AppTabComponent } from '../../../../../../shared/components/tabs/app-tab/app-tab.component';

import {
  ChartData,
  ChartSeries,
  ChartType,
  createDefaultChartData,
  parseCsvToChartData,
} from '../../../../../../models/chart-data.model';

export interface ChartConfigFormData {
  chartData: ChartData;
  widgetId?: string;
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
  private readonly destroy$ = new Subject<void>();
  private chartTypeSubscription?: Subscription;

  @Input() data?: ChartConfigFormData;
  @Output() closed = new EventEmitter<ChartConfigFormResult>();

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
  csvFormControl = this.fb.control('');
  showCsvImport = false;
  selectedFileName: string | null = null;

  ngOnInit(): void {
    if (this.data) {
      this.initializeFormFromData();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] && this.data) {
      if (!changes['data'].firstChange) {
        this.initializeFormFromData();
        this.cdr.markForCheck();
      }
    }
  }

  ngOnDestroy(): void {
    if (this.chartTypeSubscription) {
      this.chartTypeSubscription.unsubscribe();
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeFormFromData(): void {
    const chartData = this.normalizeChartDataForForm(this.data?.chartData || createDefaultChartData());
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

    this.csvFormControl.setValue(this.exportToCsv());
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
    return this.isStackedBarLineChart && this.hasMultipleSeries;
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

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.selectedFileName = file.name;
    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    if (fileExtension === 'csv') {
      this.readCsvFile(file);
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      this.readExcelFile(file);
    } else {
      alert('Unsupported file format. Please select a CSV, XLSX, or XLS file.');
      this.selectedFileName = null;
    }
  }

  private readCsvFile(file: File): void {
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      try {
        const text = e.target?.result as string;
        this.csvFormControl.setValue(text);
        this.importFromCsv();
      } catch {
        alert('Failed to read CSV file. Please check the file format.');
        this.selectedFileName = null;
      }
    };
    reader.onerror = () => {
      alert('Error reading CSV file.');
      this.selectedFileName = null;
    };
    reader.readAsText(file);
  }

  private readExcelFile(file: File): void {
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const csv = XLSX.utils.sheet_to_csv(worksheet);
        this.csvFormControl.setValue(csv);
        this.importFromCsv();
      } catch {
        alert('Failed to read Excel file. Please check the file format.');
        this.selectedFileName = null;
      }
    };
    reader.onerror = () => {
      alert('Error reading Excel file.');
      this.selectedFileName = null;
    };
    reader.readAsArrayBuffer(file);
  }

  importFromCsv(): void {
    try {
      const csvValue = this.csvFormControl.value || '';
      if (!csvValue.trim()) {
        alert('No data to import. Please select a file or paste CSV data.');
        return;
      }
      const chartData = parseCsvToChartData(csvValue, this.form.value.chartType);
      this.initializeForm(chartData);
      this.showCsvImport = false;
      this.selectedFileName = null;
      this.cdr.markForCheck();
    } catch {
      alert('Failed to parse CSV. Please check the format.');
    }
  }

  exportToCsv(): string {
    const formValue = this.form.value;
    const chartData: ChartData = {
      chartType: formValue.chartType,
      labels: formValue.labels || [],
      series: formValue.series.map((s: any) => ({
        name: s.name,
        data: s.data || [],
        color: s.color || undefined,
        type: s.seriesType || undefined,
        lineStyle: s.lineStyle || undefined,
      })),
      title: formValue.title,
      xAxisLabel: formValue.xAxisLabel,
      yAxisLabel: formValue.yAxisLabel,
      showLegend: formValue.showLegend,
      legendPosition: formValue.legendPosition,
      showAxisLines: formValue.showAxisLines || false,
      showValueLabels: formValue.showValueLabels || false,
      valueLabelPosition: formValue.valueLabelPosition || undefined,
    };

    const headers = ['Category', ...chartData.series.map((s: ChartSeries) => s.name)];
    const rows: string[] = [headers.join(',')];
    const maxLength = Math.max(chartData.labels?.length || 0, ...chartData.series.map((s: ChartSeries) => s.data.length));

    for (let i = 0; i < maxLength; i++) {
      const label = chartData.labels?.[i] || `Row ${i + 1}`;
      const values = chartData.series.map((s: ChartSeries) => s.data[i] || 0);
      rows.push([label, ...values].join(','));
    }

    return rows.join('\n');
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
      chartData: this.data?.chartData || createDefaultChartData(),
      cancelled: true,
    });
  }
}


