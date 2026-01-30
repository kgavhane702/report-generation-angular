package com.org.report_generator.dto.chart;

import com.org.report_generator.importing.model.ImportWarning;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ChartImportResponseTest {

    @Test
    void shouldCreateResponseWithAllFields() {
        ChartDataDto chartData = new ChartDataDto("bar", List.of("A", "B"), List.of(true, true), List.of());
        ChartImportMappingDto mapping = new ChartImportMappingDto(true, 0, 0, List.of(1, 2), ChartImportAggregation.SUM);
        TabularPreviewDto preview = new TabularPreviewDto(10, 5, List.of(List.of("a", "b")));
        ImportWarning warning = new ImportWarning("WARN", "Warning message");
        
        ChartImportResponse response = new ChartImportResponse(chartData, mapping, preview, List.of(warning));
        
        assertThat(response.chartData()).isEqualTo(chartData);
        assertThat(response.mapping()).isEqualTo(mapping);
        assertThat(response.preview()).isEqualTo(preview);
        assertThat(response.warnings()).hasSize(1);
    }

    @Test
    void shouldCreateResponseWithNullFields() {
        ChartImportResponse response = new ChartImportResponse(null, null, null, null);
        
        assertThat(response.chartData()).isNull();
        assertThat(response.mapping()).isNull();
        assertThat(response.preview()).isNull();
        assertThat(response.warnings()).isNull();
    }

    @Test
    void shouldCreateResponseWithEmptyWarnings() {
        ChartDataDto chartData = new ChartDataDto("line", List.of(), List.of(), List.of());
        
        ChartImportResponse response = new ChartImportResponse(chartData, null, null, List.of());
        
        assertThat(response.chartData()).isNotNull();
        assertThat(response.warnings()).isEmpty();
    }

    @Test
    void shouldSupportEquality() {
        ChartDataDto chartData = new ChartDataDto("pie", List.of("X"), List.of(true), List.of());
        ChartImportResponse r1 = new ChartImportResponse(chartData, null, null, List.of());
        ChartImportResponse r2 = new ChartImportResponse(chartData, null, null, List.of());
        
        assertThat(r1).isEqualTo(r2);
    }

    @Test
    void shouldSupportHashCode() {
        ChartDataDto chartData = new ChartDataDto("pie", List.of("X"), List.of(true), List.of());
        ChartImportResponse r1 = new ChartImportResponse(chartData, null, null, List.of());
        ChartImportResponse r2 = new ChartImportResponse(chartData, null, null, List.of());
        
        assertThat(r1.hashCode()).isEqualTo(r2.hashCode());
    }
}
