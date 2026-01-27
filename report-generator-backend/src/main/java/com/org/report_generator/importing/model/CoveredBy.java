package com.org.report_generator.importing.model;

/**
 * Indicates this cell is covered by a merged anchor cell at the given coordinates.
 * Covered cells should not be rendered as table cells.
 */
public record CoveredBy(
        int row,
        int col
) {
}


