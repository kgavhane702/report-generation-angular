package com.org.report_generator.importing.model;

/**
 * Options for tabular import parsing.
 *
 * Keep this small and additive; new options should have safe defaults.
 */
public record ImportOptions(
        Integer sheetIndex
) {
}


