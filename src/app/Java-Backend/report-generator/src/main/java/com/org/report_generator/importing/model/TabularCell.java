package com.org.report_generator.importing.model;

/**
 * A single cell in a tabular dataset.
 *
 * contentHtml is used because the current table widget model expects HTML (e.g. <br>).
 * Later, this can be extended with typed values without breaking callers.
 */
public record TabularCell(
        String id,
        String contentHtml,
        TabularMerge merge,
        CoveredBy coveredBy
) {
}


