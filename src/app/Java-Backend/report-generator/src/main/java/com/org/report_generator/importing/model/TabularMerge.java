package com.org.report_generator.importing.model;

/**
 * Merge information for an anchor cell (rowSpan/colSpan).
 */
public record TabularMerge(
        int rowSpan,
        int colSpan
) {
}


