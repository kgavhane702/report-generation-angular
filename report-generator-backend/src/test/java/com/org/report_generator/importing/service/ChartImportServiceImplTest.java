package com.org.report_generator.importing.service;

import com.org.report_generator.dto.chart.ChartImportAggregation;
import com.org.report_generator.exception.ChartImportValidationException;
import com.org.report_generator.importing.model.ChartImportOptions;
import com.org.report_generator.importing.model.ImportWarning;
import com.org.report_generator.importing.model.TabularCell;
import com.org.report_generator.importing.model.TabularDataset;
import com.org.report_generator.importing.model.TabularRow;
import com.org.report_generator.importing.service.impl.ChartImportServiceImpl;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ChartImportServiceImplTest {

    @Test
    void importChart_buildsSeriesFromHeader() {
        ChartImportServiceImpl svc = new ChartImportServiceImpl();

        TabularDataset dataset = new TabularDataset(
                List.of(
                        row("Category", "Sales"),
                        row("Jan", "10"),
                        row("Feb", "15")
                ),
                List.of(0.5, 0.5),
                List.of(0.33, 0.33, 0.33)
        );

        ChartImportOptions options = new ChartImportOptions(
                "bar",
                true,
                0,
                0,
                List.of(1),
                ChartImportAggregation.SUM
        );

        var resp = svc.importChart(dataset, options);

        assertThat(resp.chartData().chartType()).isEqualTo("bar");
        assertThat(resp.chartData().labels()).containsExactly("Jan", "Feb");
        assertThat(resp.chartData().series()).hasSize(1);
        assertThat(resp.chartData().series().get(0).name()).isEqualTo("Sales");
        assertThat(resp.chartData().series().get(0).data()).containsExactly(10d, 15d);
    }

    @Test
    void importChart_nonNumericValues_createWarning() {
        ChartImportServiceImpl svc = new ChartImportServiceImpl();

        TabularDataset dataset = new TabularDataset(
                List.of(
                        row("Category", "Sales"),
                        row("Jan", "N/A"),
                        row("Feb", "20")
                ),
                List.of(0.5, 0.5),
                List.of(0.33, 0.33, 0.33)
        );

        ChartImportOptions options = new ChartImportOptions(
                "column",
                true,
                0,
                0,
                List.of(1),
                ChartImportAggregation.SUM
        );

        var resp = svc.importChart(dataset, options);

        assertThat(resp.chartData().series().get(0).data()).containsExactly(0d, 20d);
        assertThat(resp.warnings().stream().map(ImportWarning::code))
                .contains("NON_NUMERIC_VALUES");
    }

    @Test
    void importChart_duplicateCategories_areAggregated() {
        ChartImportServiceImpl svc = new ChartImportServiceImpl();

        TabularDataset dataset = new TabularDataset(
                List.of(
                        row("Category", "Sales"),
                        row("Jan", "10"),
                        row("Jan", "5")
                ),
                List.of(0.5, 0.5),
                List.of(0.33, 0.33, 0.33)
        );

        ChartImportOptions options = new ChartImportOptions(
                "line",
                true,
                0,
                0,
                List.of(1),
                ChartImportAggregation.SUM
        );

        var resp = svc.importChart(dataset, options);

        assertThat(resp.chartData().labels()).containsExactly("Jan");
        assertThat(resp.chartData().series().get(0).data()).containsExactly(15d);
        assertThat(resp.warnings().stream().map(ImportWarning::code))
                .contains("DUPLICATE_CATEGORIES");
    }

    @Test
    void pieChart_requiresSingleSeries() {
        ChartImportServiceImpl svc = new ChartImportServiceImpl();

        TabularDataset dataset = new TabularDataset(
                List.of(
                        row("Category", "S1", "S2"),
                        row("Jan", "10", "5")
                ),
                List.of(0.33, 0.33, 0.33),
                List.of(0.5, 0.5)
        );

        ChartImportOptions options = new ChartImportOptions(
                "pie",
                true,
                0,
                0,
                List.of(1, 2),
                ChartImportAggregation.SUM
        );

        assertThrows(ChartImportValidationException.class, () -> svc.importChart(dataset, options));
    }

    private static TabularRow row(String... values) {
        List<TabularCell> cells = java.util.Arrays.stream(values)
                .map(v -> new TabularCell("id", v, null, null))
                .toList();
        return new TabularRow("r", cells);
    }
}
