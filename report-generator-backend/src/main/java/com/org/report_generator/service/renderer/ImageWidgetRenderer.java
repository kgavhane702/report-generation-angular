package com.org.report_generator.service.renderer;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.ArrayList;
import java.util.List;

/**
 * Modular renderer for image widgets.
 * Handles image display with support for base64 data URLs, regular URLs, fit modes,
 * transforms (flip/rotate), opacity, and borders.
 */
public class ImageWidgetRenderer {
    
    private static final String IMAGE_WIDGET_CSS = """
        .widget-image {
            width: 100%;
            height: 100%;
            overflow: hidden;
            background: transparent;
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .widget-image img {
            width: 100%;
            height: 100%;
            display: block;
        }
        
        .widget-image img[data-fit="cover"] {
            object-fit: cover;
        }
        
        .widget-image img[data-fit="contain"] {
            object-fit: contain;
        }
        
        .widget-image img[data-fit="fill"] {
            object-fit: fill;
        }
        """;

    /**
     * Render an image widget with proper HTML structure
     * Supports:
     * - base64 data URLs and regular URLs
     * - fit modes (cover, contain, stretch)
     * - transforms (flipHorizontal, flipVertical, rotation)
     * - opacity (0-100)
     * - border (width, color, radius)
     */
    public String render(JsonNode props, String widgetStyle) {
        if (props == null) {
            return "<div class=\"widget widget-image\" style=\"" + escapeHtmlAttribute(widgetStyle) + "\"></div>";
        }
        
        String src = props.path("src").asText("");
        if (src.isBlank()) {
            // Fallback to "url" property for backward compatibility
            src = props.path("url").asText("");
        }
        
        String alt = props.path("alt").asText("Image");
        String fit = props.path("fit").asText("cover");
        
        // Transform properties
        boolean flipHorizontal = props.path("flipHorizontal").asBoolean(false);
        boolean flipVertical = props.path("flipVertical").asBoolean(false);
        int rotation = props.path("rotation").asInt(0);
        
        // Style properties
        int opacity = props.path("opacity").asInt(100);
        int borderWidth = props.path("borderWidth").asInt(0);
        String borderColor = props.path("borderColor").asText("#000000");
        String borderStyleProp = props.path("borderStyle").asText("solid");
        int borderRadius = props.path("borderRadius").asInt(0);
        
        if (src.isBlank()) {
            return "<div class=\"widget widget-image\" style=\"" + escapeHtmlAttribute(widgetStyle) + "\"></div>";
        }
        
        // Determine object-fit CSS value
        String objectFit = switch (fit.toLowerCase()) {
            case "contain" -> "contain";
            case "stretch" -> "fill";
            default -> "cover"; // default to cover
        };
        
        // Build transform string
        List<String> transforms = new ArrayList<>();
        if (flipHorizontal) {
            transforms.add("scaleX(-1)");
        }
        if (flipVertical) {
            transforms.add("scaleY(-1)");
        }
        if (rotation != 0) {
            transforms.add("rotate(" + rotation + "deg)");
        }
        String transformStyle = transforms.isEmpty() ? "" : "transform: " + String.join(" ", transforms) + ";";
        
        // Build opacity style
        String opacityStyle = opacity < 100 ? "opacity: " + (opacity / 100.0) + ";" : "";
        
        // Build border style
        String borderStyle = "";
        if (borderWidth > 0) {
            String bs = borderStyleProp == null ? "solid" : borderStyleProp.trim().toLowerCase();
            if (bs.isBlank()) {
                bs = "solid";
            }
            if (!"none".equals(bs)) {
                borderStyle = "border: " + borderWidth + "px " + escapeHtmlAttribute(bs) + " " + escapeHtmlAttribute(borderColor) + ";";
            }
        }
        
        // Build border radius style
        String borderRadiusStyle = borderRadius > 0 ? "border-radius: " + borderRadius + "px;" : "";
        
        // Build wrapper div styles (border goes on wrapper to avoid clipping)
        StringBuilder wrapperStyle = new StringBuilder();
        wrapperStyle.append(escapeHtmlAttribute(widgetStyle));
        if (!borderStyle.isEmpty()) {
            wrapperStyle.append(" ").append(borderStyle);
        }
        if (!borderRadiusStyle.isEmpty()) {
            wrapperStyle.append(" ").append(borderRadiusStyle);
        }
        
        // Combine all image styles (no border on img, but keep border-radius for shape)
        StringBuilder imgStyle = new StringBuilder();
        imgStyle.append("width: 100%; height: 100%; object-fit: ").append(objectFit).append(";");
        if (!transformStyle.isEmpty()) {
            imgStyle.append(" ").append(transformStyle);
        }
        if (!opacityStyle.isEmpty()) {
            imgStyle.append(" ").append(opacityStyle);
        }
        if (!borderRadiusStyle.isEmpty()) {
            imgStyle.append(" ").append(borderRadiusStyle);
        }
        
        // Escape HTML attributes
        String escapedSrc = escapeHtmlAttribute(src);
        String escapedAlt = escapeHtmlAttribute(alt);
        
        StringBuilder html = new StringBuilder();
        html.append("<div class=\"widget widget-image\" style=\"").append(wrapperStyle).append("\">");
        html.append("<img src=\"").append(escapedSrc).append("\" ");
        html.append("alt=\"").append(escapedAlt).append("\" ");
        html.append("data-fit=\"").append(objectFit).append("\" ");
        html.append("style=\"").append(imgStyle).append("\" />");
        html.append("</div>");
        
        return html.toString();
    }
    
    /**
     * Escape HTML attribute values to prevent XSS
     */
    private String escapeHtmlAttribute(String input) {
        if (input == null || input.isEmpty()) {
            return "";
        }
        return input.replace("&", "&amp;")
                    .replace("<", "&lt;")
                    .replace(">", "&gt;")
                    .replace("\"", "&quot;")
                    .replace("'", "&#39;");
    }
    
    /**
     * Get CSS styles for image widgets
     */
    public static String getCss() {
        return IMAGE_WIDGET_CSS;
    }
}
