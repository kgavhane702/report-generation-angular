package com.org.report_generator.service.renderer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.*;

class TextWidgetRendererTest {

    private TextWidgetRenderer renderer;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        renderer = new TextWidgetRenderer();
        objectMapper = new ObjectMapper();
    }

    @Test
    void render_nullProps_returnsEmptyTextWidget() {
        String result = renderer.render(null, "");
        assertThat(result).isNotNull();
        assertThat(result).contains("widget-text");
    }

    @Test
    void render_simpleText_rendersContent() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<p>Hello World</p>");

        String result = renderer.render(props, "");
        assertThat(result).contains("widget-text");
        assertThat(result).contains("Hello World");
    }

    @Test
    void render_formattedText_preservesFormatting() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<p><b>Bold</b> <i>Italic</i> <u>Underline</u></p>");

        String result = renderer.render(props, "");
        assertThat(result).contains("<b>Bold</b>");
        assertThat(result).contains("<i>Italic</i>");
        assertThat(result).contains("<u>Underline</u>");
    }

    @Test
    void render_headings_preservesHeadings() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<h1>Title</h1><h2>Subtitle</h2>");

        String result = renderer.render(props, "");
        assertThat(result).contains("<h1>Title</h1>");
        assertThat(result).contains("<h2>Subtitle</h2>");
    }

    @Test
    void render_unorderedList_preservesList() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<ul><li>Item A</li><li>Item B</li></ul>");

        String result = renderer.render(props, "");
        assertThat(result).contains("<ul>");
        assertThat(result).contains("<li>Item A</li>");
        assertThat(result).contains("<li>Item B</li>");
    }

    @Test
    void render_orderedList_preservesList() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<ol><li>First</li><li>Second</li><li>Third</li></ol>");

        String result = renderer.render(props, "");
        assertThat(result).contains("<ol>");
        assertThat(result).contains("<li>First</li>");
    }

    @Test
    void render_nestedList_preservesNesting() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<ul><li>Parent<ul><li>Child</li></ul></li></ul>");

        String result = renderer.render(props, "");
        assertThat(result).contains("Parent");
        assertThat(result).contains("Child");
    }

    @Test
    void render_inlineStyles_preservesStyles() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<p style=\"color: red; font-size: 24px;\">Styled</p>");

        String result = renderer.render(props, "");
        assertThat(result).contains("color: red");
        assertThat(result).contains("font-size: 24px");
    }

    @Test
    void render_links_preservesLinks() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<p><a href=\"https://example.com\">Link Text</a></p>");

        String result = renderer.render(props, "");
        assertThat(result).contains("<a href=\"https://example.com\">");
        assertThat(result).contains("Link Text");
    }

    @Test
    void render_superscript_preservesSuperscript() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<p>x<sup>2</sup> + y<sup>2</sup></p>");

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
    void render_blockquote_preservesBlockquote() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<blockquote>Famous quote here</blockquote>");

        String result = renderer.render(props, "");
        assertThat(result).contains("<blockquote>");
        assertThat(result).contains("Famous quote here");
    }

    @Test
    void render_strikethrough_preservesStrikethrough() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<p><s>Deleted text</s></p>");

        String result = renderer.render(props, "");
        assertThat(result).contains("<s>Deleted text</s>");
    }

    @Test
    void render_withWidgetStyle_appliesStyle() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<p>Test</p>");

        String result = renderer.render(props, "width: 300px; height: 100px;");
        assertThat(result).contains("width: 300px");
        assertThat(result).contains("height: 100px");
    }

    @Test
    void render_emptyContent_returnsEmptyWidget() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "");

        String result = renderer.render(props, "");
        assertThat(result).contains("widget-text");
    }

    @Test
    void render_multiParagraph_preservesAll() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<p>Paragraph 1</p><p>Paragraph 2</p><p>Paragraph 3</p>");

        String result = renderer.render(props, "");
        assertThat(result).contains("Paragraph 1");
        assertThat(result).contains("Paragraph 2");
        assertThat(result).contains("Paragraph 3");
    }

    @Test
    void render_withVerticalAlign_appliesAlignment() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<p>Aligned</p>");
        props.put("verticalAlign", "middle");

        String result = renderer.render(props, "");
        assertThat(result).contains("widget-text");
    }

    @Test
    void getCss_returnsNonEmptyCss() {
        String css = renderer.getCss();
        assertThat(css).isNotNull();
        assertThat(css).contains(".widget-text");
    }

    @Test
    void render_withBackgroundColor_appliesBackgroundColor() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<p>With Background</p>");
        props.put("backgroundColor", "#ffcc00");

        String result = renderer.render(props, "");
        assertThat(result).contains("background-color: #ffcc00");
    }

    @Test
    void render_withTransparentBackground_doesNotApplyBackground() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<p>Transparent BG</p>");
        props.put("backgroundColor", "transparent");

        String result = renderer.render(props, "");
        assertThat(result).doesNotContain("background-color: transparent");
    }

    @Test
    void render_plainTextWithNewlines_convertsToBreaks() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "Line 1\nLine 2\nLine 3");

        String result = renderer.render(props, "");
        assertThat(result).contains("<br/>");
    }

    @Test
    void render_plainTextWithCarriageReturns_convertsToBreaks() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "Line 1\r\nLine 2\r\nLine 3");

        String result = renderer.render(props, "");
        assertThat(result).contains("<br/>");
    }

    @Test
    void render_codeBlock_preservesCode() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<pre><code>const x = 1;</code></pre>");

        String result = renderer.render(props, "");
        assertThat(result).contains("<pre>");
        assertThat(result).contains("<code>");
        assertThat(result).contains("const x = 1;");
    }

    @Test
    void render_inlineCode_preservesInlineCode() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<p>Use <code>npm install</code> to install</p>");

        String result = renderer.render(props, "");
        assertThat(result).contains("<code>npm install</code>");
    }

    @Test
    void render_horizontalRule_preservesHr() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<p>Above</p><hr><p>Below</p>");

        String result = renderer.render(props, "");
        assertThat(result).contains("<hr>");
    }

    @Test
    void render_mark_preservesMark() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<p><mark>Highlighted text</mark></p>");

        String result = renderer.render(props, "");
        assertThat(result).contains("<mark>Highlighted text</mark>");
    }

    @Test
    void render_nestedFormatting_preservesAll() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<p><b><i><u>Bold Italic Underline</u></i></b></p>");

        String result = renderer.render(props, "");
        assertThat(result).contains("<b><i><u>Bold Italic Underline</u></i></b>");
    }

    @Test
    void render_tableInText_preservesTable() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<table><tr><th>Header</th></tr><tr><td>Cell</td></tr></table>");

        String result = renderer.render(props, "");
        assertThat(result).contains("<table>");
        assertThat(result).contains("<th>Header</th>");
        assertThat(result).contains("<td>Cell</td>");
    }

    @Test
    void render_allHeadingLevels_preservesAll() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<h1>H1</h1><h2>H2</h2><h3>H3</h3><h4>H4</h4><h5>H5</h5><h6>H6</h6>");

        String result = renderer.render(props, "");
        assertThat(result).contains("<h1>H1</h1>");
        assertThat(result).contains("<h2>H2</h2>");
        assertThat(result).contains("<h3>H3</h3>");
        assertThat(result).contains("<h4>H4</h4>");
        assertThat(result).contains("<h5>H5</h5>");
        assertThat(result).contains("<h6>H6</h6>");
    }

    @Test
    void render_textAlignStyles_preservesAlignment() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<p style=\"text-align: center;\">Centered</p><p style=\"text-align: right;\">Right</p>");

        String result = renderer.render(props, "");
        assertThat(result).contains("text-align: center");
        assertThat(result).contains("text-align: right");
    }

    @Test
    void render_fontFamilyStyle_preservesFontFamily() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<p style=\"font-family: Arial, sans-serif;\">Arial Text</p>");

        String result = renderer.render(props, "");
        assertThat(result).contains("font-family: Arial");
    }

    @Test
    void render_lineHeightStyle_preservesLineHeight() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<p style=\"line-height: 2;\">Double spaced</p>");

        String result = renderer.render(props, "");
        assertThat(result).contains("line-height: 2");
    }

    @Test
    void render_letterSpacingStyle_preservesLetterSpacing() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<p style=\"letter-spacing: 2px;\">Spaced letters</p>");

        String result = renderer.render(props, "");
        assertThat(result).contains("letter-spacing: 2px");
    }

    @Test
    void render_textIndentStyle_preservesIndent() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<p style=\"text-indent: 40px;\">Indented paragraph</p>");

        String result = renderer.render(props, "");
        assertThat(result).contains("text-indent: 40px");
    }

    @Test
    void render_colorStyle_preservesColor() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<span style=\"color: #ff0000;\">Red Text</span>");

        String result = renderer.render(props, "");
        assertThat(result).contains("color: #ff0000");
    }

    @Test
    void render_backgroundColorStyle_preservesHighlight() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<span style=\"background-color: yellow;\">Highlighted</span>");

        String result = renderer.render(props, "");
        assertThat(result).contains("background-color: yellow");
    }

    @Test
    void getCss_containsRequiredSelectors() {
        String css = TextWidgetRenderer.getCss();
        assertThat(css).contains(".widget-text p");
        assertThat(css).contains(".widget-text ul");
        assertThat(css).contains(".widget-text ol");
        assertThat(css).contains(".widget-text strong");
        assertThat(css).contains(".widget-text em");
        assertThat(css).contains(".widget-text blockquote");
        assertThat(css).contains(".widget-text code");
        assertThat(css).contains(".widget-text pre");
    }

    @Test
    void render_divContent_preservesDivs() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<div>Div Content</div>");

        String result = renderer.render(props, "");
        assertThat(result).contains("<div>Div Content</div>");
    }

    @Test
    void render_spanWithMultipleStyles_preservesAllStyles() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("contentHtml", "<span style=\"color: blue; font-weight: bold; font-size: 18px;\">Styled</span>");

        String result = renderer.render(props, "");
        assertThat(result).contains("color: blue");
        assertThat(result).contains("font-weight: bold");
        assertThat(result).contains("font-size: 18px");
    }
}
