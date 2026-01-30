package com.org.report_generator.model.document;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class WidgetTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void defaultsAreInitialized() {
        Widget widget = new Widget();
        assertThat(widget.getPosition()).isNotNull();
        assertThat(widget.getSize()).isNotNull();
    }

    @Test
    void allArgsConstructorWorks() {
        WidgetPosition pos = new WidgetPosition(10d, 20d);
        WidgetSize size = new WidgetSize(100d, 50d);
        JsonNode props = objectMapper.createObjectNode().put("text", "Hello");
        JsonNode style = objectMapper.createObjectNode().put("color", "red");

        Widget widget = new Widget("w1", "text", pos, size, 5, 45.0, false, props, style);

        assertThat(widget.getId()).isEqualTo("w1");
        assertThat(widget.getType()).isEqualTo("text");
        assertThat(widget.getPosition().getX()).isEqualTo(10d);
        assertThat(widget.getSize().getWidth()).isEqualTo(100d);
        assertThat(widget.getZIndex()).isEqualTo(5);
        assertThat(widget.getRotation()).isEqualTo(45.0);
        assertThat(widget.getLocked()).isFalse();
        assertThat(widget.getProps().get("text").asText()).isEqualTo("Hello");
        assertThat(widget.getStyle().get("color").asText()).isEqualTo("red");
    }

    @Test
    void settersWork() {
        Widget widget = new Widget();
        widget.setId("w2");
        widget.setType("image");
        widget.setZIndex(10);
        widget.setRotation(90.0);
        widget.setLocked(true);

        assertThat(widget.getId()).isEqualTo("w2");
        assertThat(widget.getType()).isEqualTo("image");
        assertThat(widget.getZIndex()).isEqualTo(10);
        assertThat(widget.getRotation()).isEqualTo(90.0);
        assertThat(widget.getLocked()).isTrue();
    }
}
