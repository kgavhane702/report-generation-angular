package com.org.report_generator.render.widgets.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.org.report_generator.render.widgets.RenderContext;
import com.org.report_generator.render.widgets.WidgetRenderer;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.Set;

/**
 * Renderer for Object widgets (geometric shapes).
 * Supports CSS shapes (rectangle, circle, ellipse) and SVG shapes (polygon, arrows, stars, etc.).
 * 
 * SVG paths are now passed from the frontend via the "svgPath" property to avoid duplication.
 * Supports fill color, stroke (border), opacity, and border radius for rectangles.
 */
@Component
public class ObjectWidgetHtmlRenderer implements WidgetRenderer {

    private static final String DEFAULT_VIEWBOX = "0 0 100 100";
    private static final Pattern SVG_NUMBER_PATTERN = Pattern.compile("(-?\\d*\\.?\\d+(?:[eE][-+]?\\d+)?)");

    /** Shapes that can be rendered with pure CSS */
    private static final Set<String> CSS_SHAPES = Set.of(
        "rectangle", "square", "rounded-rectangle", "circle", "ellipse"
    );

    @Override
    public String widgetType() {
        return "object";
    }

    @Override
    public String render(JsonNode props, String widgetStyle, RenderContext ctx) {
        if (props == null) {
            return renderEmptyWidget(widgetStyle);
        }

        String shapeType = props.path("shapeType").asText("rectangle");
        String svgPath = props.path("svgPath").asText("");
        String fillColor = props.path("fillColor").asText("#3b82f6");
        int opacity = props.path("opacity").asInt(100);
        
        // Stroke properties
        JsonNode strokeNode = props.path("stroke");
        String strokeColor = "#000000";
        int strokeWidth = 0;
        String strokeStyle = "solid";
        
        if (strokeNode != null && !strokeNode.isMissingNode()) {
            strokeColor = strokeNode.path("color").asText("#000000");
            strokeWidth = strokeNode.path("width").asInt(0);
            strokeStyle = strokeNode.path("style").asText("solid");
        }
        
        int borderRadius = props.path("borderRadius").asInt(0);
        
        // Text content properties
        String contentHtml = props.path("contentHtml").asText("");
        String verticalAlign = props.path("verticalAlign").asText("middle");
        String textAlign = props.path("textAlign").asText("center");
        int padding = props.path("padding").asInt(8);

        // Determine render type
        if (CSS_SHAPES.contains(shapeType)) {
            return renderCssShape(shapeType, fillColor, opacity, strokeColor, strokeWidth, strokeStyle, 
                                  borderRadius, contentHtml, verticalAlign, textAlign, padding, widgetStyle);
        } else {
            return renderSvgShape(shapeType, svgPath, fillColor, opacity, strokeColor, strokeWidth, strokeStyle,
                                  contentHtml, verticalAlign, textAlign, padding, widgetStyle);
        }
    }

    private String renderCssShape(String shapeType, String fillColor, int opacity, 
                                   String strokeColor, int strokeWidth, String strokeStyle,
                                   int borderRadius, String contentHtml, String verticalAlign, 
                                   String textAlign, int padding, String widgetStyle) {
        StringBuilder styleBuilder = new StringBuilder();
        styleBuilder.append("width: 100%; height: 100%; box-sizing: border-box; ");
        
        // Apply fill color with opacity
        styleBuilder.append(String.format("background-color: %s; ", fillColor));
        styleBuilder.append(String.format("opacity: %s; ", opacity / 100.0));
        
        // Apply stroke/border
        if (strokeWidth > 0) {
            styleBuilder.append(String.format("border: %dpx %s %s; ", strokeWidth, strokeStyle, strokeColor));
        }
        
        // Apply border radius based on shape type
        if ("circle".equals(shapeType) || "ellipse".equals(shapeType)) {
            styleBuilder.append("border-radius: 50%; ");
        } else if ("rounded-rectangle".equals(shapeType)) {
            styleBuilder.append("border-radius: 12px; ");
        } else if (borderRadius > 0) {
            styleBuilder.append(String.format("border-radius: %dpx; ", borderRadius));
        }

        String escapedWidgetStyle = escapeHtmlAttribute(widgetStyle);
        String shapeStyle = styleBuilder.toString();
        
        // Build text overlay if content exists
        String textOverlay = buildTextOverlay(contentHtml, verticalAlign, textAlign, padding);

        return String.format(
            "<div class=\"widget widget-object\" style=\"%s\">" +
                "<div class=\"widget-object__shape widget-object__shape--css\" data-shape=\"%s\" style=\"%s\"></div>" +
                "%s" +
            "</div>",
            escapedWidgetStyle,
            escapeHtmlAttribute(shapeType),
            escapeHtmlAttribute(shapeStyle),
            textOverlay
        );
    }

    private String renderSvgShape(String shapeType, String svgPath, String fillColor, int opacity,
                                   String strokeColor, int strokeWidth, String strokeStyle,
                                   String contentHtml, String verticalAlign, String textAlign, 
                                   int padding, String widgetStyle) {
        // Use svgPath from props, fallback to rectangle if empty
        if (svgPath == null || svgPath.isEmpty()) {
            svgPath = "M 5 5 L 95 5 L 95 95 L 5 95 Z"; // Fallback to rectangle
        }

        // Check if this is a stroke-only shape (like line)
        boolean isLineShape = "line".equals(shapeType);

        String viewBox = isLineShape ? DEFAULT_VIEWBOX : computeViewBox(svgPath);

        // Build stroke dasharray
        String strokeDasharray = "";
        if ("dashed".equals(strokeStyle)) {
            strokeDasharray = "stroke-dasharray=\"8,4\"";
        } else if ("dotted".equals(strokeStyle)) {
            strokeDasharray = "stroke-dasharray=\"2,2\"";
        }

        String strokeAttr;
        String fillAttr;
        
        if (isLineShape) {
            // Line: use fillColor as stroke, no fill
            int effectiveStrokeWidth = Math.max(strokeWidth > 0 ? strokeWidth : 2, 2);
            strokeAttr = String.format("stroke=\"%s\" stroke-width=\"%d\" stroke-linecap=\"round\" %s", 
                escapeHtmlAttribute(fillColor), effectiveStrokeWidth, strokeDasharray);
            fillAttr = "none";
        } else {
            // Regular shapes
            if (strokeWidth > 0) {
                strokeAttr = String.format("stroke=\"%s\" stroke-width=\"%d\" %s", 
                    escapeHtmlAttribute(strokeColor), strokeWidth, strokeDasharray);
            } else {
                strokeAttr = "stroke=\"none\"";
            }
            fillAttr = escapeHtmlAttribute(fillColor);
        }

        String escapedWidgetStyle = escapeHtmlAttribute(widgetStyle);
        double opacityValue = opacity / 100.0;
        
        // Build text overlay if content exists
        String textOverlay = buildTextOverlay(contentHtml, verticalAlign, textAlign, padding);

        return String.format(
            "<div class=\"widget widget-object\" style=\"%s\">" +
                "<svg class=\"widget-object__shape widget-object__shape--svg\" " +
                    "viewBox=\"%s\" preserveAspectRatio=\"none\" " +
                    "style=\"width: 100%%; height: 100%%; display: block; opacity: %s;\">" +
                    "<path d=\"%s\" fill=\"%s\" %s vector-effect=\"non-scaling-stroke\" />" +
                "</svg>" +
                "%s" +
            "</div>",
            escapedWidgetStyle,
            escapeHtmlAttribute(viewBox),
            opacityValue,
            escapeHtmlAttribute(svgPath),
            fillAttr,
            strokeAttr,
            textOverlay
        );
    }

    private String computeViewBox(String svgPath) {
        if (svgPath == null || svgPath.isBlank()) {
            return DEFAULT_VIEWBOX;
        }

        Matcher matcher = SVG_NUMBER_PATTERN.matcher(svgPath);
        List<Double> numbers = new ArrayList<>();
        while (matcher.find()) {
            try {
                numbers.add(Double.valueOf(matcher.group(1)));
            } catch (NumberFormatException ignored) {
                // Ignore malformed numbers
            }
        }

        if (numbers.size() < 4) {
            return DEFAULT_VIEWBOX;
        }

        double minX = Double.POSITIVE_INFINITY;
        double minY = Double.POSITIVE_INFINITY;
        double maxX = Double.NEGATIVE_INFINITY;
        double maxY = Double.NEGATIVE_INFINITY;

        for (int i = 0; i + 1 < numbers.size(); i += 2) {
            double x = numbers.get(i);
            double y = numbers.get(i + 1);
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
        }

        double width = maxX - minX;
        double height = maxY - minY;
        if (!(width > 0) || !(height > 0)) {
            return DEFAULT_VIEWBOX;
        }

        return String.format(Locale.ROOT, "%s %s %s %s",
                trimNumber(minX), trimNumber(minY), trimNumber(width), trimNumber(height));
    }

    private String trimNumber(double v) {
        // Keep HTML stable and readable; these shapes are integer-ish.
        if (v == Math.rint(v)) {
            return Long.toString(Math.round(v));
        }
        return String.format(Locale.ROOT, "%.4f", v);
    }
    
    /**
     * Build the text overlay HTML for shapes that contain text content.
     */
    private String buildTextOverlay(String contentHtml, String verticalAlign, String textAlign, int padding) {
        if (contentHtml == null || contentHtml.trim().isEmpty()) {
            return "";
        }
        
        // Map vertical alignment to CSS flexbox
        String justifyContent;
        switch (verticalAlign) {
            case "top":
                justifyContent = "flex-start";
                break;
            case "bottom":
                justifyContent = "flex-end";
                break;
            default: // middle
                justifyContent = "center";
                break;
        }
        
        String overlayStyle = String.format(
            "position: absolute; top: 0; left: 0; right: 0; bottom: 0; " +
            "display: flex; flex-direction: column; justify-content: %s; " +
            "text-align: %s; padding: %dpx; box-sizing: border-box; " +
            "overflow: hidden; word-wrap: break-word;",
            justifyContent, textAlign, padding
        );
        
        return String.format(
            "<div class=\"widget-object__text\" style=\"%s\">%s</div>",
            overlayStyle,
            contentHtml  // Don't escape - this is already sanitized HTML content
        );
    }

    private String renderEmptyWidget(String widgetStyle) {
        String style = widgetStyle == null ? "" : widgetStyle;
        return String.format(
            "<div class=\"widget widget-object\" style=\"%s\">" +
                "<div class=\"widget-object__shape widget-object__shape--empty\"></div>" +
            "</div>",
            escapeHtmlAttribute(style)
        );
    }

    private String escapeHtmlAttribute(String input) {
        if (input == null) return "";
        return input.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}
