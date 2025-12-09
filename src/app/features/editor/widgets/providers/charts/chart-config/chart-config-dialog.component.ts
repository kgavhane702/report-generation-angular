import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  inject,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';

import { ChartData, ChartSeries, ChartType, createDefaultChartData, parseCsvToChartData } from '../../../../../../models/chart-data.model';

export interface ChartConfigDialogData {
  chartData: ChartData;
  widgetId?: string;
}

export interface ChartConfigDialogResult {
  chartData: ChartData;
  cancelled: boolean;
}

@Component({
  selector: 'app-chart-config-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './chart-config-dialog.component.html',
  styleUrls: ['./chart-config-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChartConfigDialogComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly destroy$ = new Subject<void>();

  @Input() data?: ChartConfigDialogData;
  @Output() closed = new EventEmitter<ChartConfigDialogResult>();


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
  };

  readonly legendPositions: Array<'top' | 'bottom' | 'left' | 'right'> = [
    'top',
    'bottom',
    'left',
    'right',
  ];

  form!: FormGroup;
  csvFormControl = this.fb.control('');
  showCsvImport = false;

  ngOnInit(): void {
    const chartData = this.data?.chartData || createDefaultChartData();
    this.initializeForm(chartData);
    
    // Watch for chart type changes to update series types for stackedBarLine
    this.form.get('chartType')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((chartType: ChartType) => {
        if (chartType === 'stackedBarLine' && this.seriesFormArray.length > 1) {
          // Update series types: first = bar, others = line
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

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeForm(chartData: ChartData): void {
    this.form = this.fb.group({
      chartType: [chartData.chartType, Validators.required],
      title: [chartData.title || ''],
      xAxisLabel: [chartData.xAxisLabel || ''],
      yAxisLabel: [chartData.yAxisLabel || ''],
      showLegend: [chartData.showLegend !== false],
      legendPosition: [chartData.legendPosition || 'top'],
      labels: this.fb.array(
        (chartData.labels || []).map((label: string) => this.fb.control(label))
      ),
      series: this.fb.array(
        chartData.series.map((series: ChartSeries, index: number) => 
          this.createSeriesFormGroup(series, index, chartData.chartType)
        )
      ),
    });

    // Initialize CSV with current data
    this.csvFormControl.setValue(this.exportToCsv());
  }

  private createSeriesFormGroup(series: ChartSeries = { name: '', data: [] }, index: number = 0, chartType: ChartType = 'column'): FormGroup {
    const dataArray = this.fb.array(
      (series.data || []).map((value: number) => this.fb.control(value))
    );
    
    // For stackedBarLine charts, determine default series type
    // First series defaults to 'bar', others to 'line'
    const defaultSeriesType = chartType === 'stackedBarLine' 
      ? (index === 0 ? 'bar' : 'line')
      : undefined;
    
    // Use series.type if available, otherwise use default
    const seriesType = series.type || defaultSeriesType;
    
    return this.fb.group({
      name: [series.name || '', Validators.required],
      color: [series.color || ''],
      data: dataArray,
      seriesType: [seriesType], // 'bar' or 'line' for combo charts
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
    return this.currentChartType === 'stackedBarLine';
  }

  get hasMultipleSeries(): boolean {
    return this.seriesFormArray.length > 1;
  }

  get shouldShowSeriesTypeSelector(): boolean {
    return this.isStackedBarLineChart && this.hasMultipleSeries;
  }

  addLabel(): void {
    this.labelsFormArray.push(this.fb.control(''));
  }

  removeLabel(index: number): void {
    this.labelsFormArray.removeAt(index);
    // Remove corresponding data points from all series
    this.seriesFormArray.controls.forEach(seriesGroup => {
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
    // Add corresponding label if needed
    if (this.labelsFormArray.length < dataArray.length) {
      this.labelsFormArray.push(this.fb.control(`Item ${dataArray.length}`));
    }
  }

  removeDataPoint(seriesIndex: number, dataIndex: number): void {
    const dataArray = this.getSeriesDataArray(seriesIndex);
    dataArray.removeAt(dataIndex);
    
    // Remove corresponding label if no series has data at this index
    if (this.allSeriesEmptyAt(dataIndex)) {
      this.labelsFormArray.removeAt(dataIndex);
    }
    
    // Remove data point from all series to keep alignment
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
    return this.seriesFormArray.controls.every(seriesGroup => {
      const dataArray = seriesGroup.get('data') as FormArray;
      return dataArray.length <= index;
    });
  }

  syncDataPoints(): void {
    // Sync all series to have the same number of data points as labels
    const labelCount = this.labelsFormArray.length;
    this.seriesFormArray.controls.forEach(seriesGroup => {
      const dataArray = seriesGroup.get('data') as FormArray;
      while (dataArray.length < labelCount) {
        dataArray.push(this.fb.control(0));
      }
      while (dataArray.length > labelCount) {
        dataArray.removeAt(dataArray.length - 1);
      }
    });
  }

  importFromCsv(): void {
    try {
      const csvValue = this.csvFormControl.value || '';
      const chartData = parseCsvToChartData(csvValue, this.form.value.chartType);
      this.initializeForm(chartData);
      this.showCsvImport = false;
    } catch (error) {
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
        type: s.seriesType || undefined, // Include series type for combo charts
      })),
      title: formValue.title,
      xAxisLabel: formValue.xAxisLabel,
      yAxisLabel: formValue.yAxisLabel,
      showLegend: formValue.showLegend,
      legendPosition: formValue.legendPosition,
    };
    
    const headers = ['Category', ...chartData.series.map((s: ChartSeries) => s.name)];
    const rows: string[] = [headers.join(',')];
    
    const maxLength = Math.max(
      chartData.labels?.length || 0,
      ...chartData.series.map((s: ChartSeries) => s.data.length)
    );
    
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
        type: s.seriesType || undefined, // Include series type for combo charts
      })),
      title: formValue.title || undefined,
      xAxisLabel: formValue.xAxisLabel || undefined,
      yAxisLabel: formValue.yAxisLabel || undefined,
      showLegend: formValue.showLegend,
      legendPosition: formValue.legendPosition,
    };

    this.closed.emit({
      chartData,
      cancelled: false,
    });
  }

  cancel(): void {
    this.closed.emit({
      chartData: this.data?.chartData || createDefaultChartData(),
      cancelled: true,
    });
  }

  closeDialog(event?: MouseEvent): void {
    // Only close if clicking directly on overlay, not if event came from content
    if (event) {
      const target = event.target as HTMLElement;
      // Check if the click was on the overlay itself (not on content or its children)
      if (target.classList.contains('chart-config-dialog__overlay')) {
        this.cancel();
      }
    } else {
      this.cancel();
    }
  }
}

