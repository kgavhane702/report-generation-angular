package com.org.report_generator.service;

import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Page.PdfOptions;
import com.microsoft.playwright.options.Margin;
import com.microsoft.playwright.options.WaitUntilState;
import com.org.report_generator.exception.PdfGenerationException;
import com.org.report_generator.model.document.DocumentModel;
import com.org.report_generator.model.document.PageSize;
import com.org.report_generator.model.document.Section;
import com.org.report_generator.model.document.Subsection;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

@Service
public class PdfGeneratorService {

    private static final double DEFAULT_WIDTH_MM = 254d;
    private static final double DEFAULT_HEIGHT_MM = 190.5d;
    private static final int DEFAULT_DPI = 96;

    private final Browser browser;

    public PdfGeneratorService(Browser browser) {
        this.browser = browser;
    }

    public byte[] generatePdf(String html, DocumentModel document) {
        BrowserContext context = null;
        try {
            Viewport viewport = calculateViewport(document);

            Browser.NewContextOptions contextOptions = new Browser.NewContextOptions()
                    .setViewportSize(viewport.width(), viewport.height())
                    .setDeviceScaleFactor(1.0);

            context = browser.newContext(contextOptions);

            Page page = context.newPage();
            page.setContent(html, new Page.SetContentOptions()
                    .setWaitUntil(WaitUntilState.NETWORKIDLE)
                    .setTimeout(30_000));

            PdfOptions options = new PdfOptions()
                    .setFormat("A4")
                    .setPrintBackground(true)
                    .setPreferCSSPageSize(true)
                    .setMargin(new Margin().setTop("0mm").setRight("0mm").setBottom("0mm").setLeft("0mm"));

            return page.pdf(options);
        } catch (RuntimeException ex) {
            throw new PdfGenerationException("Failed to generate PDF", ex);
        } finally {
            if (context != null) {
                context.close();
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

    private double mmToPx(double mm, int dpi) {
        return (mm / 25.4d) * dpi;
    }

    private record Viewport(int width, int height) {
    }
}

