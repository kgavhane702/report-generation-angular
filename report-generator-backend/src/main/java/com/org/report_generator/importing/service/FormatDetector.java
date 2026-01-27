package com.org.report_generator.importing.service;

import com.org.report_generator.importing.enums.ImportFormat;
import org.springframework.stereotype.Component;

/**
 * Best-effort detector for {@link ImportFormat} based on headers, URL, and byte sniffing.
 */
@Component
public class FormatDetector {

    public ImportFormat detect(ImportFormat override, String url, String contentType, byte[] bytes) {
        if (override != null) {
            return override;
        }

        ImportFormat byUrl = detectByUrl(url);
        if (byUrl != null) return byUrl;

        ImportFormat byContentType = detectByContentType(contentType);
        if (byContentType != null) return byContentType;

        ImportFormat bySniff = detectBySniff(bytes);
        if (bySniff != null) return bySniff;

        // Default to CSV for plain-text unknowns (most forgiving).
        return ImportFormat.CSV;
    }

    private static ImportFormat detectByUrl(String url) {
        if (url == null) return null;
        String lower = url.toLowerCase();
        // Ignore query string for extension checks
        int q = lower.indexOf('?');
        if (q >= 0) lower = lower.substring(0, q);

        if (lower.endsWith(".xlsx")) return ImportFormat.XLSX;
        if (lower.endsWith(".csv")) return ImportFormat.CSV;
        if (lower.endsWith(".json")) return ImportFormat.JSON;
        if (lower.endsWith(".xml")) return ImportFormat.XML;
        return null;
    }

    private static ImportFormat detectByContentType(String contentType) {
        if (contentType == null) return null;
        String ct = contentType.toLowerCase();

        if (ct.contains("spreadsheetml") || ct.contains("application/vnd.ms-excel")) return ImportFormat.XLSX;
        if (ct.contains("text/csv")) return ImportFormat.CSV;
        if (ct.contains("application/json") || ct.contains("+json")) return ImportFormat.JSON;
        if (ct.contains("application/xml") || ct.contains("text/xml") || ct.contains("+xml")) return ImportFormat.XML;
        return null;
    }

    private static ImportFormat detectBySniff(byte[] bytes) {
        if (bytes == null || bytes.length == 0) return null;

        // XLSX is a ZIP container (starts with PK)
        if (bytes.length >= 2 && bytes[0] == 'P' && bytes[1] == 'K') {
            return ImportFormat.XLSX;
        }

        // Find first non-whitespace char
        int i = 0;
        while (i < bytes.length) {
            byte b = bytes[i];
            if (b != ' ' && b != '\n' && b != '\r' && b != '\t') break;
            i++;
        }
        if (i >= bytes.length) return null;

        byte first = bytes[i];
        if (first == '{' || first == '[') return ImportFormat.JSON;
        if (first == '<') return ImportFormat.XML;

        return null;
    }
}



