package com.org.report_generator.render.widgets.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.org.report_generator.render.widgets.RenderContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.net.URLEncoder;

import static org.assertj.core.api.Assertions.*;

class ChartWidgetHtmlRendererTest {

    private ChartWidgetHtmlRenderer renderer;
    private ObjectMapper objectMapper;
    private RenderContext ctx;

    @BeforeEach
    void setUp() {
        renderer = new ChartWidgetHtmlRenderer();
        objectMapper = new ObjectMapper();
        ctx = new RenderContext(null, null);
    }

    @Test
    void widgetType_returnsChart() {
        assertThat(renderer.widgetType()).isEqualTo("chart");
    }

    @Test
    void render_nullProps_returnsEmptyDiv() {
        String result = renderer.render(null, "width: 100px;", ctx);
        assertThat(result).contains("widget-chart");
        assertThat(result).contains("width: 100px;");
    }

    @Test
    void render_emptyExportedImage_returnsPlaceholder() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("exportedImage", "");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("widget-chart");
        assertThat(result).contains("chart-placeholder");
    }

    @Test
    void render_base64EncodedSvg_decodesProperly() {
        String svgContent = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"100\" height=\"100\"><rect width=\"100\" height=\"100\"/></svg>";
        String base64Svg = Base64.getEncoder().encodeToString(svgContent.getBytes(StandardCharsets.UTF_8));
        String dataUrl = "data:image/svg+xml;base64," + base64Svg;

        ObjectNode props = objectMapper.createObjectNode();
        props.put("exportedImage", dataUrl);

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("<svg");
        assertThat(result).contains("xmlns=\"http://www.w3.org/2000/svg\"");
        assertThat(result).contains("chart-svg");
    }

    @Test
    void render_urlEncodedSvg_decodesProperly() throws Exception {
        String svgContent = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"100\" height=\"100\"><circle r=\"50\"/></svg>";
        String urlEncodedSvg = URLEncoder.encode(svgContent, StandardCharsets.UTF_8.name());
        String dataUrl = "data:image/svg+xml;charset=utf-8," + urlEncodedSvg;

        ObjectNode props = objectMapper.createObjectNode();
        props.put("exportedImage", dataUrl);

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("<svg");
        assertThat(result).contains("<circle");
        assertThat(result).contains("chart-svg");
    }

    @Test
    void render_nonSvgImageUrl_rendersAsImg() {
        String dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

        ObjectNode props = objectMapper.createObjectNode();
        props.put("exportedImage", dataUrl);
        props.put("chartType", "bar");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("<img");
        assertThat(result).contains("src=\"");
        assertThat(result).contains("alt=\"Chart: bar\"");
    }

    @Test
    void render_withWidgetStyle_appliesStyle() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("chartType", "line");

        String result = renderer.render(props, "position: absolute; left: 10px;", ctx);
        assertThat(result).contains("position: absolute");
        assertThat(result).contains("left: 10px");
    }

    @Test
    void render_noExportedImage_showsPlaceholderWithChartType() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("chartType", "pie");

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("chart-placeholder");
        assertThat(result).contains("Chart: pie");
    }

    @Test
    void render_malformedBase64_showsAsImg() {
        String badDataUrl = "data:image/svg+xml;base64,!!!invalid-base64!!!";

        ObjectNode props = objectMapper.createObjectNode();
        props.put("exportedImage", badDataUrl);

        // Should fallback to img tag since base64 decode fails
        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("widget-chart");
        assertThat(result).contains("<img");
    }

    @Test
    void render_svgWithStyleAttribute_preservesExistingStyle() {
        String svgContent = "<svg xmlns=\"http://www.w3.org/2000/svg\" style=\"background: blue;\"><rect/></svg>";
        String base64Svg = Base64.getEncoder().encodeToString(svgContent.getBytes(StandardCharsets.UTF_8));
        String dataUrl = "data:image/svg+xml;base64," + base64Svg;

        ObjectNode props = objectMapper.createObjectNode();
        props.put("exportedImage", dataUrl);

        String result = renderer.render(props, "", ctx);
        // Should preserve the existing style attribute without adding new one
        assertThat(result).contains("<svg");
        assertThat(result).contains("background: blue");
    }

    @Test
    void render_noChartType_usesNAPlaceholder() {
        ObjectNode props = objectMapper.createObjectNode();

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("Chart: N/A");
    }
}
