package com.org.report_generator.importing.service;

/**
 * Result of fetching a remote HTTP resource for import.
 */
public record RemoteHttpFetchResult(
        String effectiveUrl,
        String contentType,
        String fileName,
        byte[] bytes
) {
}



