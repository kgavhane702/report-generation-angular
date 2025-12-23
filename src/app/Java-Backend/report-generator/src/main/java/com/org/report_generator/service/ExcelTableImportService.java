package com.org.report_generator.service;

import com.org.report_generator.dto.table.CoveredByDto;
import com.org.report_generator.dto.table.ExcelTableImportResponse;
import com.org.report_generator.dto.table.TableCellDto;
import com.org.report_generator.dto.table.TableCellMergeDto;
import com.org.report_generator.dto.table.TableRowDto;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class ExcelTableImportService {

    private final DataFormatter dataFormatter = new DataFormatter();

    public ExcelTableImportResponse parseXlsx(InputStream inputStream, Integer sheetIndex) throws Exception {
        try (Workbook workbook = new XSSFWorkbook(inputStream)) {
            int idx = sheetIndex == null ? 0 : sheetIndex;
            if (idx < 0 || idx >= workbook.getNumberOfSheets()) {
                idx = 0;
            }
            Sheet sheet = workbook.getSheetAt(idx);

            int firstRow = sheet.getFirstRowNum();
            int lastRow = sheet.getLastRowNum();

            int maxColExclusive = 0;
            for (int r = firstRow; r <= lastRow; r++) {
                Row row = sheet.getRow(r);
                if (row == null) continue;
                short lastCell = row.getLastCellNum();
                if (lastCell > maxColExclusive) {
                    maxColExclusive = lastCell;
                }
            }

            // Build merge maps: anchor->(rowSpan,colSpan), coveredCells->anchorCoord
            Map<String, TableCellMergeDto> anchorMerges = new HashMap<>();
            Map<String, CoveredByDto> coveredBy = new HashMap<>();
            for (int i = 0; i < sheet.getNumMergedRegions(); i++) {
                var region = sheet.getMergedRegion(i);
                int r1 = region.getFirstRow();
                int r2 = region.getLastRow();
                int c1 = region.getFirstColumn();
                int c2 = region.getLastColumn();
                int rowSpan = (r2 - r1) + 1;
                int colSpan = (c2 - c1) + 1;

                String anchorKey = key(r1, c1);
                anchorMerges.put(anchorKey, new TableCellMergeDto(rowSpan, colSpan));

                for (int rr = r1; rr <= r2; rr++) {
                    for (int cc = c1; cc <= c2; cc++) {
                        if (rr == r1 && cc == c1) continue;
                        coveredBy.put(key(rr, cc), new CoveredByDto(r1 - firstRow, c1));
                    }
                }
            }

            // Normalize to a contiguous grid, trimming trailing completely empty rows.
            int rowsCount = (lastRow - firstRow) + 1;
            int colsCount = Math.max(maxColExclusive, 1);

            List<List<TableCellDto>> grid = new ArrayList<>();
            for (int r = 0; r < rowsCount; r++) {
                List<TableCellDto> rowCells = new ArrayList<>(colsCount);
                for (int c = 0; c < colsCount; c++) {
                    int sheetRow = firstRow + r;
                    int sheetCol = c;
                    String k = key(sheetRow, sheetCol);

                    CoveredByDto covered = coveredBy.get(k);
                    TableCellMergeDto merge = anchorMerges.get(k);

                    String valueHtml = toHtmlCellText(sheet, sheetRow, sheetCol);
                    // For covered cells, keep content empty (Excel usually stores it only in anchor)
                    if (covered != null) {
                        valueHtml = "";
                        merge = null;
                    }

                    String id = r + "-" + c;
                    rowCells.add(new TableCellDto(id, valueHtml, merge, covered));
                }
                grid.add(rowCells);
            }

            int trimmedRows = trimTrailingEmptyRows(grid);
            if (trimmedRows != grid.size()) {
                grid = grid.subList(0, trimmedRows);
                rowsCount = trimmedRows;
            }

            int trimmedCols = trimTrailingEmptyCols(grid);
            if (trimmedCols != colsCount) {
                for (int r = 0; r < grid.size(); r++) {
                    grid.set(r, grid.get(r).subList(0, trimmedCols));
                }
                colsCount = Math.max(trimmedCols, 1);
            }

            // Column/row fractions evenly distributed for now.
            List<Double> columnFractions = new ArrayList<>(colsCount);
            for (int c = 0; c < colsCount; c++) columnFractions.add(1.0 / colsCount);

            List<Double> rowFractions = new ArrayList<>(rowsCount);
            for (int r = 0; r < rowsCount; r++) rowFractions.add(1.0 / rowsCount);

            // Build rows DTO
            List<TableRowDto> rows = new ArrayList<>(rowsCount);
            for (int r = 0; r < rowsCount; r++) {
                rows.add(new TableRowDto("r-" + r, grid.get(r)));
            }

            // Fix coveredBy coordinates to be 0-based table coords (row already is), col already 0-based.
            // Also ensure coveredBy points to anchor inside trimmed grid.
            rows = sanitizeCoveredBy(rows, rowsCount, colsCount);

            return new ExcelTableImportResponse(rows, columnFractions, rowFractions);
        }
    }

    private static String key(int r, int c) {
        return r + ":" + c;
    }

    private String toHtmlCellText(Sheet sheet, int r, int c) {
        Row row = sheet.getRow(r);
        if (row == null) return "";
        Cell cell = row.getCell(c);
        if (cell == null) return "";

        CellType type = cell.getCellType();
        if (type == CellType.FORMULA) {
            type = cell.getCachedFormulaResultType();
        }

        String text;
        if (type == CellType.NUMERIC && DateUtil.isCellDateFormatted(cell)) {
            var date = cell.getDateCellValue().toInstant().atZone(ZoneId.systemDefault()).toLocalDateTime();
            text = date.toString();
        } else {
            text = dataFormatter.formatCellValue(cell);
        }

        return escapeToHtml(text).replace("\n", "<br>");
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

    private static boolean isEffectivelyEmptyCell(TableCellDto cell) {
        boolean hasContent = cell.contentHtml() != null && !cell.contentHtml().trim().isEmpty();
        boolean isCovered = cell.coveredBy() != null;
        // Covered cells are allowed to be empty; treat them as not-empty so we don't trim columns/rows incorrectly
        return !hasContent && !isCovered;
    }

    private static int trimTrailingEmptyRows(List<List<TableCellDto>> grid) {
        int lastNonEmpty = grid.size() - 1;
        while (lastNonEmpty >= 0) {
            boolean anyNonEmpty = false;
            for (TableCellDto cell : grid.get(lastNonEmpty)) {
                if (!isEffectivelyEmptyCell(cell)) {
                    anyNonEmpty = true;
                    break;
                }
            }
            if (anyNonEmpty) break;
            lastNonEmpty--;
        }
        return Math.max(lastNonEmpty + 1, 1);
    }

    private static int trimTrailingEmptyCols(List<List<TableCellDto>> grid) {
        if (grid.isEmpty()) return 1;
        int cols = grid.get(0).size();
        int lastNonEmpty = cols - 1;
        while (lastNonEmpty >= 0) {
            boolean anyNonEmpty = false;
            for (List<TableCellDto> row : grid) {
                if (lastNonEmpty >= row.size()) continue;
                if (!isEffectivelyEmptyCell(row.get(lastNonEmpty))) {
                    anyNonEmpty = true;
                    break;
                }
            }
            if (anyNonEmpty) break;
            lastNonEmpty--;
        }
        return Math.max(lastNonEmpty + 1, 1);
    }

    private static List<TableRowDto> sanitizeCoveredBy(List<TableRowDto> rows, int rowCount, int colCount) {
        Set<String> validAnchors = new HashSet<>();
        for (int r = 0; r < rows.size(); r++) {
            for (int c = 0; c < rows.get(r).cells().size(); c++) {
                TableCellDto cell = rows.get(r).cells().get(c);
                if (cell.merge() != null) {
                    validAnchors.add(r + ":" + c);
                }
            }
        }

        List<TableRowDto> out = new ArrayList<>(rows.size());
        for (int r = 0; r < rows.size(); r++) {
            List<TableCellDto> newCells = new ArrayList<>(rows.get(r).cells().size());
            for (int c = 0; c < rows.get(r).cells().size(); c++) {
                TableCellDto cell = rows.get(r).cells().get(c);
                CoveredByDto cb = cell.coveredBy();
                if (cb != null) {
                    if (cb.row() < 0 || cb.row() >= rowCount || cb.col() < 0 || cb.col() >= colCount) {
                        cb = null;
                    } else if (!validAnchors.contains(cb.row() + ":" + cb.col())) {
                        cb = null;
                    }
                }
                newCells.add(new TableCellDto(cell.id(), cell.contentHtml(), cell.merge(), cb));
            }
            out.add(new TableRowDto(rows.get(r).id(), newCells));
        }
        return out;
    }
}
