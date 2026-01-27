package com.org.report_generator.render.widgets;

import com.fasterxml.jackson.databind.JsonNode;

public interface WidgetRenderer {
    /**
     * Canonical widget type key (lowercase), e.g. "text", "image", "table", "chart".
     */
    String widgetType();

    String render(JsonNode props, String widgetStyle, RenderContext ctx);
}


