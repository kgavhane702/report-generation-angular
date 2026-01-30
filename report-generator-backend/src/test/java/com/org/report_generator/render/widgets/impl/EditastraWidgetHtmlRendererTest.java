package com.org.report_generator.render.widgets.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.org.report_generator.render.widgets.RenderContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.*;

class EditastraWidgetHtmlRendererTest {

    private EditastraWidgetHtmlRenderer renderer;
    private ObjectMapper objectMapper;
    private RenderContext ctx;

    @BeforeEach
    void setUp() {
        renderer = new EditastraWidgetHtmlRenderer();
        objectMapper = new ObjectMapper();
        ctx = new RenderContext(null, null);
    }

    @Test
    void widgetType_returnsEditastra() {
        assertThat(renderer.widgetType()).isEqualTo("editastra");
    }

    @Test
    void render_nullProps_returnsEmptyWidget() {
        String result = renderer.render(null, "width: 100%;", ctx);
        assertThat(result).contains("widget-editastra");
        assertThat(result).contains("width: 100%");
    }

    @Test
    void render_simpleContent_rendersHtml() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<p>Hello World</p>");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("widget-editastra");
        assertThat(result).contains("Hello World");
    }

    @Test
    void render_withFormattedText_preservesFormatting() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<p><b>Bold</b> <i>Italic</i> <u>Underline</u></p>");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("<b>Bold</b>");
        assertThat(result).contains("<i>Italic</i>");
        assertThat(result).contains("<u>Underline</u>");
    }

    @Test
    void render_withList_preservesList() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<ul><li>Item 1</li><li>Item 2</li></ul>");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("<ul>");
        assertThat(result).contains("<li>Item 1</li>");
        assertThat(result).contains("<li>Item 2</li>");
    }

    @Test
    void render_withOrderedList_preservesList() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<ol><li>First</li><li>Second</li></ol>");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("<ol>");
        assertThat(result).contains("<li>First</li>");
    }

    @Test
    void render_verticalAlignTop_appliesAlignment() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<p>Top aligned</p>");
        props.put("verticalAlign", "top");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("widget-editastra");
    }

    @Test
    void render_verticalAlignMiddle_appliesAlignment() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<p>Middle aligned</p>");
        props.put("verticalAlign", "middle");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("widget-editastra");
    }

    @Test
    void render_verticalAlignBottom_appliesAlignment() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<p>Bottom aligned</p>");
        props.put("verticalAlign", "bottom");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("widget-editastra");
    }

    @Test
    void render_emptyContent_returnsEmptyWidget() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("widget-editastra");
    }

    @Test
    void render_withWidgetStyle_appliesOuterStyle() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<p>Styled</p>");

        String result = renderer.render(props, "position: absolute; top: 20px;", ctx);
        assertThat(result).contains("position: absolute");
        assertThat(result).contains("top: 20px");
    }

    @Test
    void render_withInlineStyles_preservesStyles() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<p style=\"color: red; font-size: 18px;\">Red Text</p>");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("color: red");
        assertThat(result).contains("font-size: 18px");
    }

    @Test
    void render_withCustomMarkerList_preservesMarkerClass() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<ul class=\"custom-marker-list custom-marker-arrow\"><li>Arrow item</li></ul>");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("custom-marker-list");
        assertThat(result).contains("custom-marker-arrow");
    }

    @Test
    void render_withNestedDivs_preservesStructure() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<div><div>Nested content</div></div>");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("Nested content");
    }

    @Test
    void render_withStrikethrough_preservesFormatting() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<p><s>Strikethrough</s></p>");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("<s>Strikethrough</s>");
    }

    @Test
    void render_withSuperscript_preservesSuperscript() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<p>x<sup>2</sup></p>");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("<sup>2</sup>");
    }

    @Test
    void render_withSubscript_preservesSubscript() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<p>CO<sub>2</sub></p>");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("<sub>2</sub>");
    }
}
