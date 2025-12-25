package com.org.report_generator.dto.http;

import com.org.report_generator.importing.enums.ImportFormat;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

/**
 * Request to import a Table widget from an HTTP resource.
 *
 * Backend fetches the URL, detects the format (unless overridden), parses via tabular pipeline,
 * then adapts to TableImportResponse.
 */
public record TableImportFromUrlRequest(
        @NotNull @Valid HttpRequestSpecDto request,
        ImportFormat format,
        Integer sheetIndex,
        String delimiter
) {
}



