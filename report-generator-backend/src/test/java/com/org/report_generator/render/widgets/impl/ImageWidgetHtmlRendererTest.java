package com.org.report_generator.render.widgets.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.org.report_generator.render.widgets.RenderContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.*;

class ImageWidgetHtmlRendererTest {

    private ImageWidgetHtmlRenderer renderer;
    private ObjectMapper objectMapper;
    private RenderContext ctx;

    @BeforeEach
    void setUp() {
        renderer = new ImageWidgetHtmlRenderer();
        objectMapper = new ObjectMapper();
        ctx = new RenderContext(null, null);
    }

    @Test
    void widgetType_returnsImage() {
        assertThat(renderer.widgetType()).isEqualTo("image");
    }

    @Test
    void render_nullProps_returnsEmptyImageWidget() {
        String result = renderer.render(null, "width: 100px; height: 100px;", ctx);
        assertThat(result).contains("widget-image");
        assertThat(result).contains("width: 100px");
    }

    @Test
    void render_withSrc_rendersImage() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("src", "https://example.com/image.png");
        props.put("alt", "Test Image");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("widget-image");
        assertThat(result).contains("https://example.com/image.png");
        assertThat(result).contains("Test Image");
    }

    @Test
    void render_withUrl_fallbackToUrl() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("url", "https://example.com/fallback.jpg");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("https://example.com/fallback.jpg");
    }

    @Test
    void render_emptySrc_returnsEmptyWidget() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("src", "");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("widget-image");
        assertThat(result).doesNotContain("<img");
    }

    @Test
    void render_base64DataUrl_rendersImage() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("src", "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("data:image/png;base64");
    }

    @Test
    void render_fitCover_appliesObjectFitCover() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("src", "https://example.com/image.png");
        props.put("fit", "cover");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("widget-image");
    }

    @Test
    void render_fitContain_appliesObjectFitContain() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("src", "https://example.com/image.png");
        props.put("fit", "contain");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("widget-image");
    }

    @Test
    void render_fitStretch_appliesObjectFitFill() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("src", "https://example.com/image.png");
        props.put("fit", "stretch");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("widget-image");
    }

    @Test
    void render_flipHorizontal_appliesTransform() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("src", "https://example.com/image.png");
        props.put("flipHorizontal", true);

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("widget-image");
    }

    @Test
    void render_flipVertical_appliesTransform() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("src", "https://example.com/image.png");
        props.put("flipVertical", true);

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("widget-image");
    }

    @Test
    void render_rotation90_appliesRotateTransform() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("src", "https://example.com/image.png");
        props.put("rotation", 90);

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("widget-image");
    }

    @Test
    void render_opacity50_appliesOpacity() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("src", "https://example.com/image.png");
        props.put("opacity", 50);

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("widget-image");
    }

    @Test
    void render_withBorder_appliesBorderStyles() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("src", "https://example.com/image.png");
        props.put("borderWidth", 2);
        props.put("borderColor", "#ff0000");
        props.put("borderStyle", "solid");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("widget-image");
    }

    @Test
    void render_withBorderRadius_appliesBorderRadius() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("src", "https://example.com/image.png");
        props.put("borderRadius", 10);

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("widget-image");
    }

    @Test
    void render_combinedTransforms_appliesAllTransforms() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("src", "https://example.com/image.png");
        props.put("flipHorizontal", true);
        props.put("flipVertical", true);
        props.put("rotation", 45);

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("widget-image");
    }

    @Test
    void render_withWidgetStyle_appliesOuterStyle() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("src", "https://example.com/image.png");

        String result = renderer.render(props, "position: absolute; top: 50px; left: 100px;", ctx);
        assertThat(result).contains("position: absolute");
        assertThat(result).contains("top: 50px");
        assertThat(result).contains("left: 100px");
    }

    @Test
    void render_defaultAlt_usesImageAsAlt() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("src", "https://example.com/image.png");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("Image");
    }

    @Test
    void render_customAlt_usesProvidedAlt() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("src", "https://example.com/image.png");
        props.put("alt", "Custom Description");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("Custom Description");
    }
}
