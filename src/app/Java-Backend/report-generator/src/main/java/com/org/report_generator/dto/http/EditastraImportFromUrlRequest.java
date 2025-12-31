package com.org.report_generator.dto.http;

import com.org.report_generator.importing.enums.ImportFormat;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

/**
 * Request to import an Editastra widget from an HTTP resource.
 *
 * Backend fetches the URL, detects the format (unless overridden), parses via the tabular pipeline,
 * and then flattens the dataset into a single HTML string (line-per-row).
 */
public record EditastraImportFromUrlRequest(
        @NotNull @Valid HttpRequestSpecDto request,
        ImportFormat format,
        Integer sheetIndex,
        String delimiter
) {
}


