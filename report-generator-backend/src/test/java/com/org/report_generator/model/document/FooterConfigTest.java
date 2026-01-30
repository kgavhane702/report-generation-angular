package com.org.report_generator.model.document;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class FooterConfigTest {

    @Test
    void effectiveLeftTextColor_usesLeftTextColorFirst() {
        FooterConfig config = new FooterConfig();
        config.setLeftTextColor("#FF0000");
        config.setTextColor("#0000FF");

        assertThat(config.getEffectiveLeftTextColor()).isEqualTo("#FF0000");
    }

    @Test
    void effectiveLeftTextColor_fallsBackToGlobalTextColor() {
        FooterConfig config = new FooterConfig();
        config.setTextColor("#00FF00");

        assertThat(config.getEffectiveLeftTextColor()).isEqualTo("#00FF00");
    }

    @Test
    void effectiveLeftTextColor_fallsBackToDefault() {
        FooterConfig config = new FooterConfig();

        assertThat(config.getEffectiveLeftTextColor()).isEqualTo("#000000");
    }

    @Test
    void effectiveCenterTextColor_usesPositionSpecificFirst() {
        FooterConfig config = new FooterConfig();
        config.setCenterTextColor("#AABBCC");

        assertThat(config.getEffectiveCenterTextColor()).isEqualTo("#AABBCC");
    }

    @Test
    void effectiveCenterTextColor_fallsBackToGlobal() {
        FooterConfig config = new FooterConfig();
        config.setTextColor("#112233");

        assertThat(config.getEffectiveCenterTextColor()).isEqualTo("#112233");
    }

    @Test
    void effectiveRightTextColor_usesPositionSpecificFirst() {
        FooterConfig config = new FooterConfig();
        config.setRightTextColor("#DDEEFF");

        assertThat(config.getEffectiveRightTextColor()).isEqualTo("#DDEEFF");
    }

    @Test
    void effectiveRightTextColor_fallsBackToDefault() {
        FooterConfig config = new FooterConfig();

        assertThat(config.getEffectiveRightTextColor()).isEqualTo("#000000");
    }

    @Test
    void allArgsConstructorWorks() {
        FooterConfig config = new FooterConfig(
                "Left", "Center", "SubText",
                "leftImg", "centerImg", "rightImg",
                "#111", "#222", "#333",
                "#444", true, "roman"
        );

        assertThat(config.getLeftText()).isEqualTo("Left");
        assertThat(config.getCenterText()).isEqualTo("Center");
        assertThat(config.getCenterSubText()).isEqualTo("SubText");
        assertThat(config.getShowPageNumber()).isTrue();
        assertThat(config.getPageNumberFormat()).isEqualTo("roman");
    }
}
