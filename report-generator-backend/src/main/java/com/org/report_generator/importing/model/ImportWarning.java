package com.org.report_generator.importing.model;

/**
 * Non-fatal import warning (e.g., trimmed rows, unsupported styling, etc.).
 */
public record ImportWarning(
        String code,
        String message
) {
}


