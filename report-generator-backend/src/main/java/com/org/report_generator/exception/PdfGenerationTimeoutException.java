package com.org.report_generator.exception;

/**
 * Exception thrown when PDF generation times out.
 */
public class PdfGenerationTimeoutException extends PdfGenerationException {
    
    public PdfGenerationTimeoutException(String message) {
        super(message);
    }
    
    public PdfGenerationTimeoutException(String message, Throwable cause) {
        super(message, cause);
    }
}

