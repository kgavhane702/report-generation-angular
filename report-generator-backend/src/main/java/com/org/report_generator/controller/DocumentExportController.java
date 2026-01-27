package com.org.report_generator.controller;

import com.org.report_generator.dto.PdfGenerationRequest;
import com.org.report_generator.export.ExportFormat;
import com.org.report_generator.export.ExportResult;
import com.org.report_generator.export.ExporterRegistry;
import com.org.report_generator.model.document.DocumentModel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.text.Normalizer;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

@RestController
@Validated
@CrossOrigin(origins = "*")
@RequestMapping("/api/document")
public class DocumentExportController {

    private static final Logger logger = LoggerFactory.getLogger(DocumentExportController.class);
    private final ExporterRegistry exporterRegistry;

    public DocumentExportController(ExporterRegistry exporterRegistry) {
        this.exporterRegistry = exporterRegistry;
    }

    @GetMapping("/health")
    public Map<String, Object> health() {
        Map<String, Object> body = new HashMap<>();
        body.put("status", "ok");
        body.put("message", "Document Export Service is running");
        return body;
    }

    /**
     * Generic document export endpoint.
     * Example: POST /api/document/export?format=pdf
     * Default format is PDF.
     */
    @PostMapping(value = "/export")
    public ResponseEntity<byte[]> export(
            @RequestParam(name = "format", required = false, defaultValue = "pdf") String format,
            @Validated @RequestBody PdfGenerationRequest request
    ) {
        long startTime = System.currentTimeMillis();
        ExportFormat exportFormat = parseFormat(format);

        DocumentModel document = request.getDocument();
        logger.info("Document export request: format={}, document={}, pages={}",
                exportFormat, document.getTitle(), countPages(document));

        ExportResult result = exporterRegistry.get(exportFormat).export(document);
        byte[] bytes = result.bytes();

        long duration = System.currentTimeMillis() - startTime;
        logger.info("Document exported successfully in {}ms: {} bytes", duration, bytes.length);

        String filename = sanitizeFileName(document.getTitle(), result.fileExtension());

        return ResponseEntity.ok()
                .contentType(result.mediaType() != null ? result.mediaType() : MediaType.APPLICATION_OCTET_STREAM)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentLength(bytes.length)
                .body(bytes);
    }

    private ExportFormat parseFormat(String raw) {
        String f = raw == null ? "pdf" : raw.trim().toLowerCase(Locale.ROOT);
        if (f.isEmpty()) f = "pdf";
        return switch (f) {
            case "pdf" -> ExportFormat.PDF;
            default -> throw new ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST,
                    "Unsupported format: " + raw
            );
        };
    }

    private int countPages(DocumentModel document) {
        if (document.getSections() == null) return 0;
        int count = 0;
        for (var section : document.getSections()) {
            if (section != null && section.getSubsections() != null) {
                for (var subsection : section.getSubsections()) {
                    if (subsection != null && subsection.getPages() != null) {
                        count += subsection.getPages().size();
                    }
                }
            }
        }
        return count;
    }

    private String sanitizeFileName(String title, String extension) {
        String value = title == null || title.isBlank() ? "document" : title;
        String normalized = Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("[^\\p{ASCII}]", "")
                .replaceAll("[^a-zA-Z0-9\\-]", "-")
                .replaceAll("-{2,}", "-")
                .toLowerCase(Locale.ROOT)
                .replaceAll("^-|-$", "");
        String ext = (extension == null || extension.isBlank()) ? "bin" : extension.toLowerCase(Locale.ROOT);
        return normalized + "-" + System.currentTimeMillis() + "." + ext;
    }
}


