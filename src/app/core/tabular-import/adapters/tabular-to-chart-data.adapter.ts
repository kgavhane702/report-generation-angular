import { ChartData } from '../../../models/chart-data.model';
import { TabularDatasetDto } from '../models/tabular-dataset.model';

/**
 * Placeholder for future reuse:
 * Adapter: TabularDataset -> ChartData.
 *
 * Not implemented in this phase (Excel-only table import), but the interface is here
 * so charts can adopt the same tabular import pipeline later.
 */
export interface TabularToChartDataAdapter {
  toChartData(dataset: TabularDatasetDto): ChartData;
}


