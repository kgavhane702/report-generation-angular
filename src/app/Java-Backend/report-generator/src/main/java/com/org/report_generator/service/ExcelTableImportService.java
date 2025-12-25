package com.org.report_generator.service;

import com.org.report_generator.dto.table.CoveredByDto;
import com.org.report_generator.dto.table.TableImportResponse;
import com.org.report_generator.dto.table.TableCellDto;
import com.org.report_generator.dto.table.TableCellMergeDto;
import com.org.report_generator.dto.table.TableRowDto;
import com.org.report_generator.config.ImportLimitsConfig;
import com.org.report_generator.exception.InvalidExcelFileException;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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

    private static final Logger logger = LoggerFactory.getLogger(ExcelTableImportService.class);
    private final DataFormatter dataFormatter = new DataFormatter();
    private final ImportLimitsConfig limitsConfig;

    public ExcelTableImportService(ImportLimitsConfig limitsConfig) {
        this.limitsConfig = limitsConfig;
    }

    public TableImportResponse parseXlsx(InputStream inputStream, Integer sheetIndex) throws Exception {
        long startTime = System.currentTimeMillis();
        try (Workbook workbook = new XSSFWorkbook(inputStream)) {
            Sheet sheet = getSheet(workbook, sheetIndex);
            int firstRow = sheet.getFirstRowNum();
            int lastRow = sheet.getLastRowNum();
            int maxColExclusive = findMaxColumn(sheet, firstRow, lastRow);
            
            int estimatedRows = lastRow - firstRow + 1;
            logger.debug("Parsing Excel sheet: rows={}, maxCol={}", estimatedRows, maxColExclusive);
            
            // Validate dimensions against limits
            validateDimensions(estimatedRows, maxColExclusive);

            MergeMaps mergeMaps = buildMergeMaps(sheet, firstRow);
            logger.debug("Found {} merged regions", mergeMaps.anchorMerges().size());
            
            GridBuildResult gridResult = buildGrid(sheet, firstRow, lastRow, maxColExclusive, mergeMaps);
            logger.debug("Built grid: {}x{} (trimmed from {}x{})", 
                gridResult.rowsCount(), gridResult.colsCount(), 
                (lastRow - firstRow + 1), maxColExclusive);
            
            List<TableRowDto> rows = buildRowDtos(gridResult.grid, gridResult.rowsCount, gridResult.colsCount);
            rows = sanitizeCoveredBy(rows, gridResult.rowsCount, gridResult.colsCount);
            
            List<Double> columnFractions = createFractions(gridResult.colsCount);
            List<Double> rowFractions = createFractions(gridResult.rowsCount);

            long duration = System.currentTimeMillis() - startTime;
            logger.info("Excel import completed in {}ms: {} rows x {} columns", 
                duration, gridResult.rowsCount(), gridResult.colsCount());

            return new TableImportResponse(rows, columnFractions, rowFractions);
        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            logger.error("Excel import failed after {}ms", duration, e);
            if (e instanceof InvalidExcelFileException) {
                throw e;
            }
            throw new InvalidExcelFileException("Failed to parse Excel file: " + e.getMessage(), e);
        }
    }

    private Sheet getSheet(Workbook workbook, Integer sheetIndex) {
        int idx = sheetIndex == null ? 0 : sheetIndex;
        if (idx < 0 || idx >= workbook.getNumberOfSheets()) {
            idx = 0;
        }
        return workbook.getSheetAt(idx);
    }

    private int findMaxColumn(Sheet sheet, int firstRow, int lastRow) {
        int maxColExclusive = 0;
        for (int r = firstRow; r <= lastRow; r++) {
            Row row = sheet.getRow(r);
            if (row == null) continue;
            short lastCell = row.getLastCellNum();
            if (lastCell > maxColExclusive) {
                maxColExclusive = lastCell;
            }
        }
        return maxColExclusive;
    }

    private record MergeMaps(Map<Long, TableCellMergeDto> anchorMerges, Map<Long, CoveredByDto> coveredBy) {}

    private MergeMaps buildMergeMaps(Sheet sheet, int firstRow) {
        Map<Long, TableCellMergeDto> anchorMerges = new HashMap<>();
        Map<Long, CoveredByDto> coveredBy = new HashMap<>();
        
        for (int i = 0; i < sheet.getNumMergedRegions(); i++) {
            var region = sheet.getMergedRegion(i);
            int r1 = region.getFirstRow();
            int r2 = region.getLastRow();
            int c1 = region.getFirstColumn();
            int c2 = region.getLastColumn();
            int rowSpan = (r2 - r1) + 1;
            int colSpan = (c2 - c1) + 1;

            long anchorKey = encodeCoordinate(r1, c1);
            anchorMerges.put(anchorKey, new TableCellMergeDto(rowSpan, colSpan));

            for (int rr = r1; rr <= r2; rr++) {
                for (int cc = c1; cc <= c2; cc++) {
                    if (rr == r1 && cc == c1) continue;
                    coveredBy.put(encodeCoordinate(rr, cc), new CoveredByDto(r1 - firstRow, c1));
                }
            }
        }
        
        return new MergeMaps(anchorMerges, coveredBy);
    }

    private record GridBuildResult(List<List<TableCellDto>> grid, int rowsCount, int colsCount) {}

    private GridBuildResult buildGrid(Sheet sheet, int firstRow, int lastRow, int maxColExclusive, MergeMaps mergeMaps) {
        int rowsCount = (lastRow - firstRow) + 1;
        int colsCount = Math.max(maxColExclusive, 1);

        int lastNonEmptyRow = -1;
        boolean[] colHasContent = new boolean[colsCount];

        List<List<TableCellDto>> grid = new ArrayList<>(rowsCount);
        for (int r = 0; r < rowsCount; r++) {
            List<TableCellDto> rowCells = buildRowCells(sheet, firstRow, r, colsCount, mergeMaps, colHasContent);
            grid.add(rowCells);
            
            // Update last non-empty row if this row has content
            if (rowCells.stream().anyMatch(cell -> 
                (cell.contentHtml() != null && !cell.contentHtml().trim().isEmpty()) || 
                cell.coveredBy() != null || 
                cell.merge() != null)) {
                lastNonEmptyRow = r;
            }
        }

        // Determine trimmed bounds
        int trimmedRows = Math.max(lastNonEmptyRow + 1, 1);
        
        // Find last non-empty column
        int trimmedCols = 1;
        for (int c = colsCount - 1; c >= 0; c--) {
            if (colHasContent[c]) {
                trimmedCols = c + 1;
                break;
            }
        }

        return new GridBuildResult(grid, trimmedRows, trimmedCols);
    }

    private List<TableCellDto> buildRowCells(Sheet sheet, int firstRow, int rowIndex, int colsCount, 
                                             MergeMaps mergeMaps, boolean[] colHasContent) {
        List<TableCellDto> rowCells = new ArrayList<>(colsCount);
        
        for (int c = 0; c < colsCount; c++) {
            int sheetRow = firstRow + rowIndex;
            int sheetCol = c;
            long coord = encodeCoordinate(sheetRow, sheetCol);

            CoveredByDto covered = mergeMaps.coveredBy().get(coord);
            TableCellMergeDto merge = mergeMaps.anchorMerges().get(coord);

            String valueHtml = toHtmlCellText(sheet, sheetRow, sheetCol);
            if (covered != null) {
                valueHtml = "";
                merge = null;
            }

            // Track content for column trimming
            boolean hasContent = (valueHtml != null && !valueHtml.trim().isEmpty()) || covered != null || merge != null;
            if (hasContent) {
                colHasContent[c] = true;
            }

            String id = rowIndex + "-" + c;
            rowCells.add(new TableCellDto(id, valueHtml, merge, covered));
        }
        
        return rowCells;
    }

    private List<TableRowDto> buildRowDtos(List<List<TableCellDto>> grid, int rowsCount, int colsCount) {
        List<TableRowDto> rows = new ArrayList<>(rowsCount);
        for (int r = 0; r < rowsCount; r++) {
            List<TableCellDto> rowCells = grid.get(r).subList(0, colsCount);
            rows.add(new TableRowDto("r-" + r, rowCells));
        }
        return rows;
    }

    private List<Double> createFractions(int count) {
        List<Double> fractions = new ArrayList<>(count);
        double fraction = 1.0 / count;
        for (int i = 0; i < count; i++) {
            fractions.add(fraction);
        }
        return fractions;
    }

    /**
     * Encodes row and column coordinates into a single long value.
     * Uses bit shifting: (row << 32) | col
     * This avoids String allocations and improves performance for large sheets.
     */
    private static long encodeCoordinate(int row, int col) {
        return ((long) row << 32) | (col & 0xFFFFFFFFL);
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

    private void validateDimensions(int rows, int columns) {
        if (rows > limitsConfig.getMaxRows()) {
            throw new InvalidExcelFileException(
                String.format("Sheet exceeds maximum rows limit: %d > %d", rows, limitsConfig.getMaxRows()));
        }
        if (columns > limitsConfig.getMaxColumns()) {
            throw new InvalidExcelFileException(
                String.format("Sheet exceeds maximum columns limit: %d > %d", columns, limitsConfig.getMaxColumns()));
        }
        long totalCells = (long) rows * columns;
        if (totalCells > limitsConfig.getMaxCells()) {
            throw new InvalidExcelFileException(
                String.format("Sheet exceeds maximum cells limit: %d > %d", totalCells, limitsConfig.getMaxCells()));
        }
    }

    private static List<TableRowDto> sanitizeCoveredBy(List<TableRowDto> rows, int rowCount, int colCount) {
        Set<Long> validAnchors = new HashSet<>();
        for (int r = 0; r < rows.size(); r++) {
            for (int c = 0; c < rows.get(r).cells().size(); c++) {
                TableCellDto cell = rows.get(r).cells().get(c);
                if (cell.merge() != null) {
                    validAnchors.add(encodeCoordinate(r, c));
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
                    } else if (!validAnchors.contains(encodeCoordinate(cb.row(), cb.col()))) {
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
