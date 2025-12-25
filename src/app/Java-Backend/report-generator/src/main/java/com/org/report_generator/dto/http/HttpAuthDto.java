package com.org.report_generator.dto.http;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record HttpAuthDto(
        HttpAuthType type,
        String bearerToken,
        Basic basic,
        ApiKey apiKey
) {
    public record Basic(String username, String password) {}

    public record ApiKey(HttpApiKeyLocation location, String name, String value) {}
}



