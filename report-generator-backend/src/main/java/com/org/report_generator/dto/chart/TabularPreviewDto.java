package com.org.report_generator.dto.chart;

import java.util.List;

/**
 * Small preview of the imported tabular data for UI display.
 */
public record TabularPreviewDto(
        int totalRows,
        int totalCols,
        List<List<String>> rows
) {
}


