package com.org.report_generator.importing.service.impl;

import com.org.report_generator.dto.chart.*;
import com.org.report_generator.exception.ChartImportValidationException;
import com.org.report_generator.importing.model.*;
import com.org.report_generator.importing.service.ChartImportService;
import org.springframework.stereotype.Service;
import org.springframework.web.util.HtmlUtils;

import java.util.*;

/**
 * Default chart import conversion: TabularDataset -> ChartImportResponse.
 *
 * v1 focuses on dataset extraction (labels + series) and basic sanity checks.
 * Chart-type specific validation is added in a later step.
 */
@Service
public class ChartImportServiceImpl implements ChartImportService {

    private static final int PREVIEW_MAX_ROWS = 25;
    private static final int PREVIEW_MAX_COLS = 20;

    @Override
    public ChartImportResponse importChart(TabularDataset dataset, ChartImportOptions options) {
        if (dataset == null || dataset.rows() == null || dataset.rows().isEmpty()) {
            throw new IllegalArgumentException("No rows found in imported dataset");
        }
        if (options == null) {
            throw new IllegalArgumentException("Chart import options are required");
        }

        Grid grid = toTextGrid(dataset);
        TabularPreviewDto preview = buildPreview(grid);

        ChartImportMappingDto mapping = resolveMapping(grid, options);

        List<ImportWarning> warnings = new ArrayList<>();
        ChartDataDto chartData = buildChartData(grid, options.chartType(), mapping, warnings);

        return new ChartImportResponse(chartData, mapping, preview, warnings);
    }

    private Grid toTextGrid(TabularDataset dataset) {
        List<TabularRow> rows = dataset.rows();
        int rowCount = rows == null ? 0 : rows.size();
        int colCount = 0;
        for (TabularRow r : rows) {
            int c = r == null || r.cells() == null ? 0 : r.cells().size();
            colCount = Math.max(colCount, c);
        }
        rowCount = Math.max(rowCount, 1);
        colCount = Math.max(colCount, 1);

        String[][] cells = new String[rowCount][colCount];

        for (int r = 0; r < rowCount; r++) {
            TabularRow row = rows.get(r);
            List<TabularCell> rowCells = row == null ? null : row.cells();
            for (int c = 0; c < colCount; c++) {
                TabularCell cell = (rowCells != null && c < rowCells.size()) ? rowCells.get(c) : null;
                if (cell == null) {
                    cells[r][c] = "";
                    continue;
                }
                if (cell.coveredBy() != null) {
                    // Covered cells are part of a merge in table imports; treat them as empty for chart import.
                    cells[r][c] = "";
                    continue;
                }
                cells[r][c] = htmlToText(cell.contentHtml());
            }
        }

        return new Grid(rowCount, colCount, cells);
    }

    private TabularPreviewDto buildPreview(Grid grid) {
        int rows = grid.rows;
        int cols = grid.cols;
        int rMax = Math.min(rows, PREVIEW_MAX_ROWS);
        int cMax = Math.min(cols, PREVIEW_MAX_COLS);

        List<List<String>> previewRows = new ArrayList<>(rMax);
        for (int r = 0; r < rMax; r++) {
            List<String> row = new ArrayList<>(cMax);
            for (int c = 0; c < cMax; c++) {
                row.add(grid.cells[r][c]);
            }
            previewRows.add(row);
        }
        return new TabularPreviewDto(rows, cols, previewRows);
    }

    private ChartImportMappingDto resolveMapping(Grid grid, ChartImportOptions options) {
        boolean hasHeader = options.hasHeader();
        int headerRowIndex = clamp(options.headerRowIndex(), 0, grid.rows - 1);
        int categoryColumnIndex = clamp(options.categoryColumnIndex(), 0, grid.cols - 1);
        ChartImportAggregation aggregation = options.aggregation() == null ? ChartImportAggregation.SUM : options.aggregation();

        List<Integer> seriesCols = options.seriesColumnIndexes();
        if (seriesCols == null || seriesCols.isEmpty()) {
            seriesCols = inferSeriesColumns(grid, hasHeader, headerRowIndex, categoryColumnIndex);
        }

        // Remove invalid/out-of-range and category col from series list.
        List<Integer> cleaned = new ArrayList<>();
        for (Integer idx : seriesCols) {
            if (idx == null) continue;
            int i = idx;
            if (i < 0 || i >= grid.cols) continue;
            if (i == categoryColumnIndex) continue;
            cleaned.add(i);
        }
        if (cleaned.isEmpty()) {
            throw new IllegalArgumentException("No numeric series columns detected. Please map at least one numeric column as a series.");
        }

        return new ChartImportMappingDto(hasHeader, headerRowIndex, categoryColumnIndex, List.copyOf(cleaned), aggregation);
    }

    private List<Integer> inferSeriesColumns(Grid grid, boolean hasHeader, int headerRowIndex, int categoryColumnIndex) {
        int startRow = hasHeader ? Math.min(headerRowIndex + 1, grid.rows - 1) : 0;

        List<Integer> out = new ArrayList<>();
        for (int c = 0; c < grid.cols; c++) {
            if (c == categoryColumnIndex) continue;

            boolean anyNumeric = false;
            for (int r = startRow; r < grid.rows; r++) {
                String v = grid.cells[r][c];
                if (tryParseNumber(v) != null) {
                    anyNumeric = true;
                    break;
                }
            }
            if (anyNumeric) out.add(c);
        }
        return out;
    }

    private ChartDataDto buildChartData(Grid grid, String chartTypeRaw, ChartImportMappingDto mapping, List<ImportWarning> warnings) {
        String chartType = (chartTypeRaw == null || chartTypeRaw.isBlank()) ? "column" : chartTypeRaw.trim();
        validateChartType(chartType);

        boolean hasHeader = mapping.hasHeader();
        int headerRowIndex = mapping.headerRowIndex();
        int categoryCol = mapping.categoryColumnIndex();
        List<Integer> seriesCols = mapping.seriesColumnIndexes();
        int startRow = hasHeader ? Math.min(headerRowIndex + 1, grid.rows) : 0;

        // Series names
        List<String> seriesNames = new ArrayList<>(seriesCols.size());
        for (int i = 0; i < seriesCols.size(); i++) {
            int c = seriesCols.get(i);
            String name = hasHeader ? grid.cells[headerRowIndex][c] : "";
            if (name == null || name.isBlank()) name = "Series " + (i + 1);
            seriesNames.add(name);
        }

        // Build raw rows: labels + values
        List<String> labels = new ArrayList<>();
        List<List<Double>> seriesData = new ArrayList<>(seriesCols.size());
        for (int i = 0; i < seriesCols.size(); i++) {
            seriesData.add(new ArrayList<>());
        }

        int replacedNonNumeric = 0;
        for (int r = startRow; r < grid.rows; r++) {
            String label = grid.cells[r][categoryCol];
            label = (label == null) ? "" : label.trim();
            if (label.isBlank()) {
                label = "Row " + (r + 1);
            }
            labels.add(label);

            for (int s = 0; s < seriesCols.size(); s++) {
                int c = seriesCols.get(s);
                String raw = grid.cells[r][c];
                Double num = tryParseNumber(raw);
                if (num == null) {
                    num = 0d;
                    if (raw != null && !raw.isBlank()) replacedNonNumeric++;
                }
                seriesData.get(s).add(num);
            }
        }

        if (labels.isEmpty()) {
            throw new IllegalArgumentException("No data rows found. Please ensure the file contains at least one row of numeric data.");
        }

        if (replacedNonNumeric > 0) {
            warnings.add(new ImportWarning("NON_NUMERIC_VALUES", "Some non-numeric values were replaced with 0 (" + replacedNonNumeric + " cells)."));
        }

        // Optional aggregation if duplicate labels exist
        Aggregated agg = aggregateIfNeeded(labels, seriesData, mapping.aggregation());
        if (agg.didAggregate) {
            warnings.add(new ImportWarning("DUPLICATE_CATEGORIES", "Duplicate categories detected. Applied aggregation: " + mapping.aggregation()));
        }

        // Build DTOs
        List<ChartSeriesDto> series = new ArrayList<>(seriesNames.size());
        for (int i = 0; i < seriesNames.size(); i++) {
            series.add(new ChartSeriesDto(seriesNames.get(i), agg.seriesData.get(i), null, null, null));
        }

        // Apply chart-type specific rules (series count, series type overrides, etc.)
        series = applyChartTypeRules(chartType, series, warnings, mapping);

        List<Boolean> visibility = agg.labels.stream().map(x -> true).toList();
        return new ChartDataDto(chartType, agg.labels, visibility, series);
    }

    private static void validateChartType(String chartType) {
        // Must match the frontend ChartType union.
        Set<String> supported = Set.of(
                "bar",
                "column",
                "line",
                "area",
                "pie",
                "donut",
                "scatter",
                "stackedBar",
                "stackedColumn",
                "stackedBarLine",
                "stackedOverlappedBarLine"
        );
        if (!supported.contains(chartType)) {
            throw new ChartImportValidationException(
                    "Unsupported chartType: " + chartType,
                    Map.of("chartType", chartType, "supported", supported)
            );
        }
    }

    private static List<ChartSeriesDto> applyChartTypeRules(
            String chartType,
            List<ChartSeriesDto> series,
            List<ImportWarning> warnings,
            ChartImportMappingDto mapping
    ) {
        if (series == null || series.isEmpty()) {
            throw new ChartImportValidationException(
                    "No series found. Please map at least one numeric column as a series.",
                    Map.of("chartType", chartType, "mapping", mapping)
            );
        }

        // Pie/Donut: exactly one series, non-negative
        if ("pie".equals(chartType) || "donut".equals(chartType)) {
            if (series.size() != 1) {
                throw new ChartImportValidationException(
                        "Pie/Donut charts require exactly one series. Please select a single numeric column.",
                        Map.of("chartType", chartType, "seriesCount", series.size(), "mapping", mapping)
                );
            }
            ChartSeriesDto s = series.get(0);
            boolean anyPositive = false;
            for (Double v : (s.data() == null ? List.<Double>of() : s.data())) {
                if (v != null && v < 0) {
                    throw new ChartImportValidationException(
                            "Pie/Donut charts do not support negative values.",
                            Map.of("chartType", chartType, "mapping", mapping)
                    );
                }
                if (v != null && v > 0) anyPositive = true;
            }
            if (!anyPositive) {
                warnings.add(new ImportWarning("ALL_ZERO_VALUES", "All values are 0; the chart may appear empty."));
            }
            return series;
        }

        // Stacked bar/line combos: require >= 2 series; first = bar, rest = line.
        if ("stackedBarLine".equals(chartType) || "stackedOverlappedBarLine".equals(chartType)) {
            if (series.size() < 2) {
                throw new ChartImportValidationException(
                        "Stacked Bar/Line charts require at least two series (one bar + one line).",
                        Map.of("chartType", chartType, "seriesCount", series.size(), "mapping", mapping)
                );
            }
            List<ChartSeriesDto> out = new ArrayList<>(series.size());
            for (int i = 0; i < series.size(); i++) {
                ChartSeriesDto s = series.get(i);
                String type = (i == 0) ? "bar" : "line";
                out.add(new ChartSeriesDto(s.name(), s.data(), s.color(), type, s.lineStyle()));
            }
            return out;
        }

        // Other types: no special series typing required for v1.
        return series;
    }

    private Aggregated aggregateIfNeeded(List<String> labels, List<List<Double>> seriesData, ChartImportAggregation aggregation) {
        if (labels == null || labels.isEmpty()) {
            return new Aggregated(false, List.of(), List.of());
        }
        if (aggregation == null) aggregation = ChartImportAggregation.SUM;

        // Detect duplicates
        Set<String> seen = new HashSet<>();
        boolean hasDuplicates = false;
        for (String l : labels) {
            if (!seen.add(l)) {
                hasDuplicates = true;
                break;
            }
        }
        if (!hasDuplicates) {
            // No aggregation needed
            List<List<Double>> copy = new ArrayList<>(seriesData.size());
            for (List<Double> s : seriesData) copy.add(List.copyOf(s));
            return new Aggregated(false, List.copyOf(labels), copy);
        }

        // Aggregate preserving first-seen order (LinkedHashMap)
        Map<String, Bucket> buckets = new LinkedHashMap<>();
        for (int i = 0; i < labels.size(); i++) {
            String key = labels.get(i);
            Bucket b = buckets.computeIfAbsent(key, k -> new Bucket(seriesData.size()));
            b.addRow(seriesData, i);
        }

        List<String> outLabels = new ArrayList<>(buckets.keySet());
        List<List<Double>> outSeries = new ArrayList<>(seriesData.size());
        for (int s = 0; s < seriesData.size(); s++) {
            List<Double> vals = new ArrayList<>(outLabels.size());
            for (Bucket b : buckets.values()) {
                vals.add(b.valueForSeries(s, aggregation));
            }
            outSeries.add(vals);
        }
        return new Aggregated(true, outLabels, outSeries);
    }

    private static final class Bucket {
        private final double[] sum;
        private final int[] count;

        Bucket(int seriesCount) {
            this.sum = new double[seriesCount];
            this.count = new int[seriesCount];
        }

        void addRow(List<List<Double>> seriesData, int rowIndex) {
            for (int s = 0; s < sum.length; s++) {
                Double v = seriesData.get(s).get(rowIndex);
                if (v == null) continue;
                sum[s] += v;
                count[s] += 1;
            }
        }

        double valueForSeries(int seriesIndex, ChartImportAggregation agg) {
            return switch (agg) {
                case SUM -> sum[seriesIndex];
                case AVG -> count[seriesIndex] == 0 ? 0d : (sum[seriesIndex] / count[seriesIndex]);
                case COUNT -> count[seriesIndex];
            };
        }
    }

    private static final class Aggregated {
        final boolean didAggregate;
        final List<String> labels;
        final List<List<Double>> seriesData;

        Aggregated(boolean didAggregate, List<String> labels, List<List<Double>> seriesData) {
            this.didAggregate = didAggregate;
            this.labels = labels;
            this.seriesData = seriesData;
        }
    }

    private static String htmlToText(String html) {
        if (html == null) return "";
        String s = HtmlUtils.htmlUnescape(html);
        // Normalize <br> first (including escaped variants that become <br> after unescape).
        s = s.replaceAll("(?i)<br\\s*/?>", "\n");
        // Strip tags
        s = s.replaceAll("(?s)<[^>]*>", "");
        // Normalize NBSP
        s = s.replace('\u00A0', ' ');
        return s.trim();
    }

    private static Double tryParseNumber(String raw) {
        if (raw == null) return null;
        String s = raw.trim();
        if (s.isEmpty()) return null;

        boolean negative = false;
        // Handle (123) negatives
        if (s.startsWith("(") && s.endsWith(")")) {
            negative = true;
            s = s.substring(1, s.length() - 1).trim();
        }

        boolean percent = false;
        if (s.endsWith("%")) {
            percent = true;
            s = s.substring(0, s.length() - 1).trim();
        }

        // Remove common thousand separators
        s = s.replace(",", "");

        // Remove leading currency/symbols (keep digits/sign/dot)
        s = s.replaceAll("^[^0-9+\\-\\.]+", "");

        if (s.isEmpty()) return null;

        try {
            double v = Double.parseDouble(s);
            if (negative) v = -v;
            if (percent) v = v / 100d;
            return v;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static int clamp(int v, int min, int max) {
        if (v < min) return min;
        if (v > max) return max;
        return v;
    }

    private record Grid(int rows, int cols, String[][] cells) {
    }
}


