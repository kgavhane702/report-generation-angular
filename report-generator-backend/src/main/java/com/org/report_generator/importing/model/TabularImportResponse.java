package com.org.report_generator.importing.model;

import java.util.List;

/**
 * Response envelope for tabular import endpoint.
 *
 * Add fields here in an additive way (e.g. sheetNames, detectedFormat, preview flags).
 */
public record TabularImportResponse(
        TabularDataset dataset,
        List<ImportWarning> warnings
) {
}


