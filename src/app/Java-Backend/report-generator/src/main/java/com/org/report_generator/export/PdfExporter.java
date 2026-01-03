package com.org.report_generator.export;

import com.org.report_generator.model.document.DocumentModel;
import com.org.report_generator.render.html.HtmlDocumentRenderer;
import com.org.report_generator.service.PdfGeneratorService;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;

@Component
public class PdfExporter implements DocumentExporter {
    private final HtmlDocumentRenderer htmlRenderer;
    private final PdfGeneratorService pdfGeneratorService;

    public PdfExporter(HtmlDocumentRenderer htmlRenderer, PdfGeneratorService pdfGeneratorService) {
        this.htmlRenderer = htmlRenderer;
        this.pdfGeneratorService = pdfGeneratorService;
    }

    @Override
    public ExportFormat format() {
        return ExportFormat.PDF;
    }

    @Override
    public ExportResult export(DocumentModel document) {
        String html = htmlRenderer.render(document);
        byte[] pdf = pdfGeneratorService.generatePdf(html, document);
        return new ExportResult(pdf, MediaType.APPLICATION_PDF, "pdf");
    }
}


