package com.org.report_generator.model.document;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class LogoConfigTest {

    @Test
    void noArgsConstructor() {
        LogoConfig logo = new LogoConfig();
        assertThat(logo.getUrl()).isNull();
        assertThat(logo.getPosition()).isNull();
        assertThat(logo.getMaxWidthPx()).isNull();
        assertThat(logo.getMaxHeightPx()).isNull();
    }

    @Test
    void allArgsConstructor() {
        LogoConfig logo = new LogoConfig("http://logo.png", "top-left", 100, 50);
        assertThat(logo.getUrl()).isEqualTo("http://logo.png");
        assertThat(logo.getPosition()).isEqualTo("top-left");
        assertThat(logo.getMaxWidthPx()).isEqualTo(100);
        assertThat(logo.getMaxHeightPx()).isEqualTo(50);
    }

    @Test
    void settersWork() {
        LogoConfig logo = new LogoConfig();
        logo.setUrl("http://other.png");
        logo.setPosition("bottom-right");
        logo.setMaxWidthPx(200);
        logo.setMaxHeightPx(100);

        assertThat(logo.getUrl()).isEqualTo("http://other.png");
        assertThat(logo.getPosition()).isEqualTo("bottom-right");
        assertThat(logo.getMaxWidthPx()).isEqualTo(200);
        assertThat(logo.getMaxHeightPx()).isEqualTo(100);
    }
}
