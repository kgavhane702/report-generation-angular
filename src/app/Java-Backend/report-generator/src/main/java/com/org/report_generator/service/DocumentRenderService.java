package com.org.report_generator.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.MissingNode;
import com.org.report_generator.model.document.DocumentModel;
import com.org.report_generator.model.document.FooterConfig;
import com.org.report_generator.model.document.LogoConfig;
import com.org.report_generator.model.document.Page;
import com.org.report_generator.model.document.PageSize;
import com.org.report_generator.model.document.Section;
import com.org.report_generator.model.document.Subsection;
import com.org.report_generator.model.document.Widget;
import com.org.report_generator.model.document.WidgetPosition;
import com.org.report_generator.model.document.WidgetSize;
import com.org.report_generator.service.renderer.GlobalStylesRenderer;
import com.org.report_generator.service.renderer.PageStylesRenderer;
import com.org.report_generator.service.renderer.TextWidgetRenderer;
import com.org.report_generator.service.renderer.ImageWidgetRenderer;
import com.org.report_generator.service.renderer.TableWidgetRenderer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Service
public class DocumentRenderService {

    private static final Logger logger = LoggerFactory.getLogger(DocumentRenderService.class);
    private static final double DEFAULT_WIDTH_MM = 254d;
    private static final double DEFAULT_HEIGHT_MM = 190.5d;
    private static final int DEFAULT_DPI = 96;
    
    private final TextWidgetRenderer textWidgetRenderer = new TextWidgetRenderer();
    private final ImageWidgetRenderer imageWidgetRenderer = new ImageWidgetRenderer();
    private final TableWidgetRenderer tableWidgetRenderer = new TableWidgetRenderer();
    
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
                .append(TextWidgetRenderer.getCss())
                .append(ImageWidgetRenderer.getCss())
                .append(TableWidgetRenderer.getCss())
                .append(PageStylesRenderer.getCss(pages, document))
                .append("</style></head><body><div class=\"document-container\">");

        for (Page page : pages) {
            html.append(renderPage(page, document));
        }

        html.append("</div></body></html>");
        long duration = System.currentTimeMillis() - startTime;
        logger.info("Document rendered in {}ms: {} pages, HTML size: {} bytes", 
            duration, pages.size(), html.length());
        return html.toString();
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
                .append(";\"><div class=\"page__surface\" style=\"width: ")
                .append(widthPx)
                .append("px; height: ")
                .append(heightPx)
                .append("px;\">");

        builder.append(renderLogo(document, widthPx, heightPx));

        if (page.getWidgets() != null) {
            for (Widget widget : page.getWidgets()) {
                builder.append(renderWidget(widget));
            }
        }

        builder.append(renderFooter(document, page, widthPx, heightPx));

        builder.append("</div></div>");
        return builder.toString();
    }

    private String renderWidget(Widget widget) {
        if (widget == null) {
            return "";
        }
        String type = Optional.ofNullable(widget.getType()).orElse("").toLowerCase(Locale.ROOT);
        String style = buildWidgetStyle(widget);
        JsonNode props = widget.getProps();

        return switch (type) {
            case "text" -> textWidgetRenderer.render(props, style);
            case "image" -> imageWidgetRenderer.render(props, style);
            case "chart" -> renderChartWidget(props, style);
            case "table", "table-widget", "tablewidget" -> tableWidgetRenderer.render(props, style);
            default -> "<div class=\"widget\" style=\"" + escapeHtmlAttribute(style) + "\"></div>";
        };
    }

    private String buildWidgetStyle(Widget widget) {
        StringBuilder style = new StringBuilder("position: absolute;");

        WidgetPosition position = Optional.ofNullable(widget.getPosition()).orElse(new WidgetPosition());
        WidgetSize size = Optional.ofNullable(widget.getSize()).orElse(new WidgetSize());

        style.append("left: ").append(Optional.ofNullable(position.getX()).orElse(0d)).append("px;");
        style.append("top: ").append(Optional.ofNullable(position.getY()).orElse(0d)).append("px;");
        style.append("width: ").append(Optional.ofNullable(size.getWidth()).orElse(0d)).append("px;");
        style.append("height: ").append(Optional.ofNullable(size.getHeight()).orElse(0d)).append("px;");

        // Match frontend stacking order.
        if (widget.getZIndex() != null) {
            style.append("z-index: ").append(widget.getZIndex()).append(";");
        }

        // Optional rotation (degrees). Keep origin at top-left to match absolute positioning expectations.
        if (widget.getRotation() != null && Double.isFinite(widget.getRotation()) && Math.abs(widget.getRotation()) > 0.00001d) {
            style.append("transform-origin: top left;");
            style.append("transform: rotate(").append(widget.getRotation()).append("deg);");
        }

        JsonNode styleNode = widget.getStyle();
        if (styleNode != null && styleNode.isObject()) {
            Iterator<String> fields = styleNode.fieldNames();
            while (fields.hasNext()) {
                String key = fields.next();
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



    private String renderChartWidget(JsonNode props, String style) {
        if (props == null) {
            return "<div class=\"widget widget-chart\" style=\"" + escapeHtmlAttribute(style) + "\"></div>";
        }
        String image = props.path("exportedImage").asText("");
        if (!image.isBlank()) {
            String chartType = props.path("chartType").asText("N/A");
            String escapedSrc = escapeHtmlAttribute(image);
            String escapedAlt = escapeHtmlAttribute("Chart: " + chartType);
            return "<div class=\"widget widget-chart\" style=\"" + escapeHtmlAttribute(style) + "\">"
                    + "<img src=\"" + escapedSrc + "\" alt=\"" + escapedAlt + "\" style=\"width: 100%; height: 100%; object-fit: contain;\" />"
                    + "</div>";
        }
        String chartType = props.path("chartType").asText("N/A");
        return "<div class=\"widget widget-chart\" style=\"" + escapeHtmlAttribute(style) + "\">"
                + "<div class=\"chart-placeholder\">Chart: " + escapeHtml(chartType) + "</div>"
                + "</div>";
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

    private String renderLogo(DocumentModel document, double pageWidth, double pageHeight) {
        LogoConfig logo = document.getLogo();
        if (logo == null || logo.getUrl() == null || logo.getUrl().isBlank()) {
            return "";
        }

        String position = Optional.ofNullable(logo.getPosition()).orElse("top-right").toLowerCase(Locale.ROOT);
        String style = "position: absolute; z-index: 1000; padding: 12px 16px; pointer-events: none;";

        switch (position) {
            case "top-left":
                style += "top: 0; left: 0;";
                break;
            case "top-right":
                style += "top: 0; right: 0; display: flex; align-items: center; justify-content: flex-end;";
                break;
            case "bottom-left":
                style += "bottom: 0; left: 0;";
                break;
            case "bottom-right":
                style += "bottom: 0; right: 0; display: flex; align-items: center; justify-content: flex-end;";
                break;
            default:
                style += "top: 0; right: 0; display: flex; align-items: center; justify-content: flex-end;";
        }

        String escapedStyle = escapeHtmlAttribute(style);
        String escapedUrl = escapeHtmlAttribute(logo.getUrl());
        return "<div class=\"page__logo-placeholder\" style=\"" + escapedStyle + "\">" +
                "<img src=\"" + escapedUrl + "\" alt=\"Logo\" class=\"page__logo-image\" />" +
                "</div>";
    }

    private String renderFooter(DocumentModel document, Page page, double pageWidth, double pageHeight) {
        FooterConfig footer = document.getFooter();
        if (footer == null) {
            return "";
        }

        boolean hasContent = (footer.getLeftText() != null && !footer.getLeftText().isBlank()) ||
                            (footer.getCenterText() != null && !footer.getCenterText().isBlank()) ||
                            (footer.getCenterSubText() != null && !footer.getCenterSubText().isBlank()) ||
                            (footer.getShowPageNumber() != null && footer.getShowPageNumber());

        if (!hasContent) {
            return "";
        }

        StringBuilder footerHtml = new StringBuilder();
        footerHtml.append("<div class=\"page__footer\">");

        footerHtml.append("<div class=\"page__footer-left\">");
        if (footer.getLeftText() != null && !footer.getLeftText().isBlank()) {
            footerHtml.append(escapeHtml(footer.getLeftText()));
        } else {
            footerHtml.append("&nbsp;");
        }
        footerHtml.append("</div>");

        footerHtml.append("<div class=\"page__footer-center\">");
        if (footer.getCenterText() != null && !footer.getCenterText().isBlank()) {
            footerHtml.append("<div class=\"page__footer-center-line\">").append(escapeHtml(footer.getCenterText())).append("</div>");
        }
        if (footer.getCenterSubText() != null && !footer.getCenterSubText().isBlank()) {
            footerHtml.append("<div class=\"page__footer-center-line\">").append(escapeHtml(footer.getCenterSubText())).append("</div>");
        }
        if ((footer.getCenterText() == null || footer.getCenterText().isBlank()) && 
            (footer.getCenterSubText() == null || footer.getCenterSubText().isBlank())) {
            footerHtml.append("&nbsp;");
        }
        footerHtml.append("</div>");

        footerHtml.append("<div class=\"page__footer-right\">");
        if (footer.getShowPageNumber() != null && footer.getShowPageNumber() && page.getNumber() != null) {
            footerHtml.append(page.getNumber());
        } else {
            footerHtml.append("&nbsp;");
        }
        footerHtml.append("</div>");

        footerHtml.append("</div>");
        return footerHtml.toString();
    }
}

