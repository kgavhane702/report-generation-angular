package com.org.report_generator.render.widgets.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.org.report_generator.render.widgets.RenderContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.*;

class ObjectWidgetHtmlRendererTest {

    private ObjectWidgetHtmlRenderer renderer;
    private ObjectMapper objectMapper;
    private RenderContext ctx;

    @BeforeEach
    void setUp() {
        renderer = new ObjectWidgetHtmlRenderer();
        objectMapper = new ObjectMapper();
        ctx = new RenderContext(null, null);
    }

    @Test
    void widgetType_returnsObject() {
        assertThat(renderer.widgetType()).isEqualTo("object");
    }

    @Test
    void render_nullProps_returnsEmptyDiv() {
        String result = renderer.render(null, "width: 100px; height: 100px;", ctx);
        assertThat(result).contains("widget-object");
        assertThat(result).contains("width: 100px");
    }

    @Test
    void render_rectangle_rendersCssShape() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "rectangle");
        props.put("fillColor", "#3b82f6");
        props.put("opacity", 100);

        String result = renderer.render(props, "width: 100px; height: 50px;", ctx);
        assertThat(result).contains("widget-object");
        assertThat(result).contains("widget-object__shape--css");
        assertThat(result).contains("data-shape=\"rectangle\"");
        assertThat(result).contains("background-color: #3b82f6");
    }

    @Test
    void render_circle_rendersCssShapeWithBorderRadius() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "circle");
        props.put("fillColor", "#ef4444");

        String result = renderer.render(props, "width: 100px; height: 100px;", ctx);
        assertThat(result).contains("widget-object__shape--css");
        assertThat(result).contains("data-shape=\"circle\"");
        assertThat(result).contains("border-radius: 50%");
    }

    @Test
    void render_ellipse_rendersCssShapeWithBorderRadius() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "ellipse");
        props.put("fillColor", "#22c55e");

        String result = renderer.render(props, "width: 200px; height: 100px;", ctx);
        assertThat(result).contains("widget-object__shape--css");
        assertThat(result).contains("border-radius: 50%");
    }

    @Test
    void render_roundedRectangle_appliesRoundedBorderRadius() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "rounded-rectangle");
        props.put("fillColor", "#fbbf24");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("border-radius: 12px");
    }

    @Test
    void render_square_rendersCssShape() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "square");
        props.put("fillColor", "#8b5cf6");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("widget-object__shape--css");
        assertThat(result).contains("data-shape=\"square\"");
    }

    @Test
    void render_polygon_rendersSvgShape() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "polygon");
        props.put("svgPath", "M 50 0 L 100 50 L 50 100 L 0 50 Z");
        props.put("fillColor", "#06b6d4");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("<svg");
        assertThat(result).contains("<path");
        assertThat(result).contains("widget-object__shape--svg");
        assertThat(result).contains("M 50 0 L 100 50 L 50 100 L 0 50 Z");
    }

    @Test
    void render_withStroke_appliesBorder() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "rectangle");
        props.put("fillColor", "#ffffff");

        ObjectNode stroke = objectMapper.createObjectNode();
        stroke.put("color", "#000000");
        stroke.put("width", 2);
        stroke.put("style", "solid");
        props.set("stroke", stroke);

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("border:");
        assertThat(result).contains("2px");
        assertThat(result).contains("#000000");
    }

    @Test
    void render_withDashedStroke_appliesDashedBorder() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "rectangle");
        props.put("fillColor", "#ffffff");

        ObjectNode stroke = objectMapper.createObjectNode();
        stroke.put("color", "#ff0000");
        stroke.put("width", 1);
        stroke.put("style", "dashed");
        props.set("stroke", stroke);

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("dashed");
    }

    @Test
    void render_withCustomBorderRadius_appliesRadius() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "rectangle");
        props.put("fillColor", "#ffffff");
        props.put("borderRadius", 8);

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("border-radius: 8px");
    }

    @Test
    void render_withOpacity50_appliesOpacity() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "rectangle");
        props.put("fillColor", "#3b82f6");
        props.put("opacity", 50);

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("opacity: 0.5");
    }

    @Test
    void render_withContentHtml_addsTextOverlay() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "rectangle");
        props.put("fillColor", "#3b82f6");
        props.put("contentHtml", "<p>Hello World</p>");
        props.put("verticalAlign", "middle");
        props.put("textAlign", "center");
        props.put("padding", 16);

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("Hello World");
    }

    @Test
    void render_lineShape_rendersSvgWithStroke() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "line");
        props.put("fillColor", "#000000");
        props.put("svgPath", "M 0 50 L 200 50");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("<svg");
        assertThat(result).contains("<path");
        assertThat(result).contains("fill=\"none\"");
    }

    @Test
    void render_arrowShape_rendersSvgWithPath() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "arrow-right");
        props.put("fillColor", "#3b82f6");
        props.put("svgPath", "M 0 50 L 80 50 L 60 30 M 80 50 L 60 70");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("<svg");
        assertThat(result).contains("<path");
    }

    @Test
    void render_starShape_rendersSvgWithPath() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "star-5");
        props.put("fillColor", "#fbbf24");
        props.put("svgPath", "M 50 0 L 61 35 L 98 35 L 68 57 L 79 91 L 50 70 L 21 91 L 32 57 L 2 35 L 39 35 Z");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("<svg");
        assertThat(result).contains("<path");
        assertThat(result).contains("#fbbf24");
    }

    @Test
    void render_withEmptySvgPath_fallsBackToRectangle() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "custom-polygon");
        props.put("fillColor", "#3b82f6");
        props.put("svgPath", "");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("<svg");
        // Should use fallback rectangle path
        assertThat(result).contains("M 5 5 L 95 5 L 95 95 L 5 95 Z");
    }

    @Test
    void render_svgShape_withDottedStroke() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "triangle");
        props.put("fillColor", "#22c55e");
        props.put("svgPath", "M 50 0 L 100 100 L 0 100 Z");

        ObjectNode stroke = objectMapper.createObjectNode();
        stroke.put("color", "#000000");
        stroke.put("width", 2);
        stroke.put("style", "dotted");
        props.set("stroke", stroke);

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("<svg");
        assertThat(result).contains("stroke-dasharray=\"2,2\"");
    }

    @Test
    void render_preserveAspectRatio_none() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "hexagon");
        props.put("svgPath", "M 50 0 L 100 25 L 100 75 L 50 100 L 0 75 L 0 25 Z");
        props.put("fillColor", "#f97316");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("preserveAspectRatio=\"none\"");
    }

    @Test
    void render_vectorEffectNonScalingStroke() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "pentagon");
        props.put("svgPath", "M 50 0 L 100 38 L 81 100 L 19 100 L 0 38 Z");
        props.put("fillColor", "#a855f7");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("vector-effect=\"non-scaling-stroke\"");
    }

    @Test
    void render_elbowConnector_rendersStrokeOnlyShape() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "elbow-connector");
        props.put("fillColor", "#ff0000");
        props.put("svgPath", "M 0 50 L 100 50 L 100 100");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("<svg");
        assertThat(result).contains("fill=\"none\"");
    }

    @Test
    void render_lineArrow_rendersStrokeOnlyShape() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "line-arrow");
        props.put("fillColor", "#00ff00");
        props.put("svgPath", "M 0 50 L 200 50");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("fill=\"none\"");
    }

    @Test
    void render_lineArrowDouble_rendersStrokeOnlyShape() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "line-arrow-double");
        props.put("fillColor", "#0000ff");
        props.put("svgPath", "M 0 50 L 200 50");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("fill=\"none\"");
    }

    @Test
    void render_strokeOnlyShape_usesMinimumStrokeWidth() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "line");
        props.put("fillColor", "#112233");
        props.put("svgPath", "M 0 50 L 200 50");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("stroke-width=\"2\"");
    }

    @Test
    void render_strokeOnlyShape_withCustomStrokeWidth() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "line");
        props.put("fillColor", "#445566");
        props.put("svgPath", "M 0 50 L 200 50");

        ObjectNode stroke = objectMapper.createObjectNode();
        stroke.put("width", 4);
        stroke.put("style", "solid");
        props.set("stroke", stroke);

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("stroke-width=\"4\"");
    }

    @Test
    void render_cssShape_withZeroStroke_noBorder() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "rectangle");
        props.put("fillColor", "#ffffff");

        ObjectNode stroke = objectMapper.createObjectNode();
        stroke.put("width", 0);
        props.set("stroke", stroke);

        String result = renderer.render(props, "", ctx);
        assertThat(result).doesNotContain("border:");
    }

    @Test
    void render_svgShape_withZeroStroke_noStroke() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "triangle");
        props.put("fillColor", "#00ff00");
        props.put("svgPath", "M 50 0 L 100 100 L 0 100 Z");

        ObjectNode stroke = objectMapper.createObjectNode();
        stroke.put("width", 0);
        props.set("stroke", stroke);

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("stroke=\"none\"");
    }

    @Test
    void render_svgShape_withDashedStroke() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "diamond");
        props.put("fillColor", "#ffcc00");
        props.put("svgPath", "M 50 0 L 100 50 L 50 100 L 0 50 Z");

        ObjectNode stroke = objectMapper.createObjectNode();
        stroke.put("color", "#000000");
        stroke.put("width", 2);
        stroke.put("style", "dashed");
        props.set("stroke", stroke);

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("stroke-dasharray=\"8,4\"");
    }

    @Test
    void render_textOverlay_appliesVerticalAlignTop() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "rectangle");
        props.put("fillColor", "#3b82f6");
        props.put("contentHtml", "<p>Top Text</p>");
        props.put("verticalAlign", "top");
        props.put("textAlign", "left");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("Top Text");
    }

    @Test
    void render_textOverlay_appliesVerticalAlignBottom() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "rectangle");
        props.put("fillColor", "#3b82f6");
        props.put("contentHtml", "<p>Bottom Text</p>");
        props.put("verticalAlign", "bottom");
        props.put("textAlign", "right");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("Bottom Text");
    }

    @Test
    void render_emptyContentHtml_noTextOverlay() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "rectangle");
        props.put("fillColor", "#3b82f6");
        props.put("contentHtml", "");

        String result = renderer.render(props, "", ctx);
        // Should render shape without text overlay
        assertThat(result).contains("widget-object__shape");
    }

    @Test
    void render_opacity100_rendersFullOpacity() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "circle");
        props.put("fillColor", "#ff0000");
        props.put("opacity", 100);

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("opacity: 1");
    }

    @Test
    void render_opacity0_rendersZeroOpacity() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "rectangle");
        props.put("fillColor", "#00ff00");
        props.put("opacity", 0);

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("opacity: 0");
    }

    @Test
    void render_elbowArrow_rendersAsStrokeOnlyShape() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "elbow-arrow");
        props.put("fillColor", "#0066cc");
        props.put("svgPath", "M 0 0 L 100 0 L 100 100");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("<svg");
        assertThat(result).contains("fill=\"none\"");
    }

    @Test
    void render_nullSvgPath_usesDefaultRectangle() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "custom-shape");
        props.put("fillColor", "#cccccc");
        // svgPath not set (null)

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("<svg");
        assertThat(result).contains("M 5 5 L 95 5 L 95 95 L 5 95 Z");
    }

    @Test
    void render_widgetStyleApplied() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "rectangle");
        props.put("fillColor", "#aabbcc");

        String result = renderer.render(props, "width: 300px; height: 150px; position: absolute;", ctx);
        assertThat(result).contains("width: 300px");
        assertThat(result).contains("height: 150px");
    }
}
