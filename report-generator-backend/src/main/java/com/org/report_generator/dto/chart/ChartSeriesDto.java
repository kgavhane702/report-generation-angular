package com.org.report_generator.dto.chart;

import java.util.List;

/**
 * Provider-agnostic chart series DTO (mirrors frontend ChartSeries).
 *
 * Note: color/type/lineStyle are optional; chart rendering adapters can apply defaults.
 */
public record ChartSeriesDto(
        String name,
        List<Double> data,
        String color,
        String type,
        String lineStyle
) {
}


