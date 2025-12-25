package com.org.report_generator.exception;

import java.util.Map;

/**
 * Thrown when imported tabular data cannot be mapped/validated for the requested chart type.
 * Returned to the frontend as a structured BAD_REQUEST error.
 */
public class ChartImportValidationException extends RuntimeException {

    private final Map<String, Object> details;

    public ChartImportValidationException(String message) {
        super(message);
        this.details = null;
    }

    public ChartImportValidationException(String message, Map<String, Object> details) {
        super(message);
        this.details = details;
    }

    public Map<String, Object> getDetails() {
        return details;
    }
}


