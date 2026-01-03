package com.org.report_generator.render.widgets.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.org.report_generator.render.widgets.RenderContext;
import com.org.report_generator.render.widgets.WidgetRenderer;
import com.org.report_generator.service.renderer.TextWidgetRenderer;
import org.springframework.stereotype.Component;

@Component
public class TextWidgetHtmlRenderer implements WidgetRenderer {
    private final TextWidgetRenderer delegate = new TextWidgetRenderer();

    @Override
    public String widgetType() {
        return "text";
    }

    @Override
    public String render(JsonNode props, String widgetStyle, RenderContext ctx) {
        return delegate.render(props, widgetStyle);
    }
}


