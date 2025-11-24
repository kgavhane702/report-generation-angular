package com.org.report_generator.controller;

import com.org.report_generator.dto.PdfGenerationRequest;
import com.org.report_generator.model.document.DocumentModel;
import com.org.report_generator.service.DocumentRenderService;
import com.org.report_generator.service.PdfGeneratorService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

@RestController
@Validated
@CrossOrigin(origins = "*")
@RequestMapping
public class PdfController {

    private final DocumentRenderService documentRenderService;
    private final PdfGeneratorService pdfGeneratorService;

    public PdfController(DocumentRenderService documentRenderService,
                         PdfGeneratorService pdfGeneratorService) {
        this.documentRenderService = documentRenderService;
        this.pdfGeneratorService = pdfGeneratorService;
    }

    @GetMapping("/health")
    public Map<String, Object> health() {
        Map<String, Object> body = new HashMap<>();
        body.put("status", "ok");
        body.put("message", "PDF Generation Service is running");
        return body;
    }

    @PostMapping(value = "/api/generate-pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> generatePdf(@Validated @RequestBody PdfGenerationRequest request) {
        DocumentModel document = request.getDocument();
        String html = documentRenderService.render(document);
        byte[] pdfBuffer = pdfGeneratorService.generatePdf(html, document);

        String filename = sanitizeFileName(document.getTitle());

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentLength(pdfBuffer.length)
                .body(pdfBuffer);
    }

    private String sanitizeFileName(String title) {
        String value = title == null || title.isBlank() ? "document" : title;
        String normalized = Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("[^\\p{ASCII}]", "")
                .replaceAll("[^a-zA-Z0-9\\-]", "-")
                .replaceAll("-{2,}", "-")
                .toLowerCase(Locale.ROOT)
                .replaceAll("^-|-$", "");
        return normalized + "-" + System.currentTimeMillis() + ".pdf";
    }
}

