package com.org.report_generator.export;

import com.org.report_generator.config.PdfExportProperties;
import com.org.report_generator.model.document.DocumentModel;
import com.org.report_generator.render.html.HtmlDocumentRenderer;
import com.org.report_generator.service.PdfGeneratorService;
import com.org.report_generator.service.UiPdfGeneratorService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;

@Component
public class PdfExporter implements DocumentExporter {
    private static final Logger logger = LoggerFactory.getLogger(PdfExporter.class);
    private final HtmlDocumentRenderer htmlRenderer;
    private final PdfGeneratorService pdfGeneratorService;
    private final UiPdfGeneratorService uiPdfGeneratorService;
    private final PdfExportProperties pdfExportProperties;

    public PdfExporter(
            HtmlDocumentRenderer htmlRenderer,
            PdfGeneratorService pdfGeneratorService,
            UiPdfGeneratorService uiPdfGeneratorService,
            PdfExportProperties pdfExportProperties
    ) {
        this.htmlRenderer = htmlRenderer;
        this.pdfGeneratorService = pdfGeneratorService;
        this.uiPdfGeneratorService = uiPdfGeneratorService;
        this.pdfExportProperties = pdfExportProperties;
    }

    @Override
    public ExportFormat format() {
        return ExportFormat.PDF;
    }

    @Override
    public ExportResult export(DocumentModel document) {
        long t0 = System.nanoTime();

        byte[] pdf;
        if (pdfExportProperties != null && pdfExportProperties.getRenderer() == PdfExportProperties.Renderer.UI) {
            pdf = uiPdfGeneratorService.generatePdfFromUi(document);
            long tPdf = System.nanoTime();
            logger.info("PDF export timings (ui): pdfPipeline={}ms, total={}ms",
                    toMs(tPdf - t0), toMs(tPdf - t0));
        } else {
            String html = htmlRenderer.render(document);
            long tHtml = System.nanoTime();
            pdf = pdfGeneratorService.generatePdf(html, document);
            long tPdf = System.nanoTime();

            logger.info("PDF export timings (backend): htmlRender={}ms, pdfPipeline={}ms, total={}ms",
                    toMs(tHtml - t0), toMs(tPdf - tHtml), toMs(tPdf - t0));
        }
        return new ExportResult(pdf, MediaType.APPLICATION_PDF, "pdf");
    }

    private static long toMs(long nanos) {
        return Math.round(nanos / 1_000_000d);
    }
}


