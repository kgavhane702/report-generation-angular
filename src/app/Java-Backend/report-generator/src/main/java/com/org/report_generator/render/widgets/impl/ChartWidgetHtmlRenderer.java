package com.org.report_generator.render.widgets.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.org.report_generator.render.widgets.RenderContext;
import com.org.report_generator.render.widgets.WidgetRenderer;
import org.springframework.stereotype.Component;

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
}


