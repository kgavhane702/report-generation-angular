package com.org.report_generator.dto.http;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record HttpBodyDto(
        HttpBodyMode mode,
        String raw,
        String contentType
) {
}



