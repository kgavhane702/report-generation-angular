package com.org.report_generator.dto.http;

import com.fasterxml.jackson.annotation.JsonCreator;

public enum HttpAuthType {
    NONE,
    BEARER,
    BASIC,
    API_KEY
    ;

    @JsonCreator
    public static HttpAuthType fromWire(String value) {
        if (value == null) return null;
        String v = value.trim();
        if (v.isEmpty()) return null;
        v = v.replace("-", "").replace("_", "");
        v = v.toLowerCase();
        return switch (v) {
            case "none" -> NONE;
            case "bearer" -> BEARER;
            case "basic" -> BASIC;
            case "apikey" -> API_KEY;
            default -> HttpAuthType.valueOf(value.trim().toUpperCase());
        };
    }
}


