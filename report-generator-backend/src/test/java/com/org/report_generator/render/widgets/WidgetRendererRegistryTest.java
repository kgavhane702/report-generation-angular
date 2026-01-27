package com.org.report_generator.render.widgets;

import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.org.report_generator.model.document.DocumentModel;
import com.org.report_generator.model.document.Page;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class WidgetRendererRegistryTest {

    @Test
    void resolvesByCanonicalTypeAndAliases() {
        WidgetRenderer table = new WidgetRenderer() {
            @Override public String widgetType() { return "table"; }
            @Override public String render(com.fasterxml.jackson.databind.JsonNode props, String widgetStyle, RenderContext ctx) {
                return "TABLE";
            }
        };
        WidgetRendererRegistry registry = new WidgetRendererRegistry(List.of(table));

        String out1 = registry.render("table", JsonNodeFactory.instance.objectNode(), "x", new RenderContext(null, null));
        String out2 = registry.render("table-widget", JsonNodeFactory.instance.objectNode(), "x", new RenderContext(null, null));

        assertEquals("TABLE", out1);
        assertEquals("TABLE", out2);
    }

    @Test
    void fallsBackWhenUnknown() {
        WidgetRendererRegistry registry = new WidgetRendererRegistry(List.of());
        String out = registry.render("unknown", JsonNodeFactory.instance.objectNode(), "position:absolute;", new RenderContext(null, null));
        assertTrue(out.contains("class=\"widget\""));
    }
}


