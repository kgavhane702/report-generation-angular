package com.org.report_generator.dto.chart;

import com.org.report_generator.importing.model.ImportWarning;

import java.util.List;

/**
 * Response DTO for chart import endpoint.
 */
public record ChartImportResponse(
        ChartDataDto chartData,
        ChartImportMappingDto mapping,
        TabularPreviewDto preview,
        List<ImportWarning> warnings
) {
}


