package com.org.report_generator.render.widgets.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.org.report_generator.render.widgets.RenderContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.*;

class ConnectorWidgetHtmlRendererTest {

    private ConnectorWidgetHtmlRenderer renderer;
    private ObjectMapper objectMapper;
    private RenderContext ctx;

    @BeforeEach
    void setUp() {
        renderer = new ConnectorWidgetHtmlRenderer();
        objectMapper = new ObjectMapper();
        ctx = new RenderContext(null, null);
    }

    @Test
    void widgetType_returnsConnector() {
        assertThat(renderer.widgetType()).isEqualTo("connector");
    }

    @Test
    void render_nullProps_returnsEmptyDiv() {
        String result = renderer.render(null, "width: 200px; height: 100px;", ctx);
        assertThat(result).contains("widget-connector");
        assertThat(result).contains("width: 200px");
    }

    @Test
    void render_straightLine_generatesLinePath() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "line");
        props.put("fillColor", "#ff0000");
        props.put("opacity", 100);

        ObjectNode startPoint = objectMapper.createObjectNode();
        startPoint.put("x", 0);
        startPoint.put("y", 50);
        props.set("startPoint", startPoint);

        ObjectNode endPoint = objectMapper.createObjectNode();
        endPoint.put("x", 200);
        endPoint.put("y", 50);
        props.set("endPoint", endPoint);

        String result = renderer.render(props, "width: 200px; height: 100px;", ctx);
        assertThat(result).contains("<svg");
        assertThat(result).contains("<path");
        assertThat(result).contains("M 0 50 L 200 50");
        assertThat(result).contains("#ff0000");
    }

    @Test
    void render_elbowConnector_generatesElbowPath() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "elbow-connector");
        props.put("fillColor", "#0000ff");

        ObjectNode startPoint = objectMapper.createObjectNode();
        startPoint.put("x", 0);
        startPoint.put("y", 0);
        props.set("startPoint", startPoint);

        ObjectNode endPoint = objectMapper.createObjectNode();
        endPoint.put("x", 200);
        endPoint.put("y", 100);
        props.set("endPoint", endPoint);

        String result = renderer.render(props, "width: 200px; height: 100px;", ctx);
        assertThat(result).contains("<svg");
        assertThat(result).contains("<path");
        assertThat(result).contains("#0000ff");
    }

    @Test
    void render_curvedConnector_generatesQuadraticPath() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "curved-connector");
        props.put("fillColor", "#00ff00");

        ObjectNode startPoint = objectMapper.createObjectNode();
        startPoint.put("x", 0);
        startPoint.put("y", 50);
        props.set("startPoint", startPoint);

        ObjectNode endPoint = objectMapper.createObjectNode();
        endPoint.put("x", 200);
        endPoint.put("y", 50);
        props.set("endPoint", endPoint);

        ObjectNode controlPoint = objectMapper.createObjectNode();
        controlPoint.put("x", 100);
        controlPoint.put("y", 0);
        props.set("controlPoint", controlPoint);

        String result = renderer.render(props, "width: 200px; height: 100px;", ctx);
        assertThat(result).contains("<svg");
        assertThat(result).contains("<path");
        assertThat(result).contains("Q"); // Quadratic curve command
    }

    @Test
    void render_withArrowEnd_generatesArrowhead() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "line");
        props.put("fillColor", "#000000");
        props.put("arrowEnd", true);

        ObjectNode startPoint = objectMapper.createObjectNode();
        startPoint.put("x", 0);
        startPoint.put("y", 50);
        props.set("startPoint", startPoint);

        ObjectNode endPoint = objectMapper.createObjectNode();
        endPoint.put("x", 200);
        endPoint.put("y", 50);
        props.set("endPoint", endPoint);

        String result = renderer.render(props, "width: 200px; height: 100px;", ctx);
        assertThat(result).contains("<svg");
        // Should have arrowhead path
        assertThat(result.split("<path").length).isGreaterThan(2);
    }

    @Test
    void render_withArrowStart_generatesStartArrowhead() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "line");
        props.put("fillColor", "#000000");
        props.put("arrowStart", true);

        ObjectNode startPoint = objectMapper.createObjectNode();
        startPoint.put("x", 0);
        startPoint.put("y", 50);
        props.set("startPoint", startPoint);

        ObjectNode endPoint = objectMapper.createObjectNode();
        endPoint.put("x", 200);
        endPoint.put("y", 50);
        props.set("endPoint", endPoint);

        String result = renderer.render(props, "width: 200px; height: 100px;", ctx);
        assertThat(result).contains("<svg");
    }

    @Test
    void render_dashedStroke_appliesStrokeDasharray() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "line");
        props.put("fillColor", "#000000");

        ObjectNode stroke = objectMapper.createObjectNode();
        stroke.put("width", 3);
        stroke.put("style", "dashed");
        props.set("stroke", stroke);

        ObjectNode startPoint = objectMapper.createObjectNode();
        startPoint.put("x", 0);
        startPoint.put("y", 50);
        props.set("startPoint", startPoint);

        ObjectNode endPoint = objectMapper.createObjectNode();
        endPoint.put("x", 200);
        endPoint.put("y", 50);
        props.set("endPoint", endPoint);

        String result = renderer.render(props, "width: 200px; height: 100px;", ctx);
        assertThat(result).contains("stroke-dasharray");
        assertThat(result).contains("8,4");
    }

    @Test
    void render_dottedStroke_appliesStrokeDasharray() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "line");
        props.put("fillColor", "#000000");

        ObjectNode stroke = objectMapper.createObjectNode();
        stroke.put("width", 2);
        stroke.put("style", "dotted");
        props.set("stroke", stroke);

        ObjectNode startPoint = objectMapper.createObjectNode();
        startPoint.put("x", 0);
        startPoint.put("y", 50);
        props.set("startPoint", startPoint);

        ObjectNode endPoint = objectMapper.createObjectNode();
        endPoint.put("x", 200);
        endPoint.put("y", 50);
        props.set("endPoint", endPoint);

        String result = renderer.render(props, "width: 200px; height: 100px;", ctx);
        assertThat(result).contains("stroke-dasharray");
        assertThat(result).contains("2,2");
    }

    @Test
    void render_opacity50_appliesOpacity() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "line");
        props.put("fillColor", "#000000");
        props.put("opacity", 50);

        ObjectNode startPoint = objectMapper.createObjectNode();
        startPoint.put("x", 0);
        startPoint.put("y", 50);
        props.set("startPoint", startPoint);

        ObjectNode endPoint = objectMapper.createObjectNode();
        endPoint.put("x", 200);
        endPoint.put("y", 50);
        props.set("endPoint", endPoint);

        String result = renderer.render(props, "width: 200px; height: 100px;", ctx);
        assertThat(result).contains("opacity: 0.5");
    }

    @Test
    void render_sConnector_rendersAsCurve() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "s-connector");
        props.put("fillColor", "#ff00ff");

        ObjectNode startPoint = objectMapper.createObjectNode();
        startPoint.put("x", 0);
        startPoint.put("y", 0);
        props.set("startPoint", startPoint);

        ObjectNode endPoint = objectMapper.createObjectNode();
        endPoint.put("x", 200);
        endPoint.put("y", 100);
        props.set("endPoint", endPoint);

        String result = renderer.render(props, "width: 200px; height: 100px;", ctx);
        assertThat(result).contains("<svg");
        assertThat(result).contains("Q"); // Should use quadratic curve
    }

    @Test
    void render_viewBoxMatchesWidgetSize() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "line");

        ObjectNode startPoint = objectMapper.createObjectNode();
        startPoint.put("x", 0);
        startPoint.put("y", 50);
        props.set("startPoint", startPoint);

        ObjectNode endPoint = objectMapper.createObjectNode();
        endPoint.put("x", 300);
        endPoint.put("y", 50);
        props.set("endPoint", endPoint);

        String result = renderer.render(props, "width: 300px; height: 100px;", ctx);
        // viewBox width = max(endPoint.x, startPoint.x) + strokeWidth = 300 + 2 = 302
        // viewBox height = widgetHeight (100) since it exceeds minHeight (50 + 2 = 52)
        assertThat(result).contains("viewBox=\"0 0 302 100\"");
    }

    @Test
    void render_elbowArrow_generatesElbowWithArrow() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "elbow-arrow");
        props.put("fillColor", "#ff5500");
        props.put("arrowEnd", true);

        ObjectNode startPoint = objectMapper.createObjectNode();
        startPoint.put("x", 0);
        startPoint.put("y", 0);
        props.set("startPoint", startPoint);

        ObjectNode endPoint = objectMapper.createObjectNode();
        endPoint.put("x", 200);
        endPoint.put("y", 100);
        props.set("endPoint", endPoint);

        String result = renderer.render(props, "width: 200px; height: 100px;", ctx);
        assertThat(result).contains("<svg");
        assertThat(result).contains("#ff5500");
    }

    @Test
    void render_curvedArrow_generatesCurvedWithArrow() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "curved-arrow");
        props.put("fillColor", "#00ccff");
        props.put("arrowEnd", true);

        ObjectNode startPoint = objectMapper.createObjectNode();
        startPoint.put("x", 0);
        startPoint.put("y", 50);
        props.set("startPoint", startPoint);

        ObjectNode endPoint = objectMapper.createObjectNode();
        endPoint.put("x", 200);
        endPoint.put("y", 50);
        props.set("endPoint", endPoint);

        ObjectNode controlPoint = objectMapper.createObjectNode();
        controlPoint.put("x", 100);
        controlPoint.put("y", 0);
        props.set("controlPoint", controlPoint);

        String result = renderer.render(props, "width: 200px; height: 100px;", ctx);
        assertThat(result).contains("<svg");
        assertThat(result).contains("Q");
    }

    @Test
    void render_sArrow_rendersCurvedWithArrow() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "s-arrow");
        props.put("fillColor", "#9933ff");
        props.put("arrowEnd", true);

        ObjectNode startPoint = objectMapper.createObjectNode();
        startPoint.put("x", 0);
        startPoint.put("y", 0);
        props.set("startPoint", startPoint);

        ObjectNode endPoint = objectMapper.createObjectNode();
        endPoint.put("x", 200);
        endPoint.put("y", 100);
        props.set("endPoint", endPoint);

        String result = renderer.render(props, "width: 200px; height: 100px;", ctx);
        assertThat(result).contains("<svg");
        assertThat(result).contains("Q");
    }

    @Test
    void render_withBothArrows_generatesStartAndEndArrowheads() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "line");
        props.put("fillColor", "#000000");
        props.put("arrowStart", true);
        props.put("arrowEnd", true);

        ObjectNode startPoint = objectMapper.createObjectNode();
        startPoint.put("x", 0);
        startPoint.put("y", 50);
        props.set("startPoint", startPoint);

        ObjectNode endPoint = objectMapper.createObjectNode();
        endPoint.put("x", 200);
        endPoint.put("y", 50);
        props.set("endPoint", endPoint);

        String result = renderer.render(props, "width: 200px; height: 100px;", ctx);
        assertThat(result).contains("<svg");
        // Should have main path plus two arrowhead paths
        assertThat(result.split("<path").length).isGreaterThan(3);
    }

    @Test
    void render_elbowConnectorWithStartArrow_generatesStartArrowhead() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "elbow-connector");
        props.put("fillColor", "#0066ff");
        props.put("arrowStart", true);

        ObjectNode startPoint = objectMapper.createObjectNode();
        startPoint.put("x", 0);
        startPoint.put("y", 0);
        props.set("startPoint", startPoint);

        ObjectNode endPoint = objectMapper.createObjectNode();
        endPoint.put("x", 200);
        endPoint.put("y", 100);
        props.set("endPoint", endPoint);

        String result = renderer.render(props, "width: 200px; height: 100px;", ctx);
        assertThat(result).contains("<svg");
    }

    @Test
    void render_curvedConnectorWithStartArrow_generatesArrow() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "curved-connector");
        props.put("fillColor", "#ff6600");
        props.put("arrowStart", true);

        ObjectNode startPoint = objectMapper.createObjectNode();
        startPoint.put("x", 0);
        startPoint.put("y", 50);
        props.set("startPoint", startPoint);

        ObjectNode endPoint = objectMapper.createObjectNode();
        endPoint.put("x", 200);
        endPoint.put("y", 50);
        props.set("endPoint", endPoint);

        ObjectNode controlPoint = objectMapper.createObjectNode();
        controlPoint.put("x", 100);
        controlPoint.put("y", 0);
        props.set("controlPoint", controlPoint);

        String result = renderer.render(props, "width: 200px; height: 100px;", ctx);
        assertThat(result).contains("<svg");
    }

    @Test
    void render_curvedWithoutControlPoint_usesDefaultControlPoint() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "curved-connector");
        props.put("fillColor", "#aa00bb");

        ObjectNode startPoint = objectMapper.createObjectNode();
        startPoint.put("x", 0);
        startPoint.put("y", 50);
        props.set("startPoint", startPoint);

        ObjectNode endPoint = objectMapper.createObjectNode();
        endPoint.put("x", 200);
        endPoint.put("y", 50);
        props.set("endPoint", endPoint);

        String result = renderer.render(props, "width: 200px; height: 100px;", ctx);
        assertThat(result).contains("<svg");
        assertThat(result).contains("Q");
    }

    @Test
    void render_elbowConnectorWithControlPoint_usesControlPoint() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "elbow-connector");
        props.put("fillColor", "#00bb99");

        ObjectNode startPoint = objectMapper.createObjectNode();
        startPoint.put("x", 0);
        startPoint.put("y", 0);
        props.set("startPoint", startPoint);

        ObjectNode endPoint = objectMapper.createObjectNode();
        endPoint.put("x", 200);
        endPoint.put("y", 100);
        props.set("endPoint", endPoint);

        ObjectNode controlPoint = objectMapper.createObjectNode();
        controlPoint.put("x", 100);
        controlPoint.put("y", 50);
        props.set("controlPoint", controlPoint);

        String result = renderer.render(props, "width: 200px; height: 100px;", ctx);
        assertThat(result).contains("<svg");
        assertThat(result).contains("<path");
    }

    @Test
    void render_elbowConnectorWithAnchorDirections_usesAnchors() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "elbow-connector");
        props.put("fillColor", "#cc1155");

        ObjectNode startPoint = objectMapper.createObjectNode();
        startPoint.put("x", 0);
        startPoint.put("y", 50);
        props.set("startPoint", startPoint);

        ObjectNode endPoint = objectMapper.createObjectNode();
        endPoint.put("x", 200);
        endPoint.put("y", 50);
        props.set("endPoint", endPoint);

        ObjectNode startAttachment = objectMapper.createObjectNode();
        startAttachment.put("anchor", "right");
        props.set("startAttachment", startAttachment);

        ObjectNode endAttachment = objectMapper.createObjectNode();
        endAttachment.put("anchor", "left");
        props.set("endAttachment", endAttachment);

        String result = renderer.render(props, "width: 200px; height: 100px;", ctx);
        assertThat(result).contains("<svg");
        assertThat(result).contains("<path");
    }

    @Test
    void render_defaultStrokeWidth_usesMinimumWidth() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "line");
        props.put("fillColor", "#112233");

        ObjectNode startPoint = objectMapper.createObjectNode();
        startPoint.put("x", 0);
        startPoint.put("y", 50);
        props.set("startPoint", startPoint);

        ObjectNode endPoint = objectMapper.createObjectNode();
        endPoint.put("x", 200);
        endPoint.put("y", 50);
        props.set("endPoint", endPoint);

        String result = renderer.render(props, "width: 200px; height: 100px;", ctx);
        assertThat(result).contains("stroke-width=\"2\"");
    }

    @Test
    void render_customStrokeWidth_usesProvidedWidth() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "line");
        props.put("fillColor", "#445566");

        ObjectNode stroke = objectMapper.createObjectNode();
        stroke.put("width", 5);
        stroke.put("style", "solid");
        props.set("stroke", stroke);

        ObjectNode startPoint = objectMapper.createObjectNode();
        startPoint.put("x", 0);
        startPoint.put("y", 50);
        props.set("startPoint", startPoint);

        ObjectNode endPoint = objectMapper.createObjectNode();
        endPoint.put("x", 200);
        endPoint.put("y", 50);
        props.set("endPoint", endPoint);

        String result = renderer.render(props, "width: 200px; height: 100px;", ctx);
        assertThat(result).contains("stroke-width=\"5\"");
    }

    @Test
    void render_solidStroke_noStrokeDasharray() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "line");
        props.put("fillColor", "#778899");

        ObjectNode stroke = objectMapper.createObjectNode();
        stroke.put("width", 2);
        stroke.put("style", "solid");
        props.set("stroke", stroke);

        ObjectNode startPoint = objectMapper.createObjectNode();
        startPoint.put("x", 0);
        startPoint.put("y", 50);
        props.set("startPoint", startPoint);

        ObjectNode endPoint = objectMapper.createObjectNode();
        endPoint.put("x", 200);
        endPoint.put("y", 50);
        props.set("endPoint", endPoint);

        String result = renderer.render(props, "width: 200px; height: 100px;", ctx);
        assertThat(result).doesNotContain("stroke-dasharray=\"8,4\"");
        assertThat(result).doesNotContain("stroke-dasharray=\"2,2\"");
    }

    @Test
    void render_withStrokeLinecapRound() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "line");
        props.put("fillColor", "#aabbcc");

        ObjectNode startPoint = objectMapper.createObjectNode();
        startPoint.put("x", 0);
        startPoint.put("y", 50);
        props.set("startPoint", startPoint);

        ObjectNode endPoint = objectMapper.createObjectNode();
        endPoint.put("x", 200);
        endPoint.put("y", 50);
        props.set("endPoint", endPoint);

        String result = renderer.render(props, "width: 200px; height: 100px;", ctx);
        assertThat(result).contains("stroke-linecap=\"round\"");
    }

    @Test
    void render_elbowConnector_usesRoundLineJoin() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "elbow-connector");
        props.put("fillColor", "#ddeeff");

        ObjectNode startPoint = objectMapper.createObjectNode();
        startPoint.put("x", 0);
        startPoint.put("y", 0);
        props.set("startPoint", startPoint);

        ObjectNode endPoint = objectMapper.createObjectNode();
        endPoint.put("x", 200);
        endPoint.put("y", 100);
        props.set("endPoint", endPoint);

        String result = renderer.render(props, "width: 200px; height: 100px;", ctx);
        assertThat(result).contains("stroke-linejoin=\"round\"");
    }

    @Test
    void render_straightLine_usesMiterLineJoin() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("shapeType", "line");
        props.put("fillColor", "#eeffee");

        ObjectNode startPoint = objectMapper.createObjectNode();
        startPoint.put("x", 0);
        startPoint.put("y", 50);
        props.set("startPoint", startPoint);

        ObjectNode endPoint = objectMapper.createObjectNode();
        endPoint.put("x", 200);
        endPoint.put("y", 50);
        props.set("endPoint", endPoint);

        String result = renderer.render(props, "width: 200px; height: 100px;", ctx);
        assertThat(result).contains("stroke-linejoin=\"miter\"");
    }
}
