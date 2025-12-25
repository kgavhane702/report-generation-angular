package com.org.report_generator.importing.service;

import com.org.report_generator.dto.chart.ChartImportResponse;
import com.org.report_generator.importing.model.ChartImportOptions;
import com.org.report_generator.importing.model.TabularDataset;

/**
 * Converts a parsed {@link TabularDataset} into chart-ready data, with mapping + warnings.
 */
public interface ChartImportService {
    ChartImportResponse importChart(TabularDataset dataset, ChartImportOptions options);
}


