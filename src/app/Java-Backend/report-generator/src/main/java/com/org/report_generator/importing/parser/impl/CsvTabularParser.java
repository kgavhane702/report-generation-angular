package com.org.report_generator.importing.parser.impl;

import com.org.report_generator.config.ImportLimitsConfig;
import com.org.report_generator.importing.enums.ImportFormat;
import com.org.report_generator.importing.model.CoveredBy;
import com.org.report_generator.importing.model.ImportOptions;
import com.org.report_generator.importing.model.TabularCell;
import com.org.report_generator.importing.model.TabularDataset;
import com.org.report_generator.importing.model.TabularMerge;
import com.org.report_generator.importing.model.TabularRow;
import com.org.report_generator.importing.parser.TabularParser;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedInputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * CSV implementation of {@link TabularParser}.
 *
 * Notes:
 * - CSV cannot truly represent Excel merged cells. We apply a small heuristic for common "merged header"
 *   exports from Excel where merged headers become blank cells:
 *   - Horizontal: row 0 blank cells immediately after a header label (and with non-blank subheaders in row 1)
 *     are treated as a colspan merge.
 *   - Vertical: if row 1 cell is blank but row 0 has a label (and column has data below), treat as rowspan=2.
 * - Values are escaped to HTML because the Table widget model expects HTML content
 */
@Component
public class CsvTabularParser implements TabularParser {

    private final ImportLimitsConfig limitsConfig;

    public CsvTabularParser(ImportLimitsConfig limitsConfig) {
        this.limitsConfig = limitsConfig;
    }

    @Override
    public ImportFormat format() {
        return ImportFormat.CSV;
    }

    @Override
    public TabularDataset parse(MultipartFile file, ImportOptions options) throws Exception {
        String delimiterOpt = options == null ? null : options.delimiter();

        try (InputStream raw = file.getInputStream();
             BufferedInputStream in = new BufferedInputStream(raw)) {

            in.mark(64 * 1024);
            String sample = readSample(in, 32 * 1024);
            in.reset();

            char delimiter = resolveDelimiter(delimiterOpt, sample);

            CSVFormat fmt = CSVFormat.DEFAULT.builder()
                    .setDelimiter(delimiter)
                    .setQuote('"')
                    .setIgnoreEmptyLines(false)
                    .build();

            List<List<String>> rawRows = new ArrayList<>();
            int maxCols = 0;

            try (Reader reader = new InputStreamReader(in, StandardCharsets.UTF_8);
                 CSVParser parser = new CSVParser(reader, fmt)) {

                int rowIndex = 0;
                for (CSVRecord record : parser) {
                    rowIndex++;
                    if (limitsConfig != null && rowIndex > limitsConfig.getMaxRows()) {
                        throw new IllegalArgumentException("CSV has too many rows (limit: " + limitsConfig.getMaxRows() + ")");
                    }

                    List<String> row = new ArrayList<>(record.size());
                    for (String v : record) {
                        row.add(v == null ? "" : v);
                    }
                    rawRows.add(row);
                    maxCols = Math.max(maxCols, row.size());

                    if (limitsConfig != null) {
                        if (maxCols > limitsConfig.getMaxColumns()) {
                            throw new IllegalArgumentException("CSV has too many columns (limit: " + limitsConfig.getMaxColumns() + ")");
                        }
                        long cells = (long) rawRows.size() * (long) maxCols;
                        if (cells > limitsConfig.getMaxCells()) {
                            throw new IllegalArgumentException("CSV has too many cells (limit: " + limitsConfig.getMaxCells() + ")");
                        }
                    }
                }
            }

            int rowsCount = Math.max(rawRows.size(), 1);
            int colsCount = Math.max(maxCols, 1);

            // Trim trailing empty rows
            int lastNonEmptyRow = -1;
            boolean[] colHasContent = new boolean[colsCount];
            for (int r = 0; r < rawRows.size(); r++) {
                List<String> row = rawRows.get(r);
                boolean any = false;
                for (int c = 0; c < colsCount; c++) {
                    String v = c < row.size() ? row.get(c) : "";
                    boolean has = v != null && !v.trim().isEmpty();
                    if (has) {
                        any = true;
                        colHasContent[c] = true;
                    }
                }
                if (any) {
                    lastNonEmptyRow = r;
                }
            }
            int trimmedRows = Math.max(lastNonEmptyRow + 1, 1);

            int trimmedCols = 1;
            for (int c = colsCount - 1; c >= 0; c--) {
                if (colHasContent[c]) {
                    trimmedCols = c + 1;
                    break;
                }
            }

            // Build an editable matrix first so we can infer header merges (CSV has no real merge metadata).
            String[][] rawMatrix = new String[trimmedRows][trimmedCols];
            TabularCell[][] cellMatrix = new TabularCell[trimmedRows][trimmedCols];
            for (int r = 0; r < trimmedRows; r++) {
                List<String> row = r < rawRows.size() ? rawRows.get(r) : List.of();
                for (int c = 0; c < trimmedCols; c++) {
                    String v = c < row.size() ? row.get(c) : "";
                    rawMatrix[r][c] = v == null ? "" : v;
                    String html = escapeToHtml(rawMatrix[r][c]).replace("\n", "<br>");
                    cellMatrix[r][c] = new TabularCell(r + "-" + c, html, null, null);
                }
            }

            inferHeaderMerges(rawMatrix, cellMatrix);

            List<TabularRow> rows = new ArrayList<>(trimmedRows);
            for (int r = 0; r < trimmedRows; r++) {
                List<TabularCell> cells = new ArrayList<>(trimmedCols);
                for (int c = 0; c < trimmedCols; c++) {
                    cells.add(cellMatrix[r][c]);
                }
                rows.add(new TabularRow("r-" + r, cells));
            }

            List<Double> colFractions = createFractions(trimmedCols);
            List<Double> rowFractions = createFractions(trimmedRows);

            return new TabularDataset(rows, colFractions, rowFractions);
        }
    }

    /**
     * Infer simple header merges from blanks in the first two rows.
     *
     * Example (Excel-exported CSV):
     *  Row0: "Employee ID,Personal Info,,Performance,,,Attendance,"
     *  Row1: ",Name,Department,Q1,Q2,Q3,Present Days,Absent Days"
     */
    private static void inferHeaderMerges(String[][] rawMatrix, TabularCell[][] cells) {
        if (rawMatrix == null || cells == null) return;
        int rows = cells.length;
        if (rows < 2) return;
        int cols = cells[0].length;
        if (cols <= 0) return;

        // Horizontal merges in row 0 only: consecutive blank cells to the right of a label,
        // but only when the next row has non-blank subheaders in those columns (reduces false positives).
        int r = 0;
        for (int c = 0; c < cols; c++) {
            TabularCell anchor = cells[r][c];
            if (anchor == null || anchor.coveredBy() != null) continue;
            String v = safe(rawMatrix[r][c]);
            if (v.trim().isEmpty()) continue;

            int span = 1;
            int cc = c + 1;
            while (cc < cols) {
                TabularCell next = cells[r][cc];
                if (next == null || next.coveredBy() != null) break;

                String vv = safe(rawMatrix[r][cc]);
                if (!vv.trim().isEmpty()) break;

                String below = safe(rawMatrix[1][cc]);
                if (below.trim().isEmpty()) break;

                span++;
                cc++;
            }

            if (span > 1) {
                TabularMerge merge = new TabularMerge(1, span);
                cells[r][c] = new TabularCell(anchor.id(), anchor.contentHtml(), merge, null);
                for (int k = 1; k < span; k++) {
                    int col = c + k;
                    TabularCell covered = cells[r][col];
                    if (covered == null) continue;
                    cells[r][col] = new TabularCell(covered.id(), "", null, new CoveredBy(r, c));
                }
            }
        }

        // Vertical merges between row 0 and row 1: if row 1 is blank but row 0 has a label,
        // and the column has data below, treat as rowspan=2 (common for "Employee ID" style headers).
        for (int c = 0; c < cols; c++) {
            TabularCell top = cells[0][c];
            if (top == null || top.coveredBy() != null) continue;
            String topVal = safe(rawMatrix[0][c]);
            if (topVal.trim().isEmpty()) continue;

            int colSpan = top.merge() == null ? 1 : Math.max(1, top.merge().colSpan());
            if (colSpan != 1) continue; // avoid covering subheaders under a horizontal group header

            String belowVal = safe(rawMatrix[1][c]);
            if (!belowVal.trim().isEmpty()) continue;

            boolean hasDataBelow = false;
            for (int rr = 2; rr < rows; rr++) {
                if (!safe(rawMatrix[rr][c]).trim().isEmpty()) {
                    hasDataBelow = true;
                    break;
                }
            }
            if (!hasDataBelow) continue;

            TabularMerge merge = new TabularMerge(2, 1);
            cells[0][c] = new TabularCell(top.id(), top.contentHtml(), merge, null);

            TabularCell covered = cells[1][c];
            if (covered != null) {
                cells[1][c] = new TabularCell(covered.id(), "", null, new CoveredBy(0, c));
            }
        }
    }

    private static String safe(String s) {
        return s == null ? "" : s;
    }

    private static List<Double> createFractions(int count) {
        int n = Math.max(1, count);
        double f = 1.0 / n;
        List<Double> out = new ArrayList<>(n);
        for (int i = 0; i < n; i++) out.add(f);
        return out;
    }

    private static String readSample(InputStream in, int maxBytes) throws Exception {
        byte[] buf = in.readNBytes(Math.max(0, maxBytes));
        return new String(buf, StandardCharsets.UTF_8);
    }

    private static char resolveDelimiter(String delimiterOpt, String sample) {
        String d = delimiterOpt == null ? "" : delimiterOpt.trim();
        if (!d.isEmpty()) {
            if ("tab".equalsIgnoreCase(d) || "\\t".equals(d)) return '\t';
            return d.charAt(0);
        }
        return detectDelimiter(sample);
    }

    private static char detectDelimiter(String sample) {
        if (sample == null || sample.isEmpty()) return ',';
        char[] candidates = new char[]{',', ';', '\t', '|'};
        int bestCount = -1;
        char best = ',';
        for (char c : candidates) {
            int count = 0;
            for (int i = 0; i < sample.length(); i++) {
                if (sample.charAt(i) == c) count++;
            }
            if (count > bestCount) {
                bestCount = count;
                best = c;
            }
        }
        return best;
    }

    private static String escapeToHtml(String s) {
        if (s == null || s.isEmpty()) return "";
        return s
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}


