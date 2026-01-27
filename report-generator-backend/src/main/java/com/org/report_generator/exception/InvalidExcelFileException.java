package com.org.report_generator.exception;

/**
 * Exception thrown when an Excel file is invalid or cannot be parsed.
 */
public class InvalidExcelFileException extends RuntimeException {
    
    public InvalidExcelFileException(String message) {
        super(message);
    }
    
    public InvalidExcelFileException(String message, Throwable cause) {
        super(message, cause);
    }
}

