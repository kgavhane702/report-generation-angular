package com.org.report_generator.model.document;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class HeaderConfigTest {

    @Test
    void effectiveLeftTextColor_usesLeftTextColorFirst() {
        HeaderConfig config = new HeaderConfig();
        config.setLeftTextColor("#FF0000");
        config.setTextColor("#0000FF");

        assertThat(config.getEffectiveLeftTextColor()).isEqualTo("#FF0000");
    }

    @Test
    void effectiveLeftTextColor_fallsBackToGlobalTextColor() {
        HeaderConfig config = new HeaderConfig();
        config.setTextColor("#00FF00");

        assertThat(config.getEffectiveLeftTextColor()).isEqualTo("#00FF00");
    }

    @Test
    void effectiveLeftTextColor_fallsBackToDefault() {
        HeaderConfig config = new HeaderConfig();

        assertThat(config.getEffectiveLeftTextColor()).isEqualTo("#000000");
    }

    @Test
    void effectiveCenterTextColor_usesPositionSpecificFirst() {
        HeaderConfig config = new HeaderConfig();
        config.setCenterTextColor("#AABBCC");

        assertThat(config.getEffectiveCenterTextColor()).isEqualTo("#AABBCC");
    }

    @Test
    void effectiveCenterTextColor_fallsBackToGlobal() {
        HeaderConfig config = new HeaderConfig();
        config.setTextColor("#112233");

        assertThat(config.getEffectiveCenterTextColor()).isEqualTo("#112233");
    }

    @Test
    void effectiveRightTextColor_usesPositionSpecificFirst() {
        HeaderConfig config = new HeaderConfig();
        config.setRightTextColor("#DDEEFF");

        assertThat(config.getEffectiveRightTextColor()).isEqualTo("#DDEEFF");
    }

    @Test
    void effectiveRightTextColor_fallsBackToDefault() {
        HeaderConfig config = new HeaderConfig();

        assertThat(config.getEffectiveRightTextColor()).isEqualTo("#000000");
    }

    @Test
    void allArgsConstructorWorks() {
        HeaderConfig config = new HeaderConfig(
                "Left", "Center", "Right",
                "leftImg", "centerImg", "rightImg",
                "#111", "#222", "#333",
                "#444", true, "arabic"
        );

        assertThat(config.getLeftText()).isEqualTo("Left");
        assertThat(config.getCenterText()).isEqualTo("Center");
        assertThat(config.getRightText()).isEqualTo("Right");
        assertThat(config.getLeftImage()).isEqualTo("leftImg");
        assertThat(config.getShowPageNumber()).isTrue();
        assertThat(config.getPageNumberFormat()).isEqualTo("arabic");
    }
}
