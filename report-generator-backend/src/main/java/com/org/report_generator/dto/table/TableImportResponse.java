package com.org.report_generator.dto.table;

import java.util.List;

/**
 * Common table-import response DTO used for XLSX/CSV/JSON imports.
 *
 * The name is intentionally format-agnostic (unlike the legacy ExcelTableImportResponse).
 */
public record TableImportResponse(
        List<TableRowDto> rows,
        List<Double> columnFractions,
        List<Double> rowFractions
) {
}


