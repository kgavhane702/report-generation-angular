package com.org.report_generator.render.widgets.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.org.report_generator.render.widgets.RenderContext;
import com.org.report_generator.render.widgets.WidgetRenderer;
import org.springframework.stereotype.Component;

import java.util.Locale;

/**
 * Renderer for Connector widgets (lines/connectors).
 *
 * Uses endpoint-based model: startPoint, endPoint, and optional controlPoint.
 * Generates SVG paths dynamically based on shape type (line, elbow, curved).
 */
@Component
public class ConnectorWidgetHtmlRenderer implements WidgetRenderer {

    private static final double ARROW_SIZE = 10;

    @Override
    public String widgetType() {
        return "connector";
    }

    @Override
    public String render(JsonNode props, String widgetStyle, RenderContext ctx) {
        String style = widgetStyle == null ? "" : widgetStyle;
        if (props == null) {
            return "<div class=\"widget widget-connector\" style=\"" + escapeHtmlAttribute(style) + "\"></div>";
        }

        String shapeType = props.path("shapeType").asText("line");
        String fillColor = props.path("fillColor").asText("#3b82f6");
        int opacity = props.path("opacity").asInt(100);
        boolean arrowEnd = props.path("arrowEnd").asBoolean(false);
        boolean arrowStart = props.path("arrowStart").asBoolean(false);

        JsonNode strokeNode = props.path("stroke");
        int strokeWidth = 2;
        String strokeStyle = "solid";
        if (strokeNode != null && !strokeNode.isMissingNode()) {
            strokeWidth = Math.max(strokeNode.path("width").asInt(2), 2);
            strokeStyle = strokeNode.path("style").asText("solid");
        }

        // Get endpoint coordinates (in widget-local coordinates, relative to widget position)
        JsonNode startPointNode = props.path("startPoint");
        JsonNode endPointNode = props.path("endPoint");
        JsonNode controlPointNode = props.path("controlPoint");

        double startX = startPointNode.path("x").asDouble(0);
        double startY = startPointNode.path("y").asDouble(0);
        double endX = endPointNode.path("x").asDouble(200);
        double endY = endPointNode.path("y").asDouble(0);

        // Extract widget size from widgetStyle for viewBox calculation
        // The CSS contains "width: Xpx; height: Ypx;" - we need to parse these values
        // to match frontend behavior where viewBox = "0 0 width height"
        double widgetWidth = parseStyleDimension(style, "width", 200);
        double widgetHeight = parseStyleDimension(style, "height", 100);
        
        // ViewBox matches widget size exactly, starting at origin (0,0)
        // This matches frontend: `0 0 ${width} ${height}`
        String viewBox = String.format(Locale.ROOT, "0 0 %s %s", 
            trimNumber(widgetWidth), trimNumber(widgetHeight));

        // Generate SVG path based on shape type
        String svgPath = generatePath(shapeType, startX, startY, endX, endY, controlPointNode);

        // Generate arrowheads
        String arrowPaths = "";
        if (arrowEnd) {
            arrowPaths += generateArrowhead(shapeType, startX, startY, endX, endY, controlPointNode, true, fillColor);
        }
        if (arrowStart) {
            arrowPaths += generateArrowhead(shapeType, startX, startY, endX, endY, controlPointNode, false, fillColor);
        }

        String strokeDasharray = "";
        if ("dashed".equals(strokeStyle)) {
            strokeDasharray = "stroke-dasharray=\"8,4\"";
        } else if ("dotted".equals(strokeStyle)) {
            strokeDasharray = "stroke-dasharray=\"2,2\"";
        }

        boolean isElbow = "elbow-connector".equals(shapeType) || "elbow-arrow".equals(shapeType);
        boolean isCurved = "curved-connector".equals(shapeType) || "curved-arrow".equals(shapeType)
                || "s-connector".equals(shapeType) || "s-arrow".equals(shapeType);
        String linejoin = (isElbow || isCurved) ? "round" : "miter";

        String strokeAttr = "stroke=\"" + escapeHtmlAttribute(fillColor) + "\" stroke-width=\"" + strokeWidth
                + "\" stroke-linecap=\"round\" stroke-linejoin=\"" + linejoin + "\" " + strokeDasharray;
        double opacityValue = opacity / 100.0;

        return String.format(
            "<div class=\"widget widget-connector\" style=\"%s\">" +
                "<svg class=\"widget-connector__shape\" viewBox=\"%s\" preserveAspectRatio=\"none\" style=\"width: 100%%; height: 100%%; display: block; opacity: %s; overflow: visible;\">" +
                    "<path d=\"%s\" fill=\"none\" %s />" +
                    "%s" +
                "</svg>" +
            "</div>",
            escapeHtmlAttribute(style),
            escapeHtmlAttribute(viewBox),
            opacityValue,
            escapeHtmlAttribute(svgPath),
            strokeAttr,
            arrowPaths
        );
    }

    /**
     * Generate SVG path based on connector shape type
     */
    private String generatePath(String shapeType, double startX, double startY, 
                                 double endX, double endY, JsonNode controlPointNode) {
        boolean isElbow = "elbow-connector".equals(shapeType) || "elbow-arrow".equals(shapeType);
        boolean isCurved = "curved-connector".equals(shapeType) || "curved-arrow".equals(shapeType)
                || "s-connector".equals(shapeType) || "s-arrow".equals(shapeType);

        if (isElbow) {
            // Elbow connector: horizontal then vertical
            double midX = endX;
            return String.format(Locale.ROOT, "M %s %s L %s %s L %s %s",
                trimNumber(startX), trimNumber(startY),
                trimNumber(midX), trimNumber(startY),
                trimNumber(endX), trimNumber(endY));
        } else if (isCurved) {
            // Curved connector with control point
            double ctrlX, ctrlY;
            if (controlPointNode != null && !controlPointNode.isMissingNode()) {
                ctrlX = controlPointNode.path("x").asDouble((startX + endX) / 2);
                ctrlY = controlPointNode.path("y").asDouble(Math.min(startY, endY) - 50);
            } else {
                ctrlX = (startX + endX) / 2;
                ctrlY = Math.min(startY, endY) - 50;
            }
            return String.format(Locale.ROOT, "M %s %s Q %s %s %s %s",
                trimNumber(startX), trimNumber(startY),
                trimNumber(ctrlX), trimNumber(ctrlY),
                trimNumber(endX), trimNumber(endY));
        } else {
            // Straight line
            return String.format(Locale.ROOT, "M %s %s L %s %s",
                trimNumber(startX), trimNumber(startY),
                trimNumber(endX), trimNumber(endY));
        }
    }

    /**
     * Generate arrowhead path at connector endpoint
     */
    private String generateArrowhead(String shapeType, double startX, double startY,
                                      double endX, double endY, JsonNode controlPointNode,
                                      boolean atEnd, String color) {
        double tipX, tipY;
        double angle;

        boolean isCurved = "curved-connector".equals(shapeType) || "curved-arrow".equals(shapeType)
                || "s-connector".equals(shapeType) || "s-arrow".equals(shapeType);

        if (atEnd) {
            tipX = endX;
            tipY = endY;
            if (isCurved && controlPointNode != null && !controlPointNode.isMissingNode()) {
                double ctrlX = controlPointNode.path("x").asDouble((startX + endX) / 2);
                double ctrlY = controlPointNode.path("y").asDouble(Math.min(startY, endY) - 50);
                angle = Math.atan2(tipY - ctrlY, tipX - ctrlX);
            } else {
                angle = Math.atan2(endY - startY, endX - startX);
            }
        } else {
            tipX = startX;
            tipY = startY;
            if (isCurved && controlPointNode != null && !controlPointNode.isMissingNode()) {
                double ctrlX = controlPointNode.path("x").asDouble((startX + endX) / 2);
                double ctrlY = controlPointNode.path("y").asDouble(Math.min(startY, endY) - 50);
                angle = Math.atan2(tipY - ctrlY, tipX - ctrlX);
            } else {
                angle = Math.atan2(startY - endY, startX - endX);
            }
        }

        double leftAngle = angle + Math.PI * 5 / 6;
        double rightAngle = angle - Math.PI * 5 / 6;

        double leftX = tipX + ARROW_SIZE * Math.cos(leftAngle);
        double leftY = tipY + ARROW_SIZE * Math.sin(leftAngle);
        double rightX = tipX + ARROW_SIZE * Math.cos(rightAngle);
        double rightY = tipY + ARROW_SIZE * Math.sin(rightAngle);

        String pathD = String.format(Locale.ROOT, "M %s %s L %s %s L %s %s Z",
            trimNumber(tipX), trimNumber(tipY),
            trimNumber(leftX), trimNumber(leftY),
            trimNumber(rightX), trimNumber(rightY));

        return String.format("<path d=\"%s\" fill=\"%s\" stroke=\"none\" />", 
            escapeHtmlAttribute(pathD), escapeHtmlAttribute(color));
    }

    private String trimNumber(double v) {
        if (!Double.isFinite(v)) return "0";
        long asLong = (long) v;
        if (Math.abs(v - asLong) < 0.0000001d) {
            return Long.toString(asLong);
        }
        return String.format(Locale.ROOT, "%.2f", v);
    }

    /**
     * Parse a dimension (width or height) from CSS style string.
     * Looks for patterns like "width: 123.45px;" and extracts the numeric value.
     */
    private double parseStyleDimension(String style, String property, double defaultValue) {
        if (style == null || style.isEmpty()) return defaultValue;
        
        // Look for property: valueXXpx; pattern
        String search = property + ":";
        int idx = style.toLowerCase().indexOf(search.toLowerCase());
        if (idx < 0) return defaultValue;
        
        int start = idx + search.length();
        // Skip whitespace
        while (start < style.length() && Character.isWhitespace(style.charAt(start))) {
            start++;
        }
        
        // Extract numeric value (may include decimal point)
        int end = start;
        while (end < style.length()) {
            char c = style.charAt(end);
            if (Character.isDigit(c) || c == '.' || c == '-') {
                end++;
            } else {
                break;
            }
        }
        
        if (end > start) {
            try {
                return Double.parseDouble(style.substring(start, end));
            } catch (NumberFormatException e) {
                return defaultValue;
            }
        }
        return defaultValue;
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
