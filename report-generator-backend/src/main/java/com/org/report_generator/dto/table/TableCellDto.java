package com.org.report_generator.dto.table;

public record TableCellDto(
        String id,
        String contentHtml,
        TableCellMergeDto merge,
        CoveredByDto coveredBy
) {
}
