import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Subject, Subscription, takeUntil } from 'rxjs';
import { DragDropModule, CdkDragEnd } from '@angular/cdk/drag-drop';

import { ChartData, ChartSeries, ChartType, createDefaultChartData, parseCsvToChartData } from '../../../../../../models/chart-data.model';
import { ChartRegistryService } from '../registry/chart-registry.service';

export interface ChartConfigDialogData {
  chartData: ChartData;
  widgetId?: string;
  provider?: string;
}

export interface ChartConfigDialogResult {
  chartData: ChartData;
  provider?: string;
  cancelled: boolean;
}

@Component({
  selector: 'app-chart-config-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DragDropModule],
  templateUrl: './chart-config-dialog.component.html',
  styleUrls: ['./chart-config-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChartConfigDialogComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly registry = inject(ChartRegistryService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();
  private chartTypeSubscription?: Subscription;

  @Input() data?: ChartConfigDialogData;
  @Output() closed = new EventEmitter<ChartConfigDialogResult>();
  @ViewChild('dialogContent', { static: false }) dialogContent?: ElementRef<HTMLElement>;

  availableProviders: Array<{ id: string; label: string }> = [];
  
  // Initial drag position for CDK Drag
  dragPosition = { x: 0, y: 0 };
  private positionInitialized = false;


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
    'solid': 'Solid',
    'dashed': 'Dashed',
    'dotted': 'Dotted',
    'dashDot': 'Dash Dot',
    'longDash': 'Long Dash',
    'longDashDot': 'Long Dash Dot',
    'longDashDotDot': 'Long Dash Dot Dot',
  };

  form!: FormGroup;
  csvFormControl = this.fb.control('');
  showCsvImport = false;

  ngOnInit(): void {
    // Get available providers (excluding placeholder)
    const allAdapters = this.registry.listAdapters();
    this.availableProviders = allAdapters
      .filter(adapter => adapter.id !== 'placeholder')
      .map(adapter => ({ id: adapter.id, label: adapter.label }));

    // Initialize form if data is available
    if (this.data) {
      this.initializeFormFromData();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Reinitialize form when data input changes to use latest widget data
    if (changes['data'] && this.data) {
      // Always reinitialize form when data changes to ensure we have the latest widget data
      // This ensures series types, colors, and all data are up-to-date
      if (!changes['data'].firstChange) {
        // Data changed after initial load - reinitialize with new data
        this.initializeFormFromData();
        this.cdr.markForCheck();
      } else if (this.availableProviders.length > 0 || this.form) {
        // First change but providers/form already initialized - reinitialize with latest data
        this.initializeFormFromData();
      }
    }
  }

  private initializeFormFromData(): void {
    // Ensure providers are loaded
    if (this.availableProviders.length === 0) {
      const allAdapters = this.registry.listAdapters();
      this.availableProviders = allAdapters
        .filter(adapter => adapter.id !== 'placeholder')
        .map(adapter => ({ id: adapter.id, label: adapter.label }));
    }

    const chartData = this.data?.chartData || createDefaultChartData();
    
    // Auto-select provider: use current provider if available, otherwise use first available
    const currentProvider = this.data?.provider;
    const selectedProvider = currentProvider && this.availableProviders.find(p => p.id === currentProvider)
      ? currentProvider
      : (this.availableProviders.length > 0 ? this.availableProviders[0].id : 'echarts');

    this.initializeForm(chartData, selectedProvider);
    
    // Unsubscribe from previous subscription if reinitializing
    if (this.chartTypeSubscription) {
      this.chartTypeSubscription.unsubscribe();
    }
    
    // Set up subscription to chart type changes for stackedBarLine
    this.chartTypeSubscription = this.form.get('chartType')?.valueChanges
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

  ngAfterViewInit(): void {
    // Calculate and set initial centered position for CDK Drag
    // Use double requestAnimationFrame to ensure the view is fully rendered and dimensions are accurate
    if (!this.positionInitialized) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (this.dialogContent) {
            const element = this.dialogContent.nativeElement;
            // Get actual dimensions or use defaults
            const dialogWidth = element.offsetWidth || 850;
            const dialogHeight = element.offsetHeight || 400;
            
            // Calculate center position relative to viewport
            const centerX = Math.max(0, (window.innerWidth - dialogWidth) / 2);
            const centerY = Math.max(0, (window.innerHeight - dialogHeight) / 2);
            
            // Set initial drag position for CDK Drag
            this.dragPosition = { x: centerX, y: centerY };
            this.positionInitialized = true;
            this.cdr.markForCheck();
          }
        });
      });
    }
  }

  onDragEnded(event: CdkDragEnd): void {
    // Update drag position when dragging ends to maintain the new position
    // Use getFreeDragPosition() to get the current drag position
    if (event.source) {
      const position = event.source.getFreeDragPosition();
      if (position) {
        this.dragPosition = { x: position.x, y: position.y };
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

  private initializeForm(chartData: ChartData, provider: string): void {
    this.form = this.fb.group({
      provider: [provider, Validators.required],
      chartType: [chartData.chartType, Validators.required],
      title: [chartData.title || ''],
      xAxisLabel: [chartData.xAxisLabel || ''],
      yAxisLabel: [chartData.yAxisLabel || ''],
      showLegend: [chartData.showLegend !== false],
      legendPosition: [chartData.legendPosition || 'bottom'],
      showAxisLines: [chartData.showAxisLines === true],
      showValueLabels: [chartData.showValueLabels !== false],
      valueLabelPosition: [chartData.valueLabelPosition || 'inside'],
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
      lineStyle: [series.lineStyle || 'solid'], // Line style for line/area charts
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

  shouldShowLineStyle(seriesIndex: number): boolean {
    const chartType = this.currentChartType;
    // Show for line and area charts
    if (chartType === 'line' || chartType === 'area') {
      return true;
    }
    // Show for line series in stacked bar/line charts
    if (chartType === 'stackedBarLine') {
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
      const currentProvider = this.form.value.provider || this.data?.provider || 'echarts';
      this.initializeForm(chartData, currentProvider);
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
        lineStyle: s.lineStyle || undefined, // Include line style for line/area charts
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
        lineStyle: s.lineStyle || undefined, // Include line style for line/area charts
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

    this.closed.emit({
      chartData,
      provider: formValue.provider,
      cancelled: false,
    });
  }

  cancel(): void {
    // Get current provider from form or fallback to data provider
    const currentProvider = this.form?.value?.provider || this.data?.provider;
    this.closed.emit({
      chartData: this.data?.chartData || createDefaultChartData(),
      provider: currentProvider,
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

