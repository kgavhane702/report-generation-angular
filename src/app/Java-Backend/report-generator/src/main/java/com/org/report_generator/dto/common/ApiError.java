package com.org.report_generator.dto.common;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.Map;

/**
 * Standard API error payload (JSON).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiError(
        String code,
        String message,
        Map<String, Object> details
) {
}


