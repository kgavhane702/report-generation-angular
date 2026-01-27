package com.org.report_generator.dto.http;

import com.fasterxml.jackson.annotation.JsonCreator;

public enum HttpApiKeyLocation {
    HEADER,
    QUERY
    ;

    @JsonCreator
    public static HttpApiKeyLocation fromWire(String value) {
        if (value == null) return null;
        String v = value.trim();
        if (v.isEmpty()) return null;
        v = v.toLowerCase();
        return switch (v) {
            case "header" -> HEADER;
            case "query" -> QUERY;
            default -> HttpApiKeyLocation.valueOf(value.trim().toUpperCase());
        };
    }
}


