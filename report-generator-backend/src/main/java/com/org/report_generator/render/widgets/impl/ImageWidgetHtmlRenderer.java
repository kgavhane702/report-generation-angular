package com.org.report_generator.render.widgets.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.org.report_generator.render.widgets.RenderContext;
import com.org.report_generator.render.widgets.WidgetRenderer;
import com.org.report_generator.service.renderer.ImageWidgetRenderer;
import org.springframework.stereotype.Component;

@Component
public class ImageWidgetHtmlRenderer implements WidgetRenderer {
    private final ImageWidgetRenderer delegate = new ImageWidgetRenderer();

    @Override
    public String widgetType() {
        return "image";
    }

    @Override
    public String render(JsonNode props, String widgetStyle, RenderContext ctx) {
        return delegate.render(props, widgetStyle);
    }
}


