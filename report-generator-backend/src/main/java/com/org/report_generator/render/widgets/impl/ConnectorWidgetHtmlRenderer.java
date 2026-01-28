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

    private static final double PADDING = 0;
    private static final double ARROW_SIZE = 12;

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

        // Get endpoint coordinates (in widget-local coordinates)
        JsonNode startPointNode = props.path("startPoint");
        JsonNode endPointNode = props.path("endPoint");
        JsonNode controlPointNode = props.path("controlPoint");

        double startX = startPointNode.path("x").asDouble(0);
        double startY = startPointNode.path("y").asDouble(0);
        double endX = endPointNode.path("x").asDouble(200);
        double endY = endPointNode.path("y").asDouble(0);

        // Calculate actual bounds for viewBox
        // For curves, we need to consider bezier curve extents, not just control points
        double minX = Math.min(startX, endX);
        double minY = Math.min(startY, endY);
        double maxX = Math.max(startX, endX);
        double maxY = Math.max(startY, endY);
        
        if (controlPointNode != null && !controlPointNode.isMissingNode()) {
            double ctrlX = controlPointNode.path("x").asDouble(0);
            double ctrlY = controlPointNode.path("y").asDouble(0);
            
            // For quadratic bezier, find extrema: t = (P0 - P1) / (P0 - 2*P1 + P2)
            // X extrema
            double denomX = startX - 2 * ctrlX + endX;
            if (Math.abs(denomX) > 0.0001) {
                double tX = (startX - ctrlX) / denomX;
                if (tX > 0 && tX < 1) {
                    double x = (1 - tX) * (1 - tX) * startX + 2 * (1 - tX) * tX * ctrlX + tX * tX * endX;
                    minX = Math.min(minX, x);
                    maxX = Math.max(maxX, x);
                }
            }
            // Y extrema
            double denomY = startY - 2 * ctrlY + endY;
            if (Math.abs(denomY) > 0.0001) {
                double tY = (startY - ctrlY) / denomY;
                if (tY > 0 && tY < 1) {
                    double y = (1 - tY) * (1 - tY) * startY + 2 * (1 - tY) * tY * ctrlY + tY * tY * endY;
                    minY = Math.min(minY, y);
                    maxY = Math.max(maxY, y);
                }
            }
        }
        
        // ViewBox should encompass the actual line extents with small buffer for stroke
        double strokeBuffer = strokeWidth / 2.0 + 2; // Buffer for stroke width
        double viewBoxWidth = Math.max(maxX - minX + strokeBuffer * 2, 1);
        double viewBoxHeight = Math.max(maxY - minY + strokeBuffer * 2, 1);
        // Offset start so stroke doesn't clip
        double offsetX = minX - strokeBuffer;
        double offsetY = minY - strokeBuffer;
        String viewBox = String.format(Locale.ROOT, "%s %s %s %s", 
            trimNumber(offsetX), trimNumber(offsetY), trimNumber(viewBoxWidth), trimNumber(viewBoxHeight));

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
                "<svg class=\"widget-connector__shape\" viewBox=\"%s\" preserveAspectRatio=\"xMidYMid meet\" style=\"width: 100%%; height: 100%%; display: block; opacity: %s; overflow: visible;\">" +
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
