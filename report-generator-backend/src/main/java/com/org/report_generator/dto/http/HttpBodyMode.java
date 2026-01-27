package com.org.report_generator.dto.http;

import com.fasterxml.jackson.annotation.JsonCreator;

public enum HttpBodyMode {
    NONE,
    RAW
    ;

    @JsonCreator
    public static HttpBodyMode fromWire(String value) {
        if (value == null) return null;
        String v = value.trim();
        if (v.isEmpty()) return null;
        v = v.toLowerCase();
        return switch (v) {
            case "none" -> NONE;
            case "raw" -> RAW;
            default -> HttpBodyMode.valueOf(value.trim().toUpperCase());
        };
    }
}


