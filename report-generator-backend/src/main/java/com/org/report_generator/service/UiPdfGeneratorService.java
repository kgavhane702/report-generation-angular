package com.org.report_generator.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Page.PdfOptions;
import com.microsoft.playwright.options.Margin;
import com.microsoft.playwright.options.WaitUntilState;
import com.org.report_generator.config.PdfExportProperties;
import com.org.report_generator.exception.PdfGenerationException;
import com.org.report_generator.exception.PdfGenerationTimeoutException;
import com.org.report_generator.model.document.DocumentModel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.net.URI;

@Service
public class UiPdfGeneratorService {

    private static final Logger logger = LoggerFactory.getLogger(UiPdfGeneratorService.class);

    private final BrowserContextPool contextPool;
    private final PdfExportProperties props;
    private final ObjectMapper objectMapper;

    public UiPdfGeneratorService(BrowserContextPool contextPool, PdfExportProperties props, ObjectMapper objectMapper) {
        this.contextPool = contextPool;
        this.props = props;
        this.objectMapper = objectMapper;
    }

    public byte[] generatePdfFromUi(DocumentModel document) {
        long startTimeMs = System.currentTimeMillis();
        BrowserContext context = null;
        Page page = null;

        try {
            context = contextPool.acquire();
            page = context.newPage();

            injectDocument(page, document);

            String targetUrl = buildExportUrl();

            page.navigate(targetUrl, new Page.NavigateOptions()
                    .setWaitUntil(WaitUntilState.DOMCONTENTLOADED)
                    .setTimeout(props.getUiNavigationTimeoutMs()));

            waitForExportReady(page);

            PdfOptions options = new PdfOptions()
                    .setPrintBackground(true)
                    .setPreferCSSPageSize(true)
                    .setMargin(new Margin().setTop("0mm").setRight("0mm").setBottom("0mm").setLeft("0mm"));

            byte[] pdfBytes = page.pdf(options);
            long durationMs = System.currentTimeMillis() - startTimeMs;
            logger.info("UI-rendered PDF generated successfully in {}ms", durationMs);
            return pdfBytes;
        } catch (RuntimeException ex) {
            long durationMs = System.currentTimeMillis() - startTimeMs;
            logger.error("Failed to generate UI-rendered PDF after {}ms", durationMs, ex);
            throw new PdfGenerationException("Failed to generate UI-rendered PDF", ex);
        } finally {
            if (page != null) {
                try {
                    page.close();
                } catch (Exception e) {
                    logger.warn("Error closing page", e);
                }
            }
            if (context != null) {
                contextPool.release(context);
            }
        }
    }

    private void injectDocument(Page page, DocumentModel document) {
        try {
            String json = objectMapper.writeValueAsString(document);
            // Double-encode as JSON string literal so we can safely JSON.parse() in JS.
            String jsonLiteral = objectMapper.writeValueAsString(json);

            String script = "window.__RG_EXPORT_DOC__ = JSON.parse(" + jsonLiteral + ");";
            page.addInitScript(script);
        } catch (Exception e) {
            throw new PdfGenerationException("Failed to serialize document for UI export", e);
        }
    }

    private String buildExportUrl() {
        String base = props.getUiBaseUrl();
        String path = props.getUiExportPath();
        if (base == null || base.isBlank()) {
            throw new PdfGenerationException("export.pdf.uiBaseUrl is not configured");
        }
        if (path == null || path.isBlank()) {
            path = "/export";
        }

        URI baseUri = URI.create(base);
        URI resolved = baseUri.resolve(path.startsWith("/") ? path : "/" + path);
        return resolved.toString();
    }

    private void waitForExportReady(Page page) {
        try {
            page.waitForFunction(
                    "() => window.__RG_EXPORT_READY__ === true",
                    null,
                    new Page.WaitForFunctionOptions().setTimeout(props.getUiReadyTimeoutMs()));
        } catch (com.microsoft.playwright.TimeoutError e) {
            // Try to extract a more helpful UI-side error message.
            String uiError = null;
            try {
                Object v = page.evaluate("() => window.__RG_EXPORT_ERROR__ || null");
                uiError = v == null ? null : String.valueOf(v);
            } catch (Exception ignored) {
            }

            String msg = "UI export route did not become ready within " + props.getUiReadyTimeoutMs() + "ms";
            if (uiError != null && !uiError.isBlank()) {
                msg += ": " + uiError;
            }
            throw new PdfGenerationTimeoutException(msg, e);
        }
    }
}
