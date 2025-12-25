package com.org.report_generator.dto.common;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.Map;

/**
 * Standard API response envelope (JSON).
 *
 * This makes both success and error responses consistently JSON for frontend consumers.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiResponse<T>(
        boolean success,
        T data,
        ApiError error
) {
    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(true, data, null);
    }

    public static <T> ApiResponse<T> fail(ApiError error) {
        return new ApiResponse<>(false, null, error);
    }

    public static <T> ApiResponse<T> fail(String code, String message) {
        return new ApiResponse<>(false, null, new ApiError(code, message, null));
    }

    public static <T> ApiResponse<T> fail(String code, String message, Map<String, Object> details) {
        return new ApiResponse<>(false, null, new ApiError(code, message, details));
    }
}


