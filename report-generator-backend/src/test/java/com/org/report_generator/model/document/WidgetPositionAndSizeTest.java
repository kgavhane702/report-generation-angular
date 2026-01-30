package com.org.report_generator.model.document;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class WidgetPositionAndSizeTest {

    @Test
    void widgetPositionNoArgsConstructor() {
        WidgetPosition pos = new WidgetPosition();
        assertThat(pos.getX()).isNull();
        assertThat(pos.getY()).isNull();
    }

    @Test
    void widgetPositionAllArgsConstructor() {
        WidgetPosition pos = new WidgetPosition(10d, 20d);
        assertThat(pos.getX()).isEqualTo(10d);
        assertThat(pos.getY()).isEqualTo(20d);
    }

    @Test
    void widgetPositionSetters() {
        WidgetPosition pos = new WidgetPosition();
        pos.setX(100d);
        pos.setY(200d);
        assertThat(pos.getX()).isEqualTo(100d);
        assertThat(pos.getY()).isEqualTo(200d);
    }

    @Test
    void widgetSizeNoArgsConstructor() {
        WidgetSize size = new WidgetSize();
        assertThat(size.getWidth()).isNull();
        assertThat(size.getHeight()).isNull();
    }

    @Test
    void widgetSizeAllArgsConstructor() {
        WidgetSize size = new WidgetSize(300d, 150d);
        assertThat(size.getWidth()).isEqualTo(300d);
        assertThat(size.getHeight()).isEqualTo(150d);
    }

    @Test
    void widgetSizeSetters() {
        WidgetSize size = new WidgetSize();
        size.setWidth(500d);
        size.setHeight(250d);
        assertThat(size.getWidth()).isEqualTo(500d);
        assertThat(size.getHeight()).isEqualTo(250d);
    }
}
