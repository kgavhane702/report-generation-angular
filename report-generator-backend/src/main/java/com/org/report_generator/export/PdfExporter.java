package com.org.report_generator.export;

import com.org.report_generator.model.document.DocumentModel;
import com.org.report_generator.render.html.HtmlDocumentRenderer;
import com.org.report_generator.service.PdfGeneratorService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;

@Component
public class PdfExporter implements DocumentExporter {
    private static final Logger logger = LoggerFactory.getLogger(PdfExporter.class);
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
        long t0 = System.nanoTime();
        String html = htmlRenderer.render(document);
        long tHtml = System.nanoTime();
        byte[] pdf = pdfGeneratorService.generatePdf(html, document);
        long tPdf = System.nanoTime();

        logger.info("PDF export timings: htmlRender={}ms, pdfPipeline={}ms, total={}ms",
                toMs(tHtml - t0), toMs(tPdf - tHtml), toMs(tPdf - t0));
        return new ExportResult(pdf, MediaType.APPLICATION_PDF, "pdf");
    }

    private static long toMs(long nanos) {
        return Math.round(nanos / 1_000_000d);
    }
}


