package com.org.report_generator.dto.common;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.util.Map;

/**
 * Custom ResponseEntity builder for the standard {@link ApiResponse} envelope.
 *
 * Use this so controllers consistently return {@code ResponseEntity<ApiResponse<T>>}.
 */
public final class ApiResponseEntity {

    private ApiResponseEntity() {
    }

    public static <T> ResponseEntity<ApiResponse<T>> ok(T data) {
        return ResponseEntity
                .ok()
                .contentType(MediaType.APPLICATION_JSON)
                .body(ApiResponse.ok(data));
    }

    public static ResponseEntity<ApiResponse<Void>> badRequest(String code, String message) {
        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .contentType(MediaType.APPLICATION_JSON)
                .body(ApiResponse.fail(code, message));
    }

    public static ResponseEntity<ApiResponse<Void>> badRequest(String code, String message, Map<String, Object> details) {
        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .contentType(MediaType.APPLICATION_JSON)
                .body(ApiResponse.fail(code, message, details));
    }

    public static <T> ResponseEntity<ApiResponse<T>> status(HttpStatus status, ApiResponse<T> body) {
        return ResponseEntity
                .status(status)
                .contentType(MediaType.APPLICATION_JSON)
                .body(body);
    }
}


