package com.org.report_generator.render.widgets.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.org.report_generator.render.widgets.RenderContext;
import com.org.report_generator.render.widgets.WidgetRenderer;
import org.springframework.stereotype.Component;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

@Component
public class ChartWidgetHtmlRenderer implements WidgetRenderer {
    @Override
    public String widgetType() {
        return "chart";
    }

    @Override
    public String render(JsonNode props, String widgetStyle, RenderContext ctx) {
        if (props == null) {
            return "<div class=\"widget widget-chart\" style=\"" + escapeHtmlAttribute(widgetStyle) + "\"></div>";
        }
        String style = widgetStyle == null ? "" : widgetStyle;
        String bg = normalizeCssColor(props.path("backgroundColor").asText(""));
        if (!bg.isBlank()) {
            style = style + "background-color: " + bg + ";";
        }
        String image = props.path("exportedImage").asText("");
        if (!image.isBlank()) {
            String chartType = props.path("chartType").asText("N/A");

            // Performance optimization:
            // If the frontend provided an SVG data URL, inline the SVG instead of using <img src="data:...">.
            // This avoids image decoding/loading paths in Chromium and can significantly speed up PDF generation.
            String inlineSvg = tryDecodeSvgDataUrl(image);
            if (inlineSvg != null && !inlineSvg.isBlank()) {
                String svg = ensureSvgHasSizing(inlineSvg);
                return "<div class=\"widget widget-chart\" style=\"" + escapeHtmlAttribute(style) + "\">"
                        + "<div class=\"chart-svg\" style=\"width: 100%; height: 100%;\">"
                        + svg
                        + "</div></div>";
            }

            String escapedSrc = escapeHtmlAttribute(image);
            String escapedAlt = escapeHtmlAttribute("Chart: " + chartType);
            return "<div class=\"widget widget-chart\" style=\"" + escapeHtmlAttribute(style) + "\">"
                    + "<img src=\"" + escapedSrc + "\" alt=\"" + escapedAlt + "\" style=\"width: 100%; height: 100%; object-fit: contain;\" />"
                    + "</div>";
        }
        String chartType = props.path("chartType").asText("N/A");
        return "<div class=\"widget widget-chart\" style=\"" + escapeHtmlAttribute(style) + "\">"
            + "<div class=\"chart-placeholder\" style=\"color: var(--slide-foreground, #0f172a); font-family: var(--slide-editor-font-family, inherit);\">Chart: " + escapeHtml(chartType) + "</div>"
                + "</div>";
    }

    private String tryDecodeSvgDataUrl(String dataUrl) {
        if (dataUrl == null) return null;
        String lower = dataUrl.toLowerCase();
        if (!lower.startsWith("data:image/svg+xml")) {
            return null;
        }
        int comma = dataUrl.indexOf(',');
        if (comma < 0 || comma >= dataUrl.length() - 1) {
            return null;
        }
        String meta = dataUrl.substring(0, comma).toLowerCase();
        String payload = dataUrl.substring(comma + 1);
        try {
            if (meta.contains(";base64")) {
                byte[] bytes = Base64.getDecoder().decode(payload);
                return new String(bytes, StandardCharsets.UTF_8);
            }
            // URL-encoded (recommended): data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}
            return URLDecoder.decode(payload, StandardCharsets.UTF_8);
        } catch (Exception e) {
            return null;
        }
    }

    private String ensureSvgHasSizing(String svg) {
        // Ensure the inlined SVG fills the chart widget box.
        // Add a style attribute to the <svg> opening tag if it doesn't have one already.
        int start = svg.indexOf("<svg");
        if (start < 0) return svg;
        int end = svg.indexOf('>', start);
        if (end < 0) return svg;
        String openTag = svg.substring(start, end);
        if (openTag.contains("style=")) {
            return svg;
        }
        String injected = openTag.replace("<svg", "<svg style=\"width:100%;height:100%;\"");
        return svg.substring(0, start) + injected + svg.substring(end);
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
        return escapeHtml(input);
    }

    private String normalizeCssColor(String c) {
        if (c == null) return "";
        String s = c.trim();
        if (s.isEmpty()) return "";
        if ("transparent".equalsIgnoreCase(s)) return "";
        return s;
    }
}


