package com.org.report_generator.importing.enums;

/**
 * File formats supported by the tabular import pipeline.
 *
 * NOTE: Only XLSX is implemented right now. Add CSV/JSON later by introducing new
 * {@code TabularParser} implementations (Strategy pattern) without changing callers.
 */
public enum ImportFormat {
    XLSX
}


