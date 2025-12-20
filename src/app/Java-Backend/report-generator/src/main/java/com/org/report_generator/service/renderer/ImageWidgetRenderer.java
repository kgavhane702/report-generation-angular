package com.org.report_generator.service.renderer;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Modular renderer for image widgets.
 * Handles image display with support for base64 data URLs, regular URLs, and fit modes.
 */
public class ImageWidgetRenderer {
    
    private static final String IMAGE_WIDGET_CSS = """
        .widget-image {
            width: 100%;
            height: 100%;
            border-radius: 1rem;
            overflow: hidden;
            background: #e2e8f0;
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
        
        .widget-image img[style*="object-fit: cover"] {
            object-fit: cover;
        }
        
        .widget-image img[style*="object-fit: contain"] {
            object-fit: contain;
        }
        
        .widget-image img[style*="object-fit: stretch"] {
            object-fit: fill;
        }
        """;

    /**
     * Render an image widget with proper HTML structure
     * Supports base64 data URLs, regular URLs, and fit modes (cover, contain, stretch)
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
        
        if (src.isBlank()) {
            return "<div class=\"widget widget-image\" style=\"" + escapeHtmlAttribute(widgetStyle) + "\"></div>";
        }
        
        // Determine object-fit CSS value
        String objectFit = switch (fit.toLowerCase()) {
            case "contain" -> "contain";
            case "stretch" -> "fill";
            default -> "cover"; // default to cover
        };
        
        // Escape HTML attributes
        String escapedSrc = escapeHtmlAttribute(src);
        String escapedAlt = escapeHtmlAttribute(alt);
        
        StringBuilder html = new StringBuilder();
        html.append("<div class=\"widget widget-image\" style=\"").append(escapeHtmlAttribute(widgetStyle)).append("\">");
        html.append("<img src=\"").append(escapedSrc).append("\" ");
        html.append("alt=\"").append(escapedAlt).append("\" ");
        html.append("style=\"width: 100%; height: 100%; object-fit: ").append(objectFit).append(";\" />");
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

