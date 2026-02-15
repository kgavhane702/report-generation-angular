package com.org.report_generator.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.MissingNode;
import com.org.report_generator.model.document.DocumentModel;
import com.org.report_generator.model.document.HeaderConfig;
import com.org.report_generator.model.document.FooterConfig;
import com.org.report_generator.model.document.LogoConfig;
import com.org.report_generator.model.document.Page;
import com.org.report_generator.model.document.PageSize;
import com.org.report_generator.model.document.Section;
import com.org.report_generator.model.document.Subsection;
import com.org.report_generator.model.document.Widget;
import com.org.report_generator.model.document.WidgetPosition;
import com.org.report_generator.model.document.WidgetSize;
import com.org.report_generator.render.widgets.RenderContext;
import com.org.report_generator.render.widgets.WidgetRendererRegistry;
import com.org.report_generator.service.renderer.GlobalStylesRenderer;
import com.org.report_generator.service.renderer.PageStylesRenderer;
import com.org.report_generator.service.renderer.ImageWidgetRenderer;
import com.org.report_generator.service.renderer.TableWidgetRenderer;
import com.org.report_generator.service.renderer.EditastraWidgetRenderer;
import com.org.report_generator.service.renderer.SlideThemeStyleResolver;
import com.org.report_generator.config.ExportPerformanceProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.IdentityHashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.ThreadPoolExecutor;

@Service
public class DocumentRenderService {

    private static final Logger logger = LoggerFactory.getLogger(DocumentRenderService.class);
    private static final double DEFAULT_WIDTH_MM = 254d;
    private static final double DEFAULT_HEIGHT_MM = 190.5d;
    private static final int DEFAULT_DPI = 96;
    private static final int WIDGET_Z_INDEX_BASE = 2000;
    
    private final WidgetRendererRegistry widgetRenderers;
    private final ExportPerformanceProperties perf;
    private final ExecutorService htmlRenderExecutor;
    private final SlideThemeStyleResolver slideThemeStyleResolver;

    public DocumentRenderService(
            WidgetRendererRegistry widgetRenderers,
            ExportPerformanceProperties perf,
            ExecutorService htmlRenderExecutor,
            SlideThemeStyleResolver slideThemeStyleResolver
    ) {
        this.widgetRenderers = widgetRenderers;
        this.perf = perf;
        this.htmlRenderExecutor = htmlRenderExecutor;
        this.slideThemeStyleResolver = slideThemeStyleResolver;
    }
    
    // Cache for mmToPx calculations to avoid repeated computations
    // Key format: "mm_dpi" (e.g., "254.0_96")
    private static final ConcurrentMap<String, Double> mmToPxCache = new ConcurrentHashMap<>(256);

    public String render(DocumentModel document) {
        long startTime = System.currentTimeMillis();
        List<Page> pages = collectPages(document);
        logger.debug("Rendering document with {} pages", pages.size());
        
        // Estimate capacity: base HTML (~200) + CSS (~50KB) + pages (estimate 5KB per page + widgets)
        // For typical documents: 10-50 pages, 5-20 widgets per page
        int estimatedCapacity = 200 + 50_000 + (pages.size() * 5_000);
        StringBuilder html = new StringBuilder(estimatedCapacity);

        html.append("<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">");
        html.append("<title>").append(Optional.ofNullable(document.getTitle()).orElse("Document")).append("</title>");
        html.append("<style>")
                .append(GlobalStylesRenderer.getCss())
                .append(ImageWidgetRenderer.getCss())
                .append(TableWidgetRenderer.getCss())
                .append(EditastraWidgetRenderer.getCss())
                .append(PageStylesRenderer.getCss(pages, document))
                .append("</style></head><body><div class=\"document-container\">");

        if (pages.size() >= Math.max(1, perf.getParallelThresholdPages())) {
            // Parallel page rendering (bounded executor) to speed up huge docs (e.g., 500 pages)
            // while preserving output order deterministically.
            long t0 = System.nanoTime();
            @SuppressWarnings("unchecked")
            CompletableFuture<String>[] futures = new CompletableFuture[pages.size()];
            for (int i = 0; i < pages.size(); i++) {
                final int idx = i;
                futures[i] = CompletableFuture.supplyAsync(() -> renderPage(pages.get(idx), document), htmlRenderExecutor);
            }
            for (CompletableFuture<String> f : futures) {
                html.append(f.join());
            }
            long t1 = System.nanoTime();
            logger.info("Rendered {} pages in parallel (threshold={}, threads={}), pageHtml={}ms",
                    pages.size(),
                    perf.getParallelThresholdPages(),
                    getExecutorThreads(htmlRenderExecutor),
                    Math.round((t1 - t0) / 1_000_000d));
        } else {
            for (Page page : pages) {
                html.append(renderPage(page, document));
            }
        }

        html.append("</div></body></html>");
        long duration = System.currentTimeMillis() - startTime;
        logger.info("Document rendered in {}ms: {} pages, HTML size: {} bytes", 
            duration, pages.size(), html.length());
        return html.toString();
    }

    private int getExecutorThreads(ExecutorService executor) {
        try {
            if (executor instanceof ThreadPoolExecutor tpe) {
                return tpe.getMaximumPoolSize();
            }
        } catch (Exception ignored) {
        }
        // Fallback: unknown executor implementation
        return -1;
    }

    private List<Page> collectPages(DocumentModel document) {
        List<Page> flattened = new ArrayList<>();
        if (document.getSections() == null) {
            return flattened;
        }

        int pageNumber = 1;
        for (Section section : document.getSections()) {
            if (section == null || section.getSubsections() == null) {
                continue;
            }
            for (Subsection subsection : section.getSubsections()) {
                if (subsection == null || subsection.getPages() == null) {
                    continue;
                }
                for (Page page : subsection.getPages()) {
                    page.setNumber(pageNumber++);
                    flattened.add(page);
                }
            }
        }
        return flattened;
    }

    private String renderPage(Page page, DocumentModel document) {
        PageSize pageSize = Optional.ofNullable(document.getPageSize()).orElse(new PageSize());
        double baseWidth = Optional.ofNullable(pageSize.getWidthMm()).orElse(DEFAULT_WIDTH_MM);
        double baseHeight = Optional.ofNullable(pageSize.getHeightMm()).orElse(DEFAULT_HEIGHT_MM);
        int dpi = Optional.ofNullable(pageSize.getDpi()).orElse(DEFAULT_DPI);

        String orientation = Optional.ofNullable(page.getOrientation()).orElse("landscape").toLowerCase(Locale.ROOT);
        double pageWidth = orientation.equals("portrait") ? Math.min(baseWidth, baseHeight) : Math.max(baseWidth, baseHeight);
        double pageHeight = orientation.equals("portrait") ? Math.max(baseWidth, baseHeight) : Math.min(baseWidth, baseHeight);

        double widthPx = mmToPx(pageWidth, dpi);
        double heightPx = mmToPx(pageHeight, dpi);

        String pageName = "page-" + Optional.ofNullable(page.getId()).orElse(UUID.randomUUID().toString());
        String pageSurfaceClasses = "page__surface " + slideThemeStyleResolver.buildSurfaceClasses(document, page);
        String pageThemeLayerClasses = "page__theme-layer " + slideThemeStyleResolver.buildSurfaceClasses(document, page);
        String pageSurfaceStyle = "width: " + widthPx + "px; height: " + heightPx + "px;"
            + slideThemeStyleResolver.buildSurfaceStyle(document, page);

        // Estimate capacity: page HTML (~300) + widgets (estimate 500 per widget) + footer (~200)
        int widgetCount = page.getWidgets() != null ? page.getWidgets().size() : 0;
        int estimatedCapacity = 300 + (widgetCount * 500) + 200;
        StringBuilder builder = new StringBuilder(estimatedCapacity);
        builder.append("<div class=\"page\" style=\"width: ")
            .append(widthPx)
            .append("px; height: ")
            .append(heightPx)
            .append("px; page-break-after: always; page: ")
            .append(pageName)
            .append(";\"><div class=\"")
            .append(pageSurfaceClasses)
            .append("\" style=\"")
            .append(escapeHtmlAttribute(pageSurfaceStyle))
            .append("\">")
            .append("<div class=\"")
            .append(pageThemeLayerClasses)
            .append("\"></div>");

        builder.append(renderHeader(document, page));

        List<Widget> widgetsForRender = orderWidgetsForRender(page.getWidgets());
        if (!widgetsForRender.isEmpty()) {
            for (Widget widget : widgetsForRender) {
                builder.append(renderWidget(widget, document, page));
            }
        }

        builder.append(renderFooter(document, page, widthPx, heightPx));

        builder.append("</div></div>");
        return builder.toString();
    }

    /**
     * Render widgets in stacking order (low z-index to high z-index).
     *
     * This keeps backend HTML/PDF output consistent with editor layering operations
     * like "Bring to front" / "Send to back".
     */
    private List<Widget> orderWidgetsForRender(List<Widget> widgets) {
        if (widgets == null || widgets.isEmpty()) {
            return List.of();
        }

        List<Widget> ordered = widgets.stream()
                .filter(w -> w != null)
                .collect(java.util.stream.Collectors.toCollection(ArrayList::new));

        if (ordered.size() <= 1) {
            return ordered;
        }

        boolean hasAnyZIndex = ordered.stream().anyMatch(w -> w.getZIndex() != null);
        if (!hasAnyZIndex) {
            // Legacy documents without zIndex should keep source order.
            return ordered;
        }

        Map<Widget, Integer> originalOrder = new IdentityHashMap<>();
        for (int i = 0; i < ordered.size(); i++) {
            originalOrder.put(ordered.get(i), i);
        }

        ordered.sort(
                Comparator
                .comparingInt((Widget w) -> Optional.ofNullable(w.getZIndex()).orElse(1))
                        .thenComparingInt(w -> originalOrder.getOrDefault(w, 0))
        );

        return ordered;
    }

    private String renderWidget(Widget widget, DocumentModel document, Page page) {
        if (widget == null) {
            return "";
        }
        String type = Optional.ofNullable(widget.getType()).orElse("").toLowerCase(Locale.ROOT);

        if (logger.isDebugEnabled()) {
            // Debug-only trace to compare UI vs PDF positions/sizes.
            WidgetSize debugSize = widget.getSize();
            WidgetPosition debugPos = widget.getPosition();
            logger.debug("Widget: type={}, id={}, x={}, y={}, width={}, height={}",
                type,
                widget.getId(),
                debugPos != null ? debugPos.getX() : "null",
                debugPos != null ? debugPos.getY() : "null",
                debugSize != null ? debugSize.getWidth() : "null",
                debugSize != null ? debugSize.getHeight() : "null");
        }
        
        String style = buildWidgetStyle(widget);
        JsonNode props = widget.getProps();
        return widgetRenderers.render(type, props, style, new RenderContext(document, page));
    }

    private String buildWidgetStyle(Widget widget) {
        StringBuilder style = new StringBuilder("position: absolute;");

        WidgetPosition position = Optional.ofNullable(widget.getPosition()).orElse(new WidgetPosition());
        WidgetSize size = Optional.ofNullable(widget.getSize()).orElse(new WidgetSize());

        style.append("left: ").append(Optional.ofNullable(position.getX()).orElse(0d)).append("px;");
        style.append("top: ").append(Optional.ofNullable(position.getY()).orElse(0d)).append("px;");
        style.append("width: ").append(Optional.ofNullable(size.getWidth()).orElse(0d)).append("px;");
        style.append("height: ").append(Optional.ofNullable(size.getHeight()).orElse(0d)).append("px;");

        // Match frontend stacking order exactly:
        // WidgetContainer uses base 2000 + (widget.zIndex ?? 1)
        int effectiveZ = WIDGET_Z_INDEX_BASE + Optional.ofNullable(widget.getZIndex()).orElse(1);
        style.append("z-index: ").append(effectiveZ).append(";");

        // Optional rotation (degrees). Use center origin to match frontend behavior.
        if (widget.getRotation() != null && Double.isFinite(widget.getRotation()) && Math.abs(widget.getRotation()) > 0.00001d) {
            style.append("transform-origin: center center;");
            style.append("transform: rotate(").append(widget.getRotation()).append("deg);");
        }

        JsonNode styleNode = widget.getStyle();
        if (styleNode != null && styleNode.isObject()) {
            Iterator<String> fields = styleNode.fieldNames();
            while (fields.hasNext()) {
                String key = fields.next();
                // Do not allow custom style payload to override computed geometry/stacking.
                if (isReservedWidgetLayoutStyleKey(key)) {
                    continue;
                }
                JsonNode value = styleNode.get(key);
                if (value != null && !value.isNull()) {
                    style.append(camelToKebab(key)).append(": ").append(formatCssValue(key, value)).append(";");
                }
            }
        }
        return style.toString();
    }

    /**
     * Frontend style objects can contain numbers for some properties.
     * CSS needs units for a few of them; keep others unitless.
     */
    private String formatCssValue(String styleKey, JsonNode valueNode) {
        if (valueNode == null || valueNode.isNull()) {
            return "";
        }
        if (!valueNode.isNumber()) {
            return valueNode.asText();
        }

        String key = styleKey == null ? "" : styleKey;
        double v = valueNode.asDouble();

        // Unitless by default (safe for opacity, lineHeight, fontWeight).
        boolean needsPx =
                key.equals("borderRadius") ||
                key.equals("fontSize") ||
                key.equals("letterSpacing");

        if (needsPx) {
            // Preserve integer-ish values as integers to avoid "12.0px"
            long asLong = (long) v;
            if (Math.abs(v - asLong) < 0.0000001d) {
                return asLong + "px";
            }
            return v + "px";
        }

        long asLong = (long) v;
        if (Math.abs(v - asLong) < 0.0000001d) {
            return Long.toString(asLong);
        }
        return Double.toString(v);
    }

    private boolean isReservedWidgetLayoutStyleKey(String key) {
        if (key == null) return false;
        String k = key.trim().toLowerCase(Locale.ROOT);
        return k.equals("left")
                || k.equals("top")
                || k.equals("width")
                || k.equals("height")
                || k.equals("position")
                || k.equals("zindex")
                || k.equals("z-index")
                || k.equals("transform")
                || k.equals("transform-origin")
                || k.equals("transformorigin");
    }



    // Chart rendering is handled by WidgetRendererRegistry (ChartWidgetHtmlRenderer).

    /**
     * Converts millimeters to pixels using the given DPI.
     * Results are memoized to avoid repeated calculations for common values.
     */
    private double mmToPx(double mm, int dpi) {
        // Round mm to 2 decimal places for cache key to avoid floating point precision issues
        String key = String.format(Locale.ROOT, "%.2f_%d", mm, dpi);
        // Match frontend behavior (see page-dimensions.util.ts): use integer pixel rounding.
        return mmToPxCache.computeIfAbsent(key, k -> (double) Math.round((mm / 25.4d) * dpi));
    }

    private String camelToKebab(String input) {
        if (input == null) {
            return "";
        }
        return input.replaceAll("([a-z])([A-Z]+)", "$1-$2").toLowerCase(Locale.ROOT);
    }

    private String escapeHtml(String input) {
        if (input == null) {
            return "";
        }
        return input.replace("&", "&amp;")
                    .replace("<", "&lt;")
                    .replace(">", "&gt;")
                    .replace("\"", "&quot;")
                    .replace("'", "&#39;");
    }

    private String escapeHtmlAttribute(String input) {
        // Same escaping rules work for attributes and are sufficient to prevent quote-breaking.
        return escapeHtml(input);
    }

    private String renderHeader(DocumentModel document, Page page) {
        HeaderConfig header = document.getHeader();
        LogoConfig logo = document.getLogo();

        boolean hasLogoTop = logo != null
                && logo.getUrl() != null
                && !logo.getUrl().isBlank()
                && ("top-left".equalsIgnoreCase(logo.getPosition()) || "top-right".equalsIgnoreCase(logo.getPosition()));

        boolean hasContent = header != null && (
                (header.getLeftText() != null && !header.getLeftText().isBlank()) ||
                (header.getCenterText() != null && !header.getCenterText().isBlank()) ||
                (header.getRightText() != null && !header.getRightText().isBlank()) ||
                (header.getLeftImage() != null && !header.getLeftImage().isBlank()) ||
                (header.getCenterImage() != null && !header.getCenterImage().isBlank()) ||
                (header.getRightImage() != null && !header.getRightImage().isBlank()) ||
                (header.getShowPageNumber() != null && header.getShowPageNumber())
        );

        if (!hasContent && !hasLogoTop) {
            return "";
        }

        // Per-position text colors (fallback to global, then to black)
        String leftColor = header != null ? header.getEffectiveLeftTextColor() : "#000000";
        String centerColor = header != null ? header.getEffectiveCenterTextColor() : "#000000";
        String rightColor = header != null ? header.getEffectiveRightTextColor() : "#000000";

        StringBuilder sb = new StringBuilder();
        sb.append("<div class=\"page__header\">");

        // Left
        sb.append("<div class=\"page__header-left\">");
        if (hasLogoTop && "top-left".equalsIgnoreCase(logo.getPosition())) {
            sb.append(renderLogoImg(logo));
        }
        if (header != null) {
            if (header.getLeftImage() != null && !header.getLeftImage().isBlank()) {
                sb.append("<img src=\"").append(escapeHtmlAttribute(header.getLeftImage())).append("\" alt=\"Header left\" class=\"page__header-image\" />");
            }
            if (header.getLeftText() != null && !header.getLeftText().isBlank()) {
                sb.append("<span style=\"color: ").append(escapeHtmlAttribute(leftColor)).append(";\">").append(escapeHtml(header.getLeftText())).append("</span>");
            }
        }
        sb.append("</div>");

        // Center
        sb.append("<div class=\"page__header-center\">");
        if (header != null) {
            if (header.getCenterImage() != null && !header.getCenterImage().isBlank()) {
                sb.append("<img src=\"").append(escapeHtmlAttribute(header.getCenterImage())).append("\" alt=\"Header center\" class=\"page__header-image\" />");
            }
            if (header.getCenterText() != null && !header.getCenterText().isBlank()) {
                sb.append("<span style=\"color: ").append(escapeHtmlAttribute(centerColor)).append(";\">").append(escapeHtml(header.getCenterText())).append("</span>");
            }
        }
        sb.append("</div>");

        // Right
        sb.append("<div class=\"page__header-right\">");
        if (hasLogoTop && "top-right".equalsIgnoreCase(logo.getPosition())) {
            sb.append(renderLogoImg(logo));
        }
        if (header != null) {
            if (header.getRightImage() != null && !header.getRightImage().isBlank()) {
                sb.append("<img src=\"").append(escapeHtmlAttribute(header.getRightImage())).append("\" alt=\"Header right\" class=\"page__header-image\" />");
            }
            if (header.getRightText() != null && !header.getRightText().isBlank()) {
                sb.append("<span style=\"color: ").append(escapeHtmlAttribute(rightColor)).append(";\">").append(escapeHtml(header.getRightText())).append("</span>");
            }
            // Always show page number if enabled, regardless of other content in right section
            if (header.getShowPageNumber() != null && header.getShowPageNumber() && page.getNumber() != null) {
                String formatted = formatPageNumber(page.getNumber(), header.getPageNumberFormat());
                sb.append("<span style=\"color: ").append(escapeHtmlAttribute(rightColor)).append(";\">").append(escapeHtml(formatted)).append("</span>");
            }
        }
        sb.append("</div>");

        sb.append("</div>");
        return sb.toString();
    }

    private String formatPageNumber(int pageNumber, String format) {
        String f = format == null ? "arabic" : format.toLowerCase(Locale.ROOT);
        return switch (f) {
            case "roman" -> toRoman(pageNumber).toLowerCase(Locale.ROOT);
            case "alphabetic" -> toAlphabetic(pageNumber).toLowerCase(Locale.ROOT);
            default -> Integer.toString(pageNumber);
        };
    }

    private String toRoman(int number) {
        if (number <= 0) return "";
        int[] values = {1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1};
        String[] numerals = {"M", "CM", "D", "CD", "C", "XC", "L", "XL", "X", "IX", "V", "IV", "I"};
        StringBuilder sb = new StringBuilder();
        int n = number;
        for (int i = 0; i < values.length; i++) {
            while (n >= values[i]) {
                sb.append(numerals[i]);
                n -= values[i];
            }
        }
        return sb.toString();
    }

    private String toAlphabetic(int number) {
        if (number <= 0) return "";
        StringBuilder sb = new StringBuilder();
        int n = number;
        while (n > 0) {
            n--; // 1 -> a
            char c = (char) ('A' + (n % 26));
            sb.insert(0, c);
            n /= 26;
        }
        return sb.toString();
    }

    private String renderFooter(DocumentModel document, Page page, double pageWidth, double pageHeight) {
        FooterConfig footer = document.getFooter();
        LogoConfig logo = document.getLogo();
        if (footer == null && (logo == null || logo.getUrl() == null || logo.getUrl().isBlank())) {
            return "";
        }

        boolean hasLogoBottom = logo != null
                && logo.getUrl() != null
                && !logo.getUrl().isBlank()
                && ("bottom-left".equalsIgnoreCase(logo.getPosition()) || "bottom-right".equalsIgnoreCase(logo.getPosition()));

        boolean hasContent = footer != null && (
                (footer.getLeftText() != null && !footer.getLeftText().isBlank()) ||
                (footer.getCenterText() != null && !footer.getCenterText().isBlank()) ||
                (footer.getCenterSubText() != null && !footer.getCenterSubText().isBlank()) ||
                (footer.getLeftImage() != null && !footer.getLeftImage().isBlank()) ||
                (footer.getCenterImage() != null && !footer.getCenterImage().isBlank()) ||
                (footer.getRightImage() != null && !footer.getRightImage().isBlank()) ||
                (footer.getShowPageNumber() != null && footer.getShowPageNumber())
        );

        if (!hasContent && !hasLogoBottom) {
            return "";
        }

        // Per-position text colors (fallback to global, then to black)
        String leftColor = footer != null ? footer.getEffectiveLeftTextColor() : "#000000";
        String centerColor = footer != null ? footer.getEffectiveCenterTextColor() : "#000000";
        String rightColor = footer != null ? footer.getEffectiveRightTextColor() : "#000000";

        StringBuilder footerHtml = new StringBuilder();
        footerHtml.append("<div class=\"page__footer\">");

        footerHtml.append("<div class=\"page__footer-left\">");
        if (hasLogoBottom && "bottom-left".equalsIgnoreCase(logo.getPosition())) {
            footerHtml.append(renderLogoImg(logo));
        }
        if (footer != null) {
            if (footer.getLeftImage() != null && !footer.getLeftImage().isBlank()) {
                footerHtml.append("<img src=\"").append(escapeHtmlAttribute(footer.getLeftImage())).append("\" alt=\"Footer left\" class=\"page__footer-image\" />");
            }
            if (footer.getLeftText() != null && !footer.getLeftText().isBlank()) {
                footerHtml.append("<span style=\"color: ").append(escapeHtmlAttribute(leftColor)).append(";\">").append(escapeHtml(footer.getLeftText())).append("</span>");
            }
        }
        footerHtml.append("</div>");

        footerHtml.append("<div class=\"page__footer-center\">");
        if (footer != null) {
            if (footer.getCenterImage() != null && !footer.getCenterImage().isBlank()) {
                footerHtml.append("<img src=\"").append(escapeHtmlAttribute(footer.getCenterImage())).append("\" alt=\"Footer center\" class=\"page__footer-image\" />");
            }
            if (footer.getCenterText() != null && !footer.getCenterText().isBlank()) {
                footerHtml.append("<div class=\"page__footer-center-line\" style=\"color: ").append(escapeHtmlAttribute(centerColor)).append(";\">")
                        .append(escapeHtml(footer.getCenterText())).append("</div>");
            }
            if (footer.getCenterSubText() != null && !footer.getCenterSubText().isBlank()) {
                footerHtml.append("<div class=\"page__footer-center-line\" style=\"color: ").append(escapeHtmlAttribute(centerColor)).append(";\">")
                        .append(escapeHtml(footer.getCenterSubText())).append("</div>");
            }
        }
        footerHtml.append("</div>");

        footerHtml.append("<div class=\"page__footer-right\">");
        if (hasLogoBottom && "bottom-right".equalsIgnoreCase(logo.getPosition())) {
            footerHtml.append(renderLogoImg(logo));
        }
        if (footer != null) {
            if (footer.getRightImage() != null && !footer.getRightImage().isBlank()) {
                footerHtml.append("<img src=\"").append(escapeHtmlAttribute(footer.getRightImage())).append("\" alt=\"Footer right\" class=\"page__footer-image\" />");
            }
            if (footer.getShowPageNumber() != null && footer.getShowPageNumber() && page.getNumber() != null) {
                String formatted = formatPageNumber(page.getNumber(), footer.getPageNumberFormat());
                footerHtml.append("<span style=\"color: ").append(escapeHtmlAttribute(rightColor)).append(";\">").append(escapeHtml(formatted)).append("</span>");
            }
        }
        footerHtml.append("</div>");

        footerHtml.append("</div>");
        return footerHtml.toString();
    }

    private String renderLogoImg(LogoConfig logo) {
        if (logo == null || logo.getUrl() == null || logo.getUrl().isBlank()) {
            return "";
        }
        StringBuilder style = new StringBuilder();
        if (logo.getMaxWidthPx() != null && logo.getMaxWidthPx() > 0) {
            style.append("max-width: ").append(logo.getMaxWidthPx()).append("px;");
        }
        if (logo.getMaxHeightPx() != null && logo.getMaxHeightPx() > 0) {
            style.append("max-height: ").append(logo.getMaxHeightPx()).append("px;");
        }
        String styleAttr = style.length() > 0 ? " style=\"" + escapeHtmlAttribute(style.toString()) + "\"" : "";
        return "<img src=\"" + escapeHtmlAttribute(logo.getUrl()) + "\" alt=\"Logo\" class=\"page__logo-image page__logo-image--inline\"" + styleAttr + " />";
    }
}

