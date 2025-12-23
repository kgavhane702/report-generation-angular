package com.org.report_generator.dto.table;

import java.util.List;

public record TableRowDto(
        String id,
        List<TableCellDto> cells
) {
}
