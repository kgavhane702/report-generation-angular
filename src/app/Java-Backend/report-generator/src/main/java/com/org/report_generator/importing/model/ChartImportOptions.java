package com.org.report_generator.importing.model;

import com.org.report_generator.dto.chart.ChartImportAggregation;

import java.util.List;

/**
 * Options for converting a {@link TabularDataset} into chart data.
 *
 * Note: This is separate from {@link ImportOptions} (which controls parsing the file).
 */
public record ChartImportOptions(
        String chartType,
        boolean hasHeader,
        int headerRowIndex,
        int categoryColumnIndex,
        List<Integer> seriesColumnIndexes,
        ChartImportAggregation aggregation
) {
}


