package com.org.report_generator.dto.chart;

import java.util.List;

/**
 * Captures the mapping used to convert a tabular dataset into chart data.
 */
public record ChartImportMappingDto(
        boolean hasHeader,
        int headerRowIndex,
        int categoryColumnIndex,
        List<Integer> seriesColumnIndexes,
        ChartImportAggregation aggregation
) {
}


