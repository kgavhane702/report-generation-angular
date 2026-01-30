package com.org.report_generator.render.widgets.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.org.report_generator.render.widgets.RenderContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.*;

class TextWidgetHtmlRendererTest {

    private TextWidgetHtmlRenderer renderer;
    private ObjectMapper objectMapper;
    private RenderContext ctx;

    @BeforeEach
    void setUp() {
        renderer = new TextWidgetHtmlRenderer();
        objectMapper = new ObjectMapper();
        ctx = new RenderContext(null, null);
    }

    @Test
    void widgetType_returnsText() {
        assertThat(renderer.widgetType()).isEqualTo("text");
    }

    @Test
    void render_nullProps_returnsEmptyTextWidget() {
        String result = renderer.render(null, "width: 200px;", ctx);
        assertThat(result).contains("widget-text");
        assertThat(result).contains("width: 200px;");
    }

    @Test
    void render_simpleText_rendersContent() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<p>Hello World</p>");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("widget-text");
        assertThat(result).contains("Hello World");
    }

    @Test
    void render_withFormattedText_preservesFormatting() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<p><b>Bold</b> and <i>Italic</i></p>");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("<b>Bold</b>");
        assertThat(result).contains("<i>Italic</i>");
    }

    @Test
    void render_withUnderlineAndStrikethrough_preservesStyles() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<p><u>Underlined</u> and <s>Strikethrough</s></p>");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("<u>Underlined</u>");
        assertThat(result).contains("<s>Strikethrough</s>");
    }

    @Test
    void render_withHeadings_rendersHeadings() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<h1>Heading 1</h1><h2>Heading 2</h2>");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("<h1>Heading 1</h1>");
        assertThat(result).contains("<h2>Heading 2</h2>");
    }

    @Test
    void render_withUnorderedList_rendersList() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<ul><li>Item 1</li><li>Item 2</li></ul>");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("<ul>");
        assertThat(result).contains("<li>Item 1</li>");
        assertThat(result).contains("<li>Item 2</li>");
    }

    @Test
    void render_withOrderedList_rendersList() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<ol><li>First</li><li>Second</li></ol>");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("<ol>");
        assertThat(result).contains("<li>First</li>");
        assertThat(result).contains("<li>Second</li>");
    }

    @Test
    void render_withInlineStyles_preservesStyles() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<p style=\"color: red; font-size: 20px;\">Styled Text</p>");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("color: red");
        assertThat(result).contains("font-size: 20px");
    }

    @Test
    void render_withWidgetStyle_appliesOuterStyle() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<p>Test</p>");

        String result = renderer.render(props, "position: absolute; top: 100px; left: 50px;", ctx);
        assertThat(result).contains("position: absolute");
        assertThat(result).contains("top: 100px");
        assertThat(result).contains("left: 50px");
    }

    @Test
    void render_emptyContentHtml_returnsEmptyWidget() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("widget-text");
    }

    @Test
    void render_withSuperscript_preservesSuperscript() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<p>E = mc<sup>2</sup></p>");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("<sup>2</sup>");
    }

    @Test
    void render_withSubscript_preservesSubscript() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<p>H<sub>2</sub>O</p>");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("<sub>2</sub>");
    }

    @Test
    void render_withBlockquote_preservesBlockquote() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<blockquote>Quoted text</blockquote>");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("<blockquote>Quoted text</blockquote>");
    }

    @Test
    void render_withNestedLists_preservesNesting() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<ul><li>Parent<ul><li>Child</li></ul></li></ul>");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("Parent");
        assertThat(result).contains("Child");
    }

    @Test
    void render_withLinks_preservesLinks() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<p><a href=\"https://example.com\">Link</a></p>");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("<a href=\"https://example.com\">Link</a>");
    }

    @Test
    void render_withVerticalAlignment_appliesAlignment() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<p>Centered Text</p>");
        props.put("verticalAlign", "middle");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("widget-text");
    }

    @Test
    void render_withTextAlign_appliesAlignment() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<p style=\"text-align: center;\">Centered</p>");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("text-align: center");
    }
}
