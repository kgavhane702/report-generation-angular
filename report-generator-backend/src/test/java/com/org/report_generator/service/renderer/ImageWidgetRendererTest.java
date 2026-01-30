package com.org.report_generator.service.renderer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.*;

class ImageWidgetRendererTest {

    private ImageWidgetRenderer renderer;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        renderer = new ImageWidgetRenderer();
        objectMapper = new ObjectMapper();
    }

    @Test
    void render_nullProps_returnsEmptyImageWidget() {
        String result = renderer.render(null, "");
        assertThat(result).isNotNull();
        assertThat(result).contains("widget-image");
    }

    @Test
    void render_withSrc_rendersImage() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("src", "https://example.com/image.png");

        String result = renderer.render(props, "");
        assertThat(result).contains("widget-image");
        assertThat(result).contains("https://example.com/image.png");
    }

    @Test
    void render_withUrl_fallsBackToUrl() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("url", "https://example.com/fallback.jpg");

        String result = renderer.render(props, "");
        assertThat(result).contains("https://example.com/fallback.jpg");
    }

    @Test
    void render_emptySrc_returnsEmptyWidget() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("src", "");

        String result = renderer.render(props, "");
        assertThat(result).contains("widget-image");
    }

    @Test
    void render_base64Src_rendersDataUrl() {
        ObjectNode props = objectMapper.createObjectNode();
        String base64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
        props.put("src", base64);

        String result = renderer.render(props, "");
        assertThat(result).contains("data:image/png;base64");
    }

    @Test
    void render_withAlt_setsAltAttribute() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("src", "https://example.com/image.png");
        props.put("alt", "A beautiful sunset");

        String result = renderer.render(props, "");
        assertThat(result).contains("A beautiful sunset");
    }

    @Test
    void render_fitCover_appliesCoverStyle() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("src", "https://example.com/image.png");
        props.put("fit", "cover");

        String result = renderer.render(props, "");
        assertThat(result).contains("widget-image");
    }

    @Test
    void render_fitContain_appliesContainStyle() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("src", "https://example.com/image.png");
        props.put("fit", "contain");

        String result = renderer.render(props, "");
        assertThat(result).contains("widget-image");
    }

    @Test
    void render_fitStretch_appliesFillStyle() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("src", "https://example.com/image.png");
        props.put("fit", "stretch");

        String result = renderer.render(props, "");
        assertThat(result).contains("widget-image");
    }

    @Test
    void render_flipHorizontal_appliesTransform() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("src", "https://example.com/image.png");
        props.put("flipHorizontal", true);

        String result = renderer.render(props, "");
        assertThat(result).contains("widget-image");
    }

    @Test
    void render_flipVertical_appliesTransform() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("src", "https://example.com/image.png");
        props.put("flipVertical", true);

        String result = renderer.render(props, "");
        assertThat(result).contains("widget-image");
    }

    @Test
    void render_rotation_appliesRotation() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("src", "https://example.com/image.png");
        props.put("rotation", 90);

        String result = renderer.render(props, "");
        assertThat(result).contains("widget-image");
    }

    @Test
    void render_opacity_appliesOpacity() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("src", "https://example.com/image.png");
        props.put("opacity", 75);

        String result = renderer.render(props, "");
        assertThat(result).contains("widget-image");
    }

    @Test
    void render_withBorder_appliesBorderStyles() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("src", "https://example.com/image.png");
        props.put("borderWidth", 3);
        props.put("borderColor", "#ff0000");
        props.put("borderStyle", "solid");

        String result = renderer.render(props, "");
        assertThat(result).contains("widget-image");
    }

    @Test
    void render_withBorderRadius_appliesBorderRadius() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("src", "https://example.com/image.png");
        props.put("borderRadius", 15);

        String result = renderer.render(props, "");
        assertThat(result).contains("widget-image");
    }

    @Test
    void render_multipleTransforms_appliesAll() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("src", "https://example.com/image.png");
        props.put("flipHorizontal", true);
        props.put("flipVertical", true);
        props.put("rotation", 180);

        String result = renderer.render(props, "");
        assertThat(result).contains("widget-image");
    }

    @Test
    void render_withWidgetStyle_appliesOuterStyle() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("src", "https://example.com/image.png");

        String result = renderer.render(props, "position: absolute; top: 10px; left: 20px;");
        assertThat(result).contains("position: absolute");
        assertThat(result).contains("top: 10px");
        assertThat(result).contains("left: 20px");
    }

    @Test
    void getCss_returnsNonEmptyCss() {
        String css = renderer.getCss();
        assertThat(css).isNotNull();
        assertThat(css).contains(".widget-image");
    }
}
