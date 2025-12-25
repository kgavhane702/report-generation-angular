package com.org.report_generator.dto.http;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record HttpRequestSpecDto(
        @NotBlank String url,
        @NotNull HttpMethod method,

        List<HttpKeyValueDto> queryParams,
        List<HttpKeyValueDto> headers,
        List<HttpKeyValueDto> cookies,
        /** Raw Cookie header; takes precedence over cookies[]. */
        String cookieHeader,

        @Valid HttpAuthDto auth,
        @Valid HttpBodyDto body,

        Integer timeoutMs,
        Boolean followRedirects
) {
}



