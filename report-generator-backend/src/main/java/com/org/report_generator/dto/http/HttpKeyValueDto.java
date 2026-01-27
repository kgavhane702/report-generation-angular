package com.org.report_generator.dto.http;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record HttpKeyValueDto(
        String key,
        String value,
        Boolean enabled
) {
    public boolean isEnabled() {
        return enabled == null || enabled;
    }
}



