package com.org.report_generator.dto.http;

import com.fasterxml.jackson.annotation.JsonCreator;

/**
 * Supported HTTP methods for URL-based imports.
 */
public enum HttpMethod {
    GET,
    POST,
    PUT,
    PATCH,
    DELETE,
    HEAD,
    OPTIONS
    ;

    @JsonCreator
    public static HttpMethod fromWire(String value) {
        if (value == null) return null;
        String v = value.trim();
        if (v.isEmpty()) return null;
        return HttpMethod.valueOf(v.toUpperCase());
    }
}


