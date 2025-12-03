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

import { ChartData, ChartSeries, ChartType, createDefaultChartData, parseCsvToChartData } from '../../../../models/chart-data.model';

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
        (chartData.labels || []).map(label => this.fb.control(label))
      ),
      series: this.fb.array(
        chartData.series.map(series => this.createSeriesFormGroup(series))
      ),
    });

    // Initialize CSV with current data
    this.csvFormControl.setValue(this.exportToCsv());
  }

  private createSeriesFormGroup(series: ChartSeries = { name: '', data: [] }): FormGroup {
    const dataArray = this.fb.array(
      (series.data || []).map(value => this.fb.control(value))
    );
    
    return this.fb.group({
      name: [series.name || '', Validators.required],
      color: [series.color || ''],
      data: dataArray,
    });
  }

  get labelsFormArray(): FormArray {
    return this.form.get('labels') as FormArray;
  }

  get seriesFormArray(): FormArray {
    return this.form.get('series') as FormArray;
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
    this.seriesFormArray.push(this.createSeriesFormGroup({ name: 'New Series', data: emptyData }));
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
      console.error('CSV import error:', error);
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
      })),
      title: formValue.title,
      xAxisLabel: formValue.xAxisLabel,
      yAxisLabel: formValue.yAxisLabel,
      showLegend: formValue.showLegend,
      legendPosition: formValue.legendPosition,
    };
    
    const headers = ['Category', ...chartData.series.map(s => s.name)];
    const rows: string[] = [headers.join(',')];
    
    const maxLength = Math.max(
      chartData.labels?.length || 0,
      ...chartData.series.map(s => s.data.length)
    );
    
    for (let i = 0; i < maxLength; i++) {
      const label = chartData.labels?.[i] || `Row ${i + 1}`;
      const values = chartData.series.map(s => s.data[i] || 0);
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

