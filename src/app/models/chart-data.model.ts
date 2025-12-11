/**
 * Provider-agnostic chart data model.
 * This structure can be converted to any chart library format (Chart.js, ECharts, D3, etc.)
 */
export interface ChartData {
  /**
   * Chart type identifier (bar, line, pie, area, scatter, etc.)
   */
  chartType: ChartType;
  
  /**
   * Labels for categories/axis (typically X-axis for bar/line charts)
   */
  labels?: string[];
  
  /**
   * Series data (datasets)
   */
  series: ChartSeries[];
  
  /**
   * Chart title
   */
  title?: string;
  
  /**
   * X-axis label
   */
  xAxisLabel?: string;
  
  /**
   * Y-axis label
   */
  yAxisLabel?: string;
  
  /**
   * Whether to show legend
   */
  showLegend?: boolean;
  
  /**
   * Legend position
   */
  legendPosition?: 'top' | 'bottom' | 'left' | 'right';
  
  /**
   * Chart colors palette (optional, adapter can use defaults)
   */
  colors?: string[];

  /**
   * Whether to show axis/grid lines
   */
  showAxisLines?: boolean;

  /**
   * Whether to show value labels on chart elements
   */
  showValueLabels?: boolean;

  /**
   * Position of value labels (inside, top, bottom, left, right)
   */
  valueLabelPosition?: 'inside' | 'top' | 'bottom' | 'left' | 'right';
}

export type ChartType =
  | 'bar'
  | 'column'
  | 'line'
  | 'area'
  | 'pie'
  | 'donut'
  | 'scatter'
  | 'stackedBar'
  | 'stackedColumn'
  | 'stackedBarLine';

export interface ChartSeries {
  /**
   * Series name/label
   */
  name: string;
  
  /**
   * Data values (y-axis values for most chart types)
   */
  data: number[];
  
  /**
   * Optional color for this series
   */
  color?: string;
  
  /**
   * Chart type override for this series (for combo charts)
   */
  type?: ChartType;
}

/**
 * Helper to create default chart data structure
 */
export function createDefaultChartData(chartType: ChartType = 'column'): ChartData {
  return {
    chartType,
    labels: ['Q1', 'Q2', 'Q3', 'Q4'],
    series: [
      {
        name: 'Series 1',
        data: [10, 15, 12, 18],
      },
    ],
    title: 'Chart Title',
    showLegend: true,
    legendPosition: 'bottom',
    showAxisLines: false,
  };
}

/**
 * Parse CSV string to ChartData
 */
export function parseCsvToChartData(csv: string, chartType: ChartType = 'column'): ChartData {
  const lines = csv.trim().split('\n').filter(line => line.trim());
  if (lines.length === 0) {
    return createDefaultChartData(chartType);
  }

  // First line is headers
  const headers = lines[0].split(',').map(h => h.trim());
  const labels: string[] = [];
  const seriesMap = new Map<string, number[]>();

  // Initialize series
  for (let i = 1; i < headers.length; i++) {
    seriesMap.set(headers[i], []);
  }

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    if (values[0]) {
      labels.push(values[0]);
      
      for (let j = 1; j < values.length && j < headers.length; j++) {
        const seriesName = headers[j];
        const numValue = parseFloat(values[j]) || 0;
        const seriesData = seriesMap.get(seriesName) || [];
        seriesData.push(numValue);
      }
    }
  }

  const series: ChartSeries[] = Array.from(seriesMap.entries()).map(([name, data]) => ({
    name,
    data,
  }));

  return {
    chartType,
    labels,
    series,
    title: 'Imported Chart',
    showLegend: true,
    legendPosition: 'bottom',
    showAxisLines: false,
  };
}

/**
 * Convert ChartData to CSV string
 */
export function chartDataToCsv(data: ChartData): string {
  const headers = ['Category', ...data.series.map(s => s.name)];
  const rows: string[] = [headers.join(',')];

  const maxLength = Math.max(
    data.labels?.length || 0,
    ...data.series.map(s => s.data.length)
  );

  for (let i = 0; i < maxLength; i++) {
    const label = data.labels?.[i] || `Row ${i + 1}`;
    const values = data.series.map(s => s.data[i] || 0);
    rows.push([label, ...values].join(','));
  }

  return rows.join('\n');
}

