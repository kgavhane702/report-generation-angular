package com.org.report_generator.render.widgets;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.*;

class WidgetRendererRegistryTest_Extended {

    @Test
    void render_tableWidget_resolvedToTable() {
        WidgetRenderer tableRenderer = createRenderer("table", "TABLE_RESULT");
        WidgetRendererRegistry registry = new WidgetRendererRegistry(List.of(tableRenderer));

        String result = registry.render("table-widget", JsonNodeFactory.instance.objectNode(), "", new RenderContext(null, null));

        assertThat(result).isEqualTo("TABLE_RESULT");
    }

    @Test
    void render_tableWidgetCamelCase_resolvedToTable() {
        WidgetRenderer tableRenderer = createRenderer("table", "TABLE_RESULT");
        WidgetRendererRegistry registry = new WidgetRendererRegistry(List.of(tableRenderer));

        String result = registry.render("tableWidget", JsonNodeFactory.instance.objectNode(), "", new RenderContext(null, null));

        assertThat(result).isEqualTo("TABLE_RESULT");
    }

    @Test
    void render_unknownType_usesFallback() {
        WidgetRendererRegistry registry = new WidgetRendererRegistry(List.of());

        String result = registry.render("completely-unknown-type", JsonNodeFactory.instance.objectNode(), "test-style", new RenderContext(null, null));

        assertThat(result).contains("class=\"widget\"");
        assertThat(result).contains("test-style");
    }

    @Test
    void render_nullWidgetType_usesFallback() {
        WidgetRendererRegistry registry = new WidgetRendererRegistry(List.of());

        String result = registry.render(null, JsonNodeFactory.instance.objectNode(), "", new RenderContext(null, null));

        assertThat(result).contains("class=\"widget\"");
    }

    @Test
    void render_emptyWidgetType_usesFallback() {
        WidgetRendererRegistry registry = new WidgetRendererRegistry(List.of());

        String result = registry.render("", JsonNodeFactory.instance.objectNode(), "", new RenderContext(null, null));

        assertThat(result).contains("class=\"widget\"");
    }

    @Test
    void render_upperCaseType_normalizesToLowerCase() {
        WidgetRenderer textRenderer = createRenderer("text", "TEXT_RESULT");
        WidgetRendererRegistry registry = new WidgetRendererRegistry(List.of(textRenderer));

        String result = registry.render("TEXT", JsonNodeFactory.instance.objectNode(), "", new RenderContext(null, null));

        assertThat(result).isEqualTo("TEXT_RESULT");
    }

    @Test
    void render_mixedCaseType_normalizesToLowerCase() {
        WidgetRenderer imageRenderer = createRenderer("image", "IMAGE_RESULT");
        WidgetRendererRegistry registry = new WidgetRendererRegistry(List.of(imageRenderer));

        String result = registry.render("ImAgE", JsonNodeFactory.instance.objectNode(), "", new RenderContext(null, null));

        assertThat(result).isEqualTo("IMAGE_RESULT");
    }

    @Test
    void render_typeWithSpaces_normalizesTrimmed() {
        WidgetRenderer chartRenderer = createRenderer("chart", "CHART_RESULT");
        WidgetRendererRegistry registry = new WidgetRendererRegistry(List.of(chartRenderer));

        String result = registry.render("  chart  ", JsonNodeFactory.instance.objectNode(), "", new RenderContext(null, null));

        assertThat(result).isEqualTo("CHART_RESULT");
    }

    @Test
    void constructor_withNullRenderer_skips() {
        WidgetRenderer validRenderer = createRenderer("valid", "VALID_RESULT");
        WidgetRendererRegistry registry = new WidgetRendererRegistry(Arrays.asList(validRenderer, null));

        String result = registry.render("valid", JsonNodeFactory.instance.objectNode(), "", new RenderContext(null, null));

        assertThat(result).isEqualTo("VALID_RESULT");
    }

    @Test
    void constructor_withNullWidgetType_skips() {
        WidgetRenderer nullTypeRenderer = new WidgetRenderer() {
            @Override
            public String widgetType() {
                return null;
            }

            @Override
            public String render(JsonNode props, String widgetStyle, RenderContext ctx) {
                return "SHOULD_NOT_BE_CALLED";
            }
        };
        WidgetRendererRegistry registry = new WidgetRendererRegistry(List.of(nullTypeRenderer));

        String result = registry.render("anything", JsonNodeFactory.instance.objectNode(), "", new RenderContext(null, null));

        assertThat(result).contains("class=\"widget\""); // Should use fallback
    }

    @Test
    void constructor_withEmptyWidgetType_skips() {
        WidgetRenderer emptyTypeRenderer = new WidgetRenderer() {
            @Override
            public String widgetType() {
                return "";
            }

            @Override
            public String render(JsonNode props, String widgetStyle, RenderContext ctx) {
                return "SHOULD_NOT_BE_CALLED";
            }
        };
        WidgetRendererRegistry registry = new WidgetRendererRegistry(List.of(emptyTypeRenderer));

        String result = registry.render("anything", JsonNodeFactory.instance.objectNode(), "", new RenderContext(null, null));

        assertThat(result).contains("class=\"widget\""); // Should use fallback
    }

    @Test
    void render_multipleRenderers_selectsCorrectOne() {
        WidgetRenderer textRenderer = createRenderer("text", "TEXT");
        WidgetRenderer imageRenderer = createRenderer("image", "IMAGE");
        WidgetRenderer chartRenderer = createRenderer("chart", "CHART");
        WidgetRendererRegistry registry = new WidgetRendererRegistry(List.of(textRenderer, imageRenderer, chartRenderer));

        assertThat(registry.render("text", JsonNodeFactory.instance.objectNode(), "", new RenderContext(null, null))).isEqualTo("TEXT");
        assertThat(registry.render("image", JsonNodeFactory.instance.objectNode(), "", new RenderContext(null, null))).isEqualTo("IMAGE");
        assertThat(registry.render("chart", JsonNodeFactory.instance.objectNode(), "", new RenderContext(null, null))).isEqualTo("CHART");
    }

    @Test
    void fallback_escapesHtmlAttributes() {
        WidgetRendererRegistry registry = new WidgetRendererRegistry(List.of());

        String dangerousStyle = "color: red; \" onclick=\"alert('xss')";
        String result = registry.render("unknown", JsonNodeFactory.instance.objectNode(), dangerousStyle, new RenderContext(null, null));

        // Verify that quotes are escaped, preventing attribute injection
        assertThat(result).contains("&quot;");
        // The escaped result should not contain unescaped quotes that would allow attribute breakout
        assertThat(result).doesNotContain("style=\"color: red; \" onclick");
    }

    private WidgetRenderer createRenderer(String type, String returnValue) {
        return new WidgetRenderer() {
            @Override
            public String widgetType() {
                return type;
            }

            @Override
            public String render(JsonNode props, String widgetStyle, RenderContext ctx) {
                return returnValue;
            }
        };
    }
}
