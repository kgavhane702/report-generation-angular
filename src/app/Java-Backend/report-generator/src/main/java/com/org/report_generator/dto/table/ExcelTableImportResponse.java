package com.org.report_generator.dto.table;

import java.util.List;

public record ExcelTableImportResponse(
        List<TableRowDto> rows,
        List<Double> columnFractions,
        List<Double> rowFractions
) {
}
