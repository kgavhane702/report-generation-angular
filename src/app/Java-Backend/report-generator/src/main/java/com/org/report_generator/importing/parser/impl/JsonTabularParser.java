package com.org.report_generator.importing.parser.impl;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.org.report_generator.config.ImportLimitsConfig;
import com.org.report_generator.importing.enums.ImportFormat;
import com.org.report_generator.importing.model.CoveredBy;
import com.org.report_generator.importing.model.ImportOptions;
import com.org.report_generator.importing.model.TabularCell;
import com.org.report_generator.importing.model.TabularDataset;
import com.org.report_generator.importing.model.TabularMerge;
import com.org.report_generator.importing.model.TabularRow;
import com.org.report_generator.importing.parser.TabularParser;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.*;

/**
 * JSON implementation of {@link TabularParser}.
 *
 * Supported input shapes (file content):
 * 1) Table-structured object:
 *    { "rows": [ { "cells": [ { "contentHtml": "..." , "merge": {...}, "coveredBy": {...} } ] } ],
 *      "columnFractions": [...], "rowFractions": [...] }
 *
 * 2) Array of arrays:
 *    [ ["A","B"], ["1","2"] ]
 *
 * 3) Array of objects:
 *    [ { "A": 1, "B": 2 }, { "A": 3, "B": 4 } ]   -> header row is created from keys
 *
 * 4) Object with columns+rows:
 *    { "columns": ["A","B"], "rows": [[1,2],[3,4]] }
 *
 * 5) ECharts-like dataset:
 *    { "source": [ ["A","B"], [1,2] ] }
 *
 * Additionally, if a file is an ApiResponse envelope {success,data,error}, we unwrap `data` and parse it.
 */
@Component
public class JsonTabularParser implements TabularParser {

    private final ObjectMapper objectMapper;
    private final ImportLimitsConfig limitsConfig;

    public JsonTabularParser(ObjectMapper objectMapper, ImportLimitsConfig limitsConfig) {
        this.objectMapper = objectMapper;
        this.limitsConfig = limitsConfig;
    }

    @Override
    public ImportFormat format() {
        return ImportFormat.JSON;
    }

    @Override
    public TabularDataset parse(MultipartFile file, ImportOptions options) throws Exception {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("JSON file is required");
        }

        JsonNode root;
        try (InputStream in = file.getInputStream()) {
            root = objectMapper.readTree(in);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Invalid JSON: " + e.getOriginalMessage());
        }

        return parseNode(root);
    }

    /**
     * Parse a JSON tree into a tabular dataset.
     *
     * Package-private so other parsers (e.g. XML) can reuse the same behavior
     * (merge coverage, header merge inference, trimming, etc.) without duplicating logic.
     */
    TabularDataset parseNode(JsonNode root) {
        if (root == null || root.isNull()) {
            throw new IllegalArgumentException("Invalid JSON: empty payload");
        }

        root = unwrapEnvelope(root);

        // Convert to a 2D grid with optional merge metadata.
        Grid grid = toGrid(root);

        // Apply merge coverage so `merge` anchors hide covered cells even if the user didn't specify coveredBy.
        applyMergeCoverage(grid);

        // Trim trailing empty rows/cols
        Grid trimmed = trim(grid);

        // Re-apply merge coverage after trim (clamps spans and fixes coveredBy targets).
        applyMergeCoverage(trimmed);
        sanitizeCoveredBy(trimmed);

        // Fractions
        List<Double> colFractions = normalizeFractions(grid.columnFractions, trimmed.cols);
        List<Double> rowFractions = normalizeFractions(grid.rowFractions, trimmed.rows);

        // Map to TabularDataset
        List<TabularRow> rows = new ArrayList<>(trimmed.rows);
        for (int r = 0; r < trimmed.rows; r++) {
            List<TabularCell> cells = new ArrayList<>(trimmed.cols);
            for (int c = 0; c < trimmed.cols; c++) {
                cells.add(trimmed.cells[r][c]);
            }
            rows.add(new TabularRow("r-" + r, cells));
        }

        return new TabularDataset(rows, colFractions, rowFractions);
    }

    private JsonNode unwrapEnvelope(JsonNode node) {
        // Unwrap ApiResponse envelopes: {success:..., data: ...}
        if (node != null && node.isObject()) {
            JsonNode success = node.get("success");
            JsonNode data = node.get("data");
            if (success != null && success.isBoolean() && data != null) {
                return data.isNull() ? node : data;
            }
            // Also allow { "data": { ...table... } }
            if (data != null && data.isObject()) {
                JsonNode rows = data.get("rows");
                if (rows != null) {
                    return data;
                }
            }
        }
        return node;
    }

    private Grid toGrid(JsonNode node) {
        if (node == null || node.isNull()) {
            throw new IllegalArgumentException("Invalid JSON: empty payload");
        }

        if (node.isArray()) {
            return parseArrayRoot(node);
        }

        if (node.isObject()) {
            // ECharts dataset
            JsonNode source = node.get("source");
            if (source != null && source.isArray()) {
                return parseArrayRoot(source);
            }

            // { columns: [...], rows: [...] }
            JsonNode columns = node.get("columns");
            JsonNode rows = node.get("rows");
            if (columns != null && columns.isArray() && rows != null && rows.isArray()) {
                return parseColumnsAndRows(columns, rows);
            }

            // Table-structured object with row/cell objects
            if (rows != null && rows.isArray()) {
                return parseTableObject(node);
            }
        }

        throw new IllegalArgumentException("Unsupported JSON shape for table import");
    }

    private Grid parseArrayRoot(JsonNode arr) {
        if (!arr.isArray()) {
            throw new IllegalArgumentException("Invalid JSON: expected array");
        }

        if (arr.size() == 0) {
            return emptyGrid();
        }

        JsonNode first = arr.get(0);
        if (first != null && first.isArray()) {
            return parseArrayOfArrays(arr);
        }
        if (first != null && first.isObject()) {
            return parseArrayOfObjects(arr);
        }

        throw new IllegalArgumentException("Unsupported JSON array shape for table import");
    }

    private Grid parseArrayOfArrays(JsonNode arr) {
        int rows = arr.size();
        int cols = 0;
        for (JsonNode row : arr) {
            if (row != null && row.isArray()) {
                cols = Math.max(cols, row.size());
            }
        }
        cols = Math.max(cols, 1);
        rows = Math.max(rows, 1);

        validateDimensions(rows, cols);

        TabularCell[][] cells = new TabularCell[rows][cols];
        String[][] raw = new String[rows][cols];
        for (int r = 0; r < rows; r++) {
            JsonNode row = arr.get(r);
            for (int c = 0; c < cols; c++) {
                JsonNode v = row != null && row.isArray() && c < row.size() ? row.get(c) : null;
                String text = valueToString(v);
                String html = escapeToHtml(text).replace("\n", "<br>");
                cells[r][c] = new TabularCell(r + "-" + c, html, null, null);
                raw[r][c] = text == null ? "" : text;
            }
        }

        // If this JSON came from an Excel-exported grid that used null/empty placeholders for merged headers,
        // infer common header merges (same heuristics as CSV import).
        inferHeaderMerges(raw, cells);

        return new Grid(rows, cols, cells, null, null);
    }

    /**
     * Infer simple header merges from blanks in the first two rows.
     *
     * Example (Excel-exported grid):
     *  Row0: ["Employee ID","Personal Info",null,"Performance",null,null,"Attendance",null]
     *  Row1: [null,"Name","Department","Q1","Q2","Q3","Present Days","Absent Days"]
     */
    private static void inferHeaderMerges(String[][] raw, TabularCell[][] cells) {
        if (raw == null || cells == null) return;
        int rows = cells.length;
        if (rows < 2) return;
        int cols = cells[0].length;
        if (cols <= 0) return;
        if (!shouldInferHeaderMerges(raw)) return;

        // Horizontal merges in row 0:
        // consecutive blank cells to the right of a label, but only when row 1 has non-blank subheaders there.
        int r0 = 0;
        for (int c = 0; c < cols; c++) {
            TabularCell anchor = cells[r0][c];
            if (anchor == null || anchor.coveredBy() != null) continue;
            // Don't override existing merges supplied by the input.
            if (anchor.merge() != null) continue;
            String v = safe(raw[r0][c]).trim();
            if (v.isEmpty()) continue;

            int span = 1;
            int cc = c + 1;
            while (cc < cols) {
                TabularCell candidate = cells[r0][cc];
                if (candidate == null || candidate.coveredBy() != null) break;

                String vv = safe(raw[r0][cc]).trim();
                if (!vv.isEmpty()) break;

                String below = safe(raw[1][cc]).trim();
                if (below.isEmpty()) break;

                span++;
                cc++;
            }

            if (span > 1) {
                TabularMerge merge = new TabularMerge(1, span);
                cells[r0][c] = new TabularCell(anchor.id(), safeHtml(anchor.contentHtml()), merge, null);
            }
        }

        // Vertical merges between row 0 and row 1:
        // if row 1 is blank but row 0 has a label, and the column has data below, treat as rowspan=2.
        for (int c = 0; c < cols; c++) {
            TabularCell top = cells[0][c];
            if (top == null || top.coveredBy() != null) continue;
            // Don't override existing merges supplied by the input.
            if (top.merge() != null) continue;
            String topVal = safe(raw[0][c]).trim();
            if (topVal.isEmpty()) continue;

            // Avoid vertical merge for group headers that we already merged horizontally.
            int colSpan = top.merge() == null ? 1 : Math.max(1, top.merge().colSpan());
            if (colSpan != 1) continue;

            String belowVal = safe(raw[1][c]).trim();
            if (!belowVal.isEmpty()) continue;

            boolean hasDataBelow = false;
            for (int rr = 2; rr < rows; rr++) {
                if (!safe(raw[rr][c]).trim().isEmpty()) {
                    hasDataBelow = true;
                    break;
                }
            }
            if (!hasDataBelow) continue;

            TabularMerge merge = new TabularMerge(2, 1);
            cells[0][c] = new TabularCell(top.id(), safeHtml(top.contentHtml()), merge, null);
        }
    }

    private static boolean shouldInferHeaderMerges(String[][] raw) {
        if (raw == null || raw.length < 2) return false;
        if (!rowLooksLikeHeader(raw[0]) || !rowLooksLikeHeader(raw[1])) return false;
        // If the 3rd row also looks like a header row, this is likely just normal data with nulls.
        if (raw.length >= 3 && rowLooksLikeHeader(raw[2])) return false;

        int cols = raw[0].length;
        // Require at least one clear merged-header signal:
        // a non-empty group label followed by a blank in row0 with a non-blank subheader in row1.
        for (int c = 0; c < cols - 1; c++) {
            String a = safe(raw[0][c]).trim();
            String b = safe(raw[0][c + 1]).trim();
            String sub = safe(raw[1][c + 1]).trim();
            if (!a.isEmpty() && b.isEmpty() && !sub.isEmpty()) {
                return true;
            }
        }
        // Or a vertical header signal: row0 has a label but row1 is blank in the same column.
        for (int c = 0; c < cols; c++) {
            String a = safe(raw[0][c]).trim();
            String b = safe(raw[1][c]).trim();
            if (!a.isEmpty() && b.isEmpty()) {
                return true;
            }
        }
        return false;
    }

    private static boolean rowLooksLikeHeader(String[] row) {
        if (row == null || row.length == 0) return false;
        int nonBlank = 0;
        int headerish = 0;
        for (String s : row) {
            String v = safe(s).trim();
            if (v.isEmpty()) continue;
            nonBlank++;
            if (containsLetter(v)) {
                headerish++;
            }
        }
        if (nonBlank == 0) return false;
        // Header rows usually have mostly textual labels.
        return headerish >= Math.max(1, (int) Math.ceil(nonBlank * 0.6));
    }

    private static boolean containsLetter(String s) {
        for (int i = 0; i < s.length(); i++) {
            if (Character.isLetter(s.charAt(i))) return true;
        }
        return false;
    }

    private static String safe(String s) {
        return s == null ? "" : s;
    }

    private Grid parseArrayOfObjects(JsonNode arr) {
        // Build stable key order: first object's keys, then any new keys encountered.
        LinkedHashSet<String> keys = new LinkedHashSet<>();
        for (JsonNode item : arr) {
            if (item == null || !item.isObject()) continue;
            item.fieldNames().forEachRemaining(keys::add);
        }

        List<String> columns = new ArrayList<>(keys);
        int dataRows = arr.size();
        int rows = Math.max(1, dataRows + 1); // + header row
        int cols = Math.max(1, columns.size());

        validateDimensions(rows, cols);

        TabularCell[][] cells = new TabularCell[rows][cols];

        // Header row
        for (int c = 0; c < cols; c++) {
            String k = c < columns.size() ? columns.get(c) : "";
            cells[0][c] = new TabularCell("0-" + c, escapeToHtml(k), null, null);
        }

        // Data rows
        for (int r = 0; r < dataRows; r++) {
            JsonNode obj = arr.get(r);
            for (int c = 0; c < cols; c++) {
                String k = c < columns.size() ? columns.get(c) : null;
                JsonNode v = (obj != null && obj.isObject() && k != null) ? obj.get(k) : null;
                String text = valueToString(v);
                String html = escapeToHtml(text).replace("\n", "<br>");
                cells[r + 1][c] = new TabularCell((r + 1) + "-" + c, html, null, null);
            }
        }

        return new Grid(rows, cols, cells, null, null);
    }

    private Grid parseColumnsAndRows(JsonNode columnsNode, JsonNode rowsNode) {
        List<String> columns = new ArrayList<>();
        for (JsonNode c : columnsNode) {
            columns.add(valueToString(c));
        }

        int dataRows = rowsNode.size();
        int rows = Math.max(1, dataRows + 1);
        int cols = Math.max(1, columns.size());

        // allow wider rows than columns list
        for (JsonNode r : rowsNode) {
            if (r != null && r.isArray()) {
                cols = Math.max(cols, r.size());
            }
        }

        validateDimensions(rows, cols);

        TabularCell[][] cells = new TabularCell[rows][cols];

        for (int c = 0; c < cols; c++) {
            String k = c < columns.size() ? columns.get(c) : "";
            cells[0][c] = new TabularCell("0-" + c, escapeToHtml(k), null, null);
        }

        for (int r = 0; r < dataRows; r++) {
            JsonNode row = rowsNode.get(r);
            for (int c = 0; c < cols; c++) {
                JsonNode v = row != null && row.isArray() && c < row.size() ? row.get(c) : null;
                String text = valueToString(v);
                String html = escapeToHtml(text).replace("\n", "<br>");
                cells[r + 1][c] = new TabularCell((r + 1) + "-" + c, html, null, null);
            }
        }

        return new Grid(rows, cols, cells, null, null);
    }

    private Grid parseTableObject(JsonNode rootObj) {
        JsonNode rowsNode = rootObj.get("rows");
        if (rowsNode == null || !rowsNode.isArray()) {
            throw new IllegalArgumentException("Invalid JSON: expected 'rows' array");
        }

        // Support coordinate-based cell objects:
        // rows: [ [ {row:1,col:1,value:...}, ... ], ... ]
        // This is common when JSON was generated from a spreadsheet export.
        CoordinateGrid coord = tryParseCoordinateGrid(rowsNode);

        int rows;
        int cols;
        TabularCell[][] cells;
        boolean oneBasedCoords;
        String[][] rawMatrix;

        if (coord != null) {
            rows = coord.rows;
            cols = coord.cols;
            cells = coord.cells;
            oneBasedCoords = coord.oneBased;
            rawMatrix = coord.raw;
        } else {
            rows = Math.max(rowsNode.size(), 1);
            cols = 0;

            // Detect whether rows are arrays or objects-with-cells.
            for (JsonNode rowNode : rowsNode) {
                if (rowNode == null) continue;
                if (rowNode.isArray()) {
                    cols = Math.max(cols, rowNode.size());
                } else if (rowNode.isObject()) {
                    JsonNode cellsNode = rowNode.get("cells");
                    if (cellsNode != null && cellsNode.isArray()) {
                        cols = Math.max(cols, cellsNode.size());
                    }
                }
            }
            cols = Math.max(cols, 1);

            validateDimensions(rows, cols);

            cells = new TabularCell[rows][cols];

            for (int r = 0; r < rows; r++) {
                JsonNode rowNode = r < rowsNode.size() ? rowsNode.get(r) : null;
                JsonNode cellsNode = null;
                if (rowNode != null) {
                    if (rowNode.isArray()) {
                        cellsNode = rowNode;
                    } else if (rowNode.isObject()) {
                        cellsNode = rowNode.get("cells");
                    }
                }

                for (int c = 0; c < cols; c++) {
                    JsonNode cellNode =
                            (cellsNode != null && cellsNode.isArray() && c < cellsNode.size()) ? cellsNode.get(c) : null;
                    ParsedCell parsed = parseCellNode(cellNode, r, c);
                    cells[r][c] = parsed.cell;
                }
            }

            // For non-coordinate table objects, default merge list indexing to 1-based unless 0 is used.
            oneBasedCoords = true;
            rawMatrix = null;
        }

        // Apply explicit merges if provided (format-agnostic):
        // mergedCells: [ {startRow,startCol,rowSpan,colSpan}, ... ]
        JsonNode mergedCellsNode = rootObj.get("mergedCells");
        if (mergedCellsNode != null && mergedCellsNode.isArray() && mergedCellsNode.size() > 0) {
            boolean oneBasedMerges = oneBasedCoords;
            for (JsonNode m : mergedCellsNode) {
                if (m == null || !m.isObject()) continue;
                int sr = m.path("startRow").asInt(Integer.MIN_VALUE);
                int sc = m.path("startCol").asInt(Integer.MIN_VALUE);
                if (sr == 0 || sc == 0) {
                    oneBasedMerges = false;
                    break;
                }
            }
            applyMergedCells(cells, rows, cols, mergedCellsNode, oneBasedMerges, rawMatrix);
        }

        // Coordinate-grid JSON exports (common from spreadsheets) often represent merged headers via null placeholders
        // rather than explicit merge metadata. Reuse the CSV/array heuristic to infer those merges.
        if (rawMatrix != null) {
            // If there are already merges, mark coverage first so we don't infer overlapping header merges.
            if (hasAnyMerge(cells)) {
                applyMergeCoverage(new Grid(rows, cols, cells, null, null));
            }
            inferHeaderMerges(rawMatrix, cells);
        }

        List<Double> colFractions = readFractions(rootObj.get("columnFractions"));
        List<Double> rowFractions = readFractions(rootObj.get("rowFractions"));
        return new Grid(rows, cols, cells, colFractions, rowFractions);
    }

    private CoordinateGrid tryParseCoordinateGrid(JsonNode rowsNode) {
        if (rowsNode == null || !rowsNode.isArray()) return null;

        int minRow = Integer.MAX_VALUE;
        int minCol = Integer.MAX_VALUE;
        int maxRow = Integer.MIN_VALUE;
        int maxCol = Integer.MIN_VALUE;
        List<JsonNode> cellNodes = new ArrayList<>();

        for (JsonNode rowNode : rowsNode) {
            if (rowNode == null || !rowNode.isArray()) continue;
            for (JsonNode cellNode : rowNode) {
                if (cellNode == null || !cellNode.isObject()) continue;
                JsonNode rN = cellNode.get("row");
                JsonNode cN = cellNode.get("col");
                if (rN == null || cN == null || !rN.isNumber() || !cN.isNumber()) continue;
                int r = rN.asInt();
                int c = cN.asInt();
                cellNodes.add(cellNode);
                minRow = Math.min(minRow, r);
                minCol = Math.min(minCol, c);
                maxRow = Math.max(maxRow, r);
                maxCol = Math.max(maxCol, c);
            }
        }

        if (cellNodes.isEmpty()) {
            return null;
        }

        boolean oneBased = minRow >= 1 && minCol >= 1;
        int rows = oneBased ? maxRow : (maxRow + 1);
        int cols = oneBased ? maxCol : (maxCol + 1);
        rows = Math.max(1, rows);
        cols = Math.max(1, cols);
        validateDimensions(rows, cols);

        TabularCell[][] cells = new TabularCell[rows][cols];
        String[][] raw = new String[rows][cols];
        // Pre-fill blanks for any missing coordinates.
        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                cells[r][c] = new TabularCell(r + "-" + c, "", null, null);
                raw[r][c] = "";
            }
        }

        for (JsonNode cellNode : cellNodes) {
            int rRaw = cellNode.get("row").asInt();
            int cRaw = cellNode.get("col").asInt();
            int r = oneBased ? (rRaw - 1) : rRaw;
            int c = oneBased ? (cRaw - 1) : cRaw;
            if (r < 0 || r >= rows || c < 0 || c >= cols) {
                throw new IllegalArgumentException("Invalid cell coordinates in JSON: row=" + rRaw + ", col=" + cRaw);
            }
            ParsedCell parsed = parseCellNode(cellNode, r, c);
            cells[r][c] = parsed.cell;
            raw[r][c] = extractRawCellText(cellNode);
        }

        return new CoordinateGrid(rows, cols, cells, oneBased, raw);
    }

    private void applyMergedCells(TabularCell[][] cells, int rows, int cols, JsonNode mergedCellsNode, boolean oneBased, String[][] rawMatrix) {
        if (cells == null || mergedCellsNode == null || !mergedCellsNode.isArray()) return;
        boolean[][] occupied = new boolean[Math.max(0, rows)][Math.max(0, cols)];
        for (JsonNode m : mergedCellsNode) {
            if (m == null || !m.isObject()) continue;
            int startRowRaw = m.path("startRow").asInt(Integer.MIN_VALUE);
            int startColRaw = m.path("startCol").asInt(Integer.MIN_VALUE);
            int rowSpan = Math.max(1, m.path("rowSpan").asInt(1));
            int colSpan = Math.max(1, m.path("colSpan").asInt(1));

            if (startRowRaw == Integer.MIN_VALUE || startColRaw == Integer.MIN_VALUE) {
                throw new IllegalArgumentException("Invalid mergedCells entry: startRow/startCol are required");
            }

            int sr = oneBased ? (startRowRaw - 1) : startRowRaw;
            int sc = oneBased ? (startColRaw - 1) : startColRaw;
            if (sr < 0 || sc < 0 || sr >= rows || sc >= cols) {
                // Skip out-of-bounds merges rather than failing the whole import.
                continue;
            }

            TabularCell anchor = cells[sr][sc];
            if (anchor == null) {
                anchor = new TabularCell(sr + "-" + sc, "", null, null);
            }
            if (anchor.coveredBy() != null) {
                // Skip invalid merges that target already-covered cells.
                continue;
            }

            int endRow = Math.min(rows - 1, sr + rowSpan - 1);
            int endCol = Math.min(cols - 1, sc + colSpan - 1);
            int clampedRowSpan = endRow - sr + 1;
            int clampedColSpan = endCol - sc + 1;
            TabularMerge merge = (clampedRowSpan > 1 || clampedColSpan > 1) ? new TabularMerge(clampedRowSpan, clampedColSpan) : null;

            if (merge == null) continue;

            // Don't overwrite an existing anchor merge (prefer the input cell's inline merge, if any).
            if (cells[sr][sc] != null && cells[sr][sc].merge() != null) {
                continue;
            }

            // Safety: only accept merges that won't erase distinct non-empty values.
            if (!isSafeMergedRegion(rawMatrix, sr, sc, endRow, endCol)) {
                continue;
            }

            // Avoid overlapping merges (HTML tables can't represent overlaps).
            boolean overlaps = false;
            for (int rr = sr; rr <= endRow && !overlaps; rr++) {
                for (int cc = sc; cc <= endCol; cc++) {
                    if (occupied[rr][cc]) {
                        overlaps = true;
                        break;
                    }
                }
            }
            if (overlaps) continue;

            for (int rr = sr; rr <= endRow; rr++) {
                for (int cc = sc; cc <= endCol; cc++) {
                    occupied[rr][cc] = true;
                }
            }

            cells[sr][sc] = new TabularCell(anchor.id(), safeHtml(anchor.contentHtml()), merge, null);
        }
    }

    private record CoordinateGrid(int rows, int cols, TabularCell[][] cells, boolean oneBased, String[][] raw) {
    }

    private boolean hasAnyMerge(TabularCell[][] cells) {
        if (cells == null) return false;
        for (TabularCell[] row : cells) {
            if (row == null) continue;
            for (TabularCell c : row) {
                if (c != null && c.merge() != null) return true;
            }
        }
        return false;
    }

    private boolean isSafeMergedRegion(String[][] rawMatrix, int sr, int sc, int endRow, int endCol) {
        // If we don't have raw text, accept (backwards compatible).
        if (rawMatrix == null || rawMatrix.length == 0) return true;
        if (sr < 0 || sc < 0) return false;
        if (sr >= rawMatrix.length) return true; // can't validate
        if (rawMatrix[sr] == null || sc >= rawMatrix[sr].length) return true; // can't validate

        String anchor = safe(rawMatrix[sr][sc]).trim();
        for (int r = sr; r <= endRow && r < rawMatrix.length; r++) {
            String[] row = rawMatrix[r];
            if (row == null) continue;
            for (int c = sc; c <= endCol && c < row.length; c++) {
                String v = safe(row[c]).trim();
                if (v.isEmpty()) continue;
                if (anchor.isEmpty()) {
                    // Anchor is empty but another cell has a value -> merging would hide/erase that value.
                    return false;
                }
                if (!v.equals(anchor)) {
                    return false;
                }
            }
        }
        return true;
    }

    private String extractRawCellText(JsonNode node) {
        if (node == null || node.isNull()) return "";
        if (!node.isObject()) return valueToString(node);

        // Prefer value/text fields used by spreadsheet exports.
        if (node.has("value")) return valueToString(node.get("value"));
        if (node.has("text")) return valueToString(node.get("text"));

        // Fallback: if contentHtml is present, use it as-is (heuristics only care about blank vs non-blank and letters).
        JsonNode htmlNode = node.get("contentHtml");
        if (htmlNode != null && htmlNode.isTextual()) {
            String html = htmlNode.asText("");
            return html == null ? "" : html;
        }
        return "";
    }

    private ParsedCell parseCellNode(JsonNode node, int r, int c) {
        String id = r + "-" + c;
        String contentHtml = "";
        TabularMerge merge = null;
        CoveredBy coveredBy = null;

        if (node == null || node.isNull()) {
            return new ParsedCell(new TabularCell(id, "", null, null));
        }

        // Non-object cell -> treat as value
        if (!node.isObject()) {
            String text = valueToString(node);
            contentHtml = escapeToHtml(text).replace("\n", "<br>");
            return new ParsedCell(new TabularCell(id, contentHtml, null, null));
        }

        JsonNode idNode = node.get("id");
        if (idNode != null && idNode.isTextual()) {
            id = idNode.asText(id);
        }

        // contentHtml (trusted format for this import type)
        JsonNode htmlNode = node.get("contentHtml");
        if (htmlNode != null && htmlNode.isTextual()) {
            contentHtml = htmlNode.asText("");
        } else if (node.has("value")) {
            String text = valueToString(node.get("value"));
            contentHtml = escapeToHtml(text).replace("\n", "<br>");
        } else if (node.has("text")) {
            String text = valueToString(node.get("text"));
            contentHtml = escapeToHtml(text).replace("\n", "<br>");
        }

        // merge
        JsonNode mergeNode = node.get("merge");
        if (mergeNode != null && mergeNode.isObject()) {
            int rowSpan = Math.max(1, mergeNode.path("rowSpan").asInt(1));
            int colSpan = Math.max(1, mergeNode.path("colSpan").asInt(1));
            if (rowSpan > 1 || colSpan > 1) {
                merge = new TabularMerge(rowSpan, colSpan);
            }
        }

        // coveredBy
        JsonNode cbNode = node.get("coveredBy");
        if (cbNode != null && cbNode.isObject()) {
            int rr = cbNode.path("row").asInt(-1);
            int cc = cbNode.path("col").asInt(-1);
            if (rr >= 0 && cc >= 0) {
                coveredBy = new CoveredBy(rr, cc);
            }
        }

        // Covered cells should not carry content/merge.
        if (coveredBy != null) {
            contentHtml = "";
            merge = null;
        }

        return new ParsedCell(new TabularCell(id, contentHtml == null ? "" : contentHtml, merge, coveredBy));
    }

    private Grid trim(Grid grid) {
        int rows = grid.rows;
        int cols = grid.cols;
        if (rows <= 0 || cols <= 0) return emptyGrid();

        int lastNonEmptyRow = -1;
        boolean[] colHasContent = new boolean[cols];

        for (int r = 0; r < rows; r++) {
            boolean any = false;
            for (int c = 0; c < cols; c++) {
                TabularCell cell = grid.cells[r][c];
                boolean has = cell != null &&
                        ((cell.contentHtml() != null && !cell.contentHtml().trim().isEmpty())
                                || cell.merge() != null
                                || cell.coveredBy() != null);
                if (has) {
                    any = true;
                    colHasContent[c] = true;
                }
            }
            if (any) lastNonEmptyRow = r;
        }

        int trimmedRows = Math.max(lastNonEmptyRow + 1, 1);
        int trimmedCols = 1;
        for (int c = cols - 1; c >= 0; c--) {
            if (colHasContent[c]) {
                trimmedCols = c + 1;
                break;
            }
        }

        TabularCell[][] out = new TabularCell[trimmedRows][trimmedCols];
        for (int r = 0; r < trimmedRows; r++) {
            for (int c = 0; c < trimmedCols; c++) {
                TabularCell src = grid.cells[r][c];
                out[r][c] = src == null ? new TabularCell(r + "-" + c, "", null, null) : src;
            }
        }
        return new Grid(trimmedRows, trimmedCols, out, grid.columnFractions, grid.rowFractions);
    }

    private void applyMergeCoverage(Grid grid) {
        int rows = grid.rows;
        int cols = grid.cols;
        if (rows <= 0 || cols <= 0) return;

        // Clamp spans and mark covered cells.
        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                TabularCell cell = grid.cells[r][c];
                if (cell == null) continue;
                if (cell.coveredBy() != null) continue;

                TabularMerge merge = cell.merge();
                if (merge == null) continue;
                int rowSpan = Math.max(1, merge.rowSpan());
                int colSpan = Math.max(1, merge.colSpan());
                int endRow = Math.min(rows - 1, r + rowSpan - 1);
                int endCol = Math.min(cols - 1, c + colSpan - 1);
                int clampedRowSpan = endRow - r + 1;
                int clampedColSpan = endCol - c + 1;

                if (clampedRowSpan != rowSpan || clampedColSpan != colSpan) {
                    merge = (clampedRowSpan > 1 || clampedColSpan > 1) ? new TabularMerge(clampedRowSpan, clampedColSpan) : null;
                    grid.cells[r][c] = new TabularCell(cell.id(), safeHtml(cell.contentHtml()), merge, null);
                }

                if (merge == null) continue;

                for (int rr = r; rr <= endRow; rr++) {
                    for (int cc = c; cc <= endCol; cc++) {
                        if (rr == r && cc == c) continue;
                        TabularCell covered = grid.cells[rr][cc];
                        if (covered == null) {
                            grid.cells[rr][cc] = new TabularCell(rr + "-" + cc, "", null, new CoveredBy(r, c));
                        } else {
                            grid.cells[rr][cc] = new TabularCell(covered.id(), "", null, new CoveredBy(r, c));
                        }
                    }
                }
            }
        }
    }

    private void sanitizeCoveredBy(Grid grid) {
        int rows = grid.rows;
        int cols = grid.cols;
        Set<String> anchors = new HashSet<>();
        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                TabularCell cell = grid.cells[r][c];
                if (cell != null && cell.merge() != null) {
                    anchors.add(r + ":" + c);
                }
            }
        }

        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                TabularCell cell = grid.cells[r][c];
                if (cell == null) continue;
                CoveredBy cb = cell.coveredBy();
                if (cb == null) continue;
                if (cb.row() < 0 || cb.row() >= rows || cb.col() < 0 || cb.col() >= cols) {
                    grid.cells[r][c] = new TabularCell(cell.id(), safeHtml(cell.contentHtml()), cell.merge(), null);
                    continue;
                }
                if (!anchors.contains(cb.row() + ":" + cb.col())) {
                    grid.cells[r][c] = new TabularCell(cell.id(), safeHtml(cell.contentHtml()), cell.merge(), null);
                }
            }
        }
    }

    private void validateDimensions(int rows, int cols) {
        int safeRows = Math.max(1, rows);
        int safeCols = Math.max(1, cols);
        if (limitsConfig == null) return;
        if (safeRows > limitsConfig.getMaxRows()) {
            throw new IllegalArgumentException("Too many rows (limit: " + limitsConfig.getMaxRows() + ")");
        }
        if (safeCols > limitsConfig.getMaxColumns()) {
            throw new IllegalArgumentException("Too many columns (limit: " + limitsConfig.getMaxColumns() + ")");
        }
        long cells = (long) safeRows * (long) safeCols;
        if (cells > limitsConfig.getMaxCells()) {
            throw new IllegalArgumentException("Too many cells (limit: " + limitsConfig.getMaxCells() + ")");
        }
    }

    private static Grid emptyGrid() {
        TabularCell[][] cells = new TabularCell[1][1];
        cells[0][0] = new TabularCell("0-0", "", null, null);
        return new Grid(1, 1, cells, null, null);
    }

    private List<Double> readFractions(JsonNode node) {
        if (node == null || !node.isArray()) return null;
        List<Double> out = new ArrayList<>();
        for (JsonNode n : node) {
            if (n == null || !n.isNumber()) {
                out.add(0.0);
            } else {
                out.add(n.doubleValue());
            }
        }
        return out;
    }

    private List<Double> normalizeFractions(List<Double> input, int count) {
        int n = Math.max(1, count);
        if (input == null || input.size() != n) {
            return equalFractions(n);
        }
        double sum = 0;
        double[] cleaned = new double[n];
        for (int i = 0; i < n; i++) {
            double v = input.get(i) == null ? 0 : input.get(i);
            if (!Double.isFinite(v) || v <= 0) v = 0;
            cleaned[i] = v;
            sum += v;
        }
        if (!(sum > 0)) {
            return equalFractions(n);
        }
        List<Double> out = new ArrayList<>(n);
        for (int i = 0; i < n; i++) {
            out.add(cleaned[i] / sum);
        }
        return out;
    }

    private static List<Double> equalFractions(int n) {
        double f = 1.0 / Math.max(1, n);
        List<Double> out = new ArrayList<>(n);
        for (int i = 0; i < n; i++) out.add(f);
        return out;
    }

    private String valueToString(JsonNode node) {
        if (node == null || node.isNull()) return "";
        if (node.isTextual()) return node.asText("");
        if (node.isNumber() || node.isBoolean()) return node.asText();
        // object/array -> stringify
        try {
            return objectMapper.writeValueAsString(node);
        } catch (Exception e) {
            return node.toString();
        }
    }

    private static String safeHtml(String html) {
        return html == null ? "" : html;
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

    private record ParsedCell(TabularCell cell) {
    }

    private static final class Grid {
        final int rows;
        final int cols;
        final TabularCell[][] cells;
        final List<Double> columnFractions;
        final List<Double> rowFractions;

        Grid(int rows, int cols, TabularCell[][] cells, List<Double> columnFractions, List<Double> rowFractions) {
            this.rows = rows;
            this.cols = cols;
            this.cells = cells;
            this.columnFractions = columnFractions;
            this.rowFractions = rowFractions;
        }
    }
}


