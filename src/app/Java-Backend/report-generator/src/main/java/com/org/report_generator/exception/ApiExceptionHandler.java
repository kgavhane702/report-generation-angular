package com.org.report_generator.exception;

import com.org.report_generator.dto.common.ApiResponse;
import com.org.report_generator.dto.common.ApiResponseEntity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.HashMap;
import java.util.Map;

/**
 * Ensures errors are returned as JSON consistently.
 *
 * This supports the frontend requirement: "every response will be JSON".
 */
@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger logger = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> errors = new HashMap<>();
        ex.getBindingResult().getAllErrors().forEach(error -> {
            String fieldName = error instanceof FieldError fieldError ? fieldError.getField() : error.getObjectName();
            errors.put(fieldName, error.getDefaultMessage());
        });
        return ApiResponseEntity.badRequest("VALIDATION_FAILED", "Validation failed", Map.of("errors", errors));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResponse<Void>> handleIllegalArgument(IllegalArgumentException e) {
        return ApiResponseEntity.badRequest("BAD_REQUEST", safeMessage(e));
    }

    @ExceptionHandler(InvalidExcelFileException.class)
    public ResponseEntity<ApiResponse<Void>> handleInvalidExcel(InvalidExcelFileException e) {
        return ApiResponseEntity.badRequest("INVALID_FILE", safeMessage(e));
    }

    @ExceptionHandler(PdfGenerationException.class)
    public ResponseEntity<ApiResponse<Void>> handlePdfError(PdfGenerationException e) {
        return ApiResponseEntity.status(
                HttpStatus.INTERNAL_SERVER_ERROR,
                ApiResponse.fail("PDF_ERROR", safeMessage(e))
        );
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleGeneric(Exception e) {
        logger.error("Unhandled exception", e);
        return ApiResponseEntity.status(
                HttpStatus.INTERNAL_SERVER_ERROR,
                ApiResponse.fail("INTERNAL_ERROR", "Something went wrong")
        );
    }

    private static String safeMessage(Throwable t) {
        String m = t == null ? null : t.getMessage();
        return (m == null || m.isBlank()) ? "Request failed" : m;
    }
}
