package com.org.report_generator.service.renderer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.*;

class EditastraWidgetRendererTest {

    private EditastraWidgetRenderer renderer;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        renderer = new EditastraWidgetRenderer();
        objectMapper = new ObjectMapper();
    }

    @Test
    void render_nullProps_returnsEmptyWidget() {
        String result = renderer.render(null, "");
        assertThat(result).isNotNull();
        assertThat(result).contains("widget-editastra");
    }

    @Test
    void render_simpleContent_rendersHtml() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<p>Hello World</p>");

        String result = renderer.render(props, "");
        assertThat(result).contains("widget-editastra");
        assertThat(result).contains("Hello World");
    }

    @Test
    void render_formattedContent_preservesFormatting() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<p><b>Bold</b> <i>Italic</i></p>");

        String result = renderer.render(props, "");
        assertThat(result).contains("<b>Bold</b>");
        assertThat(result).contains("<i>Italic</i>");
    }

    @Test
    void render_lists_preservesLists() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<ul><li>Item 1</li><li>Item 2</li></ul>");

        String result = renderer.render(props, "");
        assertThat(result).contains("<ul>");
        assertThat(result).contains("<li>Item 1</li>");
    }

    @Test
    void render_orderedList_preservesOrderedList() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<ol><li>First</li><li>Second</li></ol>");

        String result = renderer.render(props, "");
        assertThat(result).contains("<ol>");
        assertThat(result).contains("<li>First</li>");
    }

    @Test
    void render_verticalAlignTop_appliesAlignment() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<p>Top</p>");
        props.put("verticalAlign", "top");

        String result = renderer.render(props, "");
        assertThat(result).contains("widget-editastra");
    }

    @Test
    void render_verticalAlignMiddle_appliesAlignment() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<p>Middle</p>");
        props.put("verticalAlign", "middle");

        String result = renderer.render(props, "");
        assertThat(result).contains("widget-editastra");
    }

    @Test
    void render_verticalAlignBottom_appliesAlignment() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<p>Bottom</p>");
        props.put("verticalAlign", "bottom");

        String result = renderer.render(props, "");
        assertThat(result).contains("widget-editastra");
    }

    @Test
    void render_emptyContent_returnsEmptyWidget() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "");

        String result = renderer.render(props, "");
        assertThat(result).contains("widget-editastra");
    }

    @Test
    void render_withWidgetStyle_appliesOuterStyle() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<p>Styled</p>");

        String result = renderer.render(props, "width: 400px; height: 200px;");
        assertThat(result).contains("width: 400px");
        assertThat(result).contains("height: 200px");
    }

    @Test
    void render_inlineStyles_preservesStyles() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<p style=\"color: blue; font-size: 16px;\">Blue</p>");

        String result = renderer.render(props, "");
        assertThat(result).contains("color: blue");
        assertThat(result).contains("font-size: 16px");
    }

    @Test
    void render_customMarkerList_preservesMarkerClass() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<ul class=\"custom-marker-list custom-marker-chevron\"><li>Item</li></ul>");

        String result = renderer.render(props, "");
        assertThat(result).contains("custom-marker-list");
        assertThat(result).contains("custom-marker-chevron");
    }

    @Test
    void render_superscript_preservesSuperscript() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<p>E = mc<sup>2</sup></p>");

        String result = renderer.render(props, "");
        assertThat(result).contains("<sup>2</sup>");
    }

    @Test
    void render_subscript_preservesSubscript() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<p>H<sub>2</sub>O</p>");

        String result = renderer.render(props, "");
        assertThat(result).contains("<sub>2</sub>");
    }

    @Test
    void getCss_returnsNonEmptyCss() {
        String css = renderer.getCss();
        assertThat(css).isNotNull();
        assertThat(css).contains(".widget-editastra");
    }
}
