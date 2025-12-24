package com.org.report_generator.service;

import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Page.PdfOptions;
import com.microsoft.playwright.options.Margin;
import com.microsoft.playwright.options.WaitUntilState;
import com.org.report_generator.exception.PdfGenerationException;
import com.org.report_generator.exception.PdfGenerationTimeoutException;
import com.org.report_generator.model.document.DocumentModel;
import com.org.report_generator.model.document.PageSize;
import com.org.report_generator.model.document.Section;
import com.org.report_generator.model.document.Subsection;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Service
public class PdfGeneratorService {

    private static final Logger logger = LoggerFactory.getLogger(PdfGeneratorService.class);
    private static final double DEFAULT_WIDTH_MM = 254d;
    private static final double DEFAULT_HEIGHT_MM = 190.5d;
    private static final int DEFAULT_DPI = 96;

    private final Browser browser;
    private final BrowserContextPool contextPool;
    
    // Cache for mmToPx calculations to avoid repeated computations
    // Key format: "mm_dpi" (e.g., "254.0_96")
    private static final ConcurrentMap<String, Double> mmToPxCache = new ConcurrentHashMap<>(256);

    public PdfGeneratorService(Browser browser, BrowserContextPool contextPool) {
        this.browser = browser;
        this.contextPool = contextPool;
    }

    public byte[] generatePdf(String html, DocumentModel document) {
        long startTime = System.currentTimeMillis();
        BrowserContext context = null;
        Page page = null;
        
        try {
            Viewport viewport = calculateViewport(document);

            // Acquire context from pool instead of creating new one
            context = contextPool.acquire();
            
            // Note: Playwright doesn't support changing viewport after context creation.
            // Pooled contexts have a default viewport, but we rely on CSS page size
            // (@page rules) to set the actual PDF page dimensions, so viewport size
            // doesn't matter for PDF generation.
            logger.debug("Using pooled context for PDF generation with calculated viewport: {}x{}", 
                viewport.width(), viewport.height());

            page = context.newPage();
            page.setContent(html, new Page.SetContentOptions()
                    // Faster than NETWORKIDLE; we explicitly wait for fonts/images below for layout stability.
                    .setWaitUntil(WaitUntilState.DOMCONTENTLOADED)
                    .setTimeout(30_000));
            
            // Combined wait for fonts and images to reduce total wait time
            try {
                page.waitForFunction(
                        "() => (document.fonts ? document.fonts.status === 'loaded' : true) && " +
                              "Array.from(document.images || []).every(img => img.complete)",
                        null,
                        new Page.WaitForFunctionOptions().setTimeout(30_000));
            } catch (com.microsoft.playwright.TimeoutError e) {
                throw new PdfGenerationTimeoutException("PDF generation timed out waiting for fonts/images to load", e);
            }

            PdfOptions options = new PdfOptions()
                    .setFormat("A4")
                    .setPrintBackground(true)
                    .setPreferCSSPageSize(true)
                    .setMargin(new Margin().setTop("0mm").setRight("0mm").setBottom("0mm").setLeft("0mm"));

            byte[] pdfBytes = page.pdf(options);
            long duration = System.currentTimeMillis() - startTime;
            logger.info("PDF generated successfully in {}ms", duration);
            return pdfBytes;
        } catch (RuntimeException ex) {
            long duration = System.currentTimeMillis() - startTime;
            logger.error("Failed to generate PDF after {}ms", duration, ex);
            throw new PdfGenerationException("Failed to generate PDF", ex);
        } finally {
            if (page != null) {
                try {
                    page.close();
                } catch (Exception e) {
                    logger.warn("Error closing page", e);
                }
            }
            // Return context to pool instead of closing
            if (context != null) {
                contextPool.release(context);
            }
        }
    }

    private Viewport calculateViewport(DocumentModel document) {
        PageSize pageSize = Optional.ofNullable(document.getPageSize()).orElse(new PageSize());
        double baseWidth = Optional.ofNullable(pageSize.getWidthMm()).orElse(DEFAULT_WIDTH_MM);
        double baseHeight = Optional.ofNullable(pageSize.getHeightMm()).orElse(DEFAULT_HEIGHT_MM);
        int dpi = Optional.ofNullable(pageSize.getDpi()).orElse(DEFAULT_DPI);

        double maxWidth = baseWidth;
        double maxHeight = baseHeight;

        for (com.org.report_generator.model.document.Page page : collectPages(document)) {
            String orientation = Optional.ofNullable(page.getOrientation()).orElse("landscape").toLowerCase(Locale.ROOT);
            double pageWidth = orientation.equals("portrait") ? Math.min(baseWidth, baseHeight) : Math.max(baseWidth, baseHeight);
            double pageHeight = orientation.equals("portrait") ? Math.max(baseWidth, baseHeight) : Math.min(baseWidth, baseHeight);
            maxWidth = Math.max(maxWidth, pageWidth);
            maxHeight = Math.max(maxHeight, pageHeight);
        }

        int widthPx = (int) Math.round(mmToPx(maxWidth, dpi));
        int heightPx = (int) Math.round(mmToPx(maxHeight, dpi));
        return new Viewport(widthPx, heightPx);
    }

    private List<com.org.report_generator.model.document.Page> collectPages(DocumentModel document) {
        List<com.org.report_generator.model.document.Page> flattened = new ArrayList<>();
        if (document.getSections() == null) {
            return flattened;
        }
        for (Section section : document.getSections()) {
            if (section == null || section.getSubsections() == null) {
                continue;
            }
            for (Subsection subsection : section.getSubsections()) {
                if (subsection == null || subsection.getPages() == null) {
                    continue;
                }
                flattened.addAll(subsection.getPages());
            }
        }
        return flattened;
    }

    /**
     * Converts millimeters to pixels using the given DPI.
     * Results are memoized to avoid repeated calculations for common values.
     */
    private double mmToPx(double mm, int dpi) {
        // Round mm to 2 decimal places for cache key to avoid floating point precision issues
        String key = String.format(Locale.ROOT, "%.2f_%d", mm, dpi);
        return mmToPxCache.computeIfAbsent(key, k -> (mm / 25.4d) * dpi);
    }

    private record Viewport(int width, int height) {
    }
}

