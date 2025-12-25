package com.org.report_generator.dto.http;

import com.org.report_generator.dto.chart.ChartImportAggregation;
import com.org.report_generator.importing.enums.ImportFormat;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.List;

/**
 * Request to import a Chart widget from an HTTP resource.
 *
 * Backend fetches the URL, detects the format (unless overridden), parses via tabular pipeline,
 * then runs chart mapping.
 */
public record ChartImportFromUrlRequest(
        @NotNull @Valid HttpRequestSpecDto request,
        ImportFormat format,
        Integer sheetIndex,
        String delimiter,

        @NotBlank String chartType,

        Boolean hasHeader,
        Integer headerRowIndex,
        Integer categoryColumnIndex,
        List<Integer> seriesColumnIndexes,
        ChartImportAggregation aggregation
) {
}



