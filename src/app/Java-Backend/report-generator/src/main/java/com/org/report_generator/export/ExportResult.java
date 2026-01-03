package com.org.report_generator.export;

import org.springframework.http.MediaType;

public record ExportResult(
        byte[] bytes,
        MediaType mediaType,
        String fileExtension
) {}


