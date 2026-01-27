package com.org.report_generator.render.widgets.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.org.report_generator.render.widgets.RenderContext;
import com.org.report_generator.render.widgets.WidgetRenderer;
import com.org.report_generator.service.renderer.EditastraWidgetRenderer;
import org.springframework.stereotype.Component;

@Component
public class EditastraWidgetHtmlRenderer implements WidgetRenderer {
    private final EditastraWidgetRenderer delegate = new EditastraWidgetRenderer();

    @Override
    public String widgetType() {
        return "editastra";
    }

    @Override
    public String render(JsonNode props, String widgetStyle, RenderContext ctx) {
        return delegate.render(props, widgetStyle);
    }
}


