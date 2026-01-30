package com.org.report_generator.exception;

import com.org.report_generator.dto.common.ApiResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ApiExceptionHandlerTest {

    private ApiExceptionHandler handler;

    @BeforeEach
    void setUp() {
        handler = new ApiExceptionHandler();
    }

    @Test
    void shouldHandlePdfGenerationException() {
        PdfGenerationException ex = new PdfGenerationException("PDF generation failed");
        
        ResponseEntity<ApiResponse<Void>> response = handler.handlePdfError(ex);
        
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().success()).isFalse();
        assertThat(response.getBody().error()).isNotNull();
        assertThat(response.getBody().error().message()).contains("PDF generation failed");
    }

    @Test
    void shouldHandleInvalidExcelFileException() {
        InvalidExcelFileException ex = new InvalidExcelFileException("Invalid Excel file");
        
        ResponseEntity<ApiResponse<Void>> response = handler.handleInvalidExcel(ex);
        
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().success()).isFalse();
        assertThat(response.getBody().error().message()).contains("Invalid Excel file");
    }

    @Test
    void shouldHandleChartImportValidationException() {
        Map<String, Object> details = Map.of("field", "category", "error", "missing");
        ChartImportValidationException ex = new ChartImportValidationException("Validation failed", details);
        
        ResponseEntity<ApiResponse<Void>> response = handler.handleChartImportValidation(ex);
        
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().success()).isFalse();
    }

    @Test
    void shouldHandleIllegalArgumentException() {
        IllegalArgumentException ex = new IllegalArgumentException("Invalid argument");
        
        ResponseEntity<ApiResponse<Void>> response = handler.handleIllegalArgument(ex);
        
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().success()).isFalse();
    }

    @Test
    void shouldHandleGenericException() {
        Exception ex = new RuntimeException("Unexpected error");
        
        ResponseEntity<ApiResponse<Void>> response = handler.handleGeneric(ex);
        
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().success()).isFalse();
    }
}
