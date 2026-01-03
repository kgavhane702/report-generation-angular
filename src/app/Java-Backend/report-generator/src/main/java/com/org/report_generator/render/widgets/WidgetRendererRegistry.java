package com.org.report_generator.render.widgets;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Component
public class WidgetRendererRegistry {
    private final Map<String, WidgetRenderer> renderersByType = new HashMap<>();
    private final WidgetRenderer fallback;

    public WidgetRendererRegistry(List<WidgetRenderer> renderers) {
        WidgetRenderer fallbackFound = null;
        for (WidgetRenderer r : renderers) {
            if (r == null || r.widgetType() == null) continue;
            String key = r.widgetType().toLowerCase(Locale.ROOT).trim();
            if (key.isEmpty()) continue;
            if ("__fallback__".equals(key)) {
                fallbackFound = r;
            } else {
                renderersByType.put(key, r);
            }
        }
        this.fallback = fallbackFound != null ? fallbackFound : new DefaultFallbackWidgetRenderer();
    }

    public String render(String widgetType, JsonNode props, String widgetStyle, RenderContext ctx) {
        String key = normalizeType(widgetType);
        WidgetRenderer renderer = renderersByType.getOrDefault(key, fallback);
        return renderer.render(props, widgetStyle, ctx);
    }

    private String normalizeType(String raw) {
        if (raw == null) return "";
        String t = raw.toLowerCase(Locale.ROOT).trim();
        // Backward-compatible aliases
        return switch (t) {
            case "table-widget", "tablewidget" -> "table";
            default -> t;
        };
    }

    /**
     * Internal fallback used if no fallback bean is registered.
     */
    private static final class DefaultFallbackWidgetRenderer implements WidgetRenderer {
        @Override
        public String widgetType() {
            return "__fallback__";
        }

        @Override
        public String render(JsonNode props, String widgetStyle, RenderContext ctx) {
            String style = widgetStyle == null ? "" : widgetStyle;
            return "<div class=\"widget\" style=\"" + escapeHtmlAttribute(style) + "\"></div>";
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
}


