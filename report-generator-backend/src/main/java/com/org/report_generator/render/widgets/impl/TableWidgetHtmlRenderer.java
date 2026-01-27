package com.org.report_generator.render.widgets.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.org.report_generator.render.widgets.RenderContext;
import com.org.report_generator.render.widgets.WidgetRenderer;
import com.org.report_generator.service.renderer.TableWidgetRenderer;
import org.springframework.stereotype.Component;

@Component
public class TableWidgetHtmlRenderer implements WidgetRenderer {
    private final TableWidgetRenderer delegate = new TableWidgetRenderer();

    @Override
    public String widgetType() {
        return "table";
    }

    @Override
    public String render(JsonNode props, String widgetStyle, RenderContext ctx) {
        return delegate.render(props, widgetStyle);
    }
}


