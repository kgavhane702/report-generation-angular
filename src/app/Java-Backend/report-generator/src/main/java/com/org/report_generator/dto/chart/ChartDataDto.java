package com.org.report_generator.dto.chart;

import java.util.List;

/**
 * Provider-agnostic chart data DTO (mirrors frontend ChartData, but data-only for import).
 *
 * Import scope: this DTO intentionally focuses on the dataset (labels + series) and chartType.
 * Presentation config (title/axes/legend toggles/colors) is kept on the frontend.
 */
public record ChartDataDto(
        String chartType,
        List<String> labels,
        List<Boolean> labelVisibility,
        List<ChartSeriesDto> series
) {
}


