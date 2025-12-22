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
  imports: [CommonModule, ReactiveFormsModule],
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
    const chartData = this.data?.chartData || createDefaultChartData();
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
    this.form = this.fb.group({
      chartType: [chartData.chartType, Validators.required],
      title: [chartData.title || ''],
      xAxisLabel: [chartData.xAxisLabel || ''],
      yAxisLabel: [chartData.yAxisLabel || ''],
      showLegend: [chartData.showLegend !== false],
      legendPosition: [chartData.legendPosition || 'bottom'],
      showAxisLines: [chartData.showAxisLines === true],
      showValueLabels: [chartData.showValueLabels !== false],
      valueLabelPosition: [chartData.valueLabelPosition || 'inside'],
      labels: this.fb.array((chartData.labels || []).map((label: string) => this.fb.control(label))),
      series: this.fb.array(
        chartData.series.map((series: ChartSeries, index: number) => this.createSeriesFormGroup(series, index, chartData.chartType))
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

  get seriesFormArray(): FormArray {
    return this.form.get('series') as FormArray;
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
  }

  removeLabel(index: number): void {
    this.labelsFormArray.removeAt(index);
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
      this.labelsFormArray.push(this.fb.control(`Item ${dataArray.length}`));
    }
  }

  removeDataPoint(seriesIndex: number, dataIndex: number): void {
    const dataArray = this.getSeriesDataArray(seriesIndex);
    dataArray.removeAt(dataIndex);

    if (this.allSeriesEmptyAt(dataIndex)) {
      this.labelsFormArray.removeAt(dataIndex);
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
    const chartData: ChartData = {
      chartType: formValue.chartType,
      labels: formValue.labels.filter((l: string) => l?.trim()),
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


