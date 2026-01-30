package com.org.report_generator.model.document;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PageSizeTest {

    @Test
    void noArgsConstructor() {
        PageSize ps = new PageSize();
        assertThat(ps.getWidthMm()).isNull();
        assertThat(ps.getHeightMm()).isNull();
        assertThat(ps.getDpi()).isNull();
    }

    @Test
    void allArgsConstructor() {
        PageSize ps = new PageSize(254d, 190.5d, 96);
        assertThat(ps.getWidthMm()).isEqualTo(254d);
        assertThat(ps.getHeightMm()).isEqualTo(190.5d);
        assertThat(ps.getDpi()).isEqualTo(96);
    }

    @Test
    void settersWork() {
        PageSize ps = new PageSize();
        ps.setWidthMm(100d);
        ps.setHeightMm(200d);
        ps.setDpi(72);

        assertThat(ps.getWidthMm()).isEqualTo(100d);
        assertThat(ps.getHeightMm()).isEqualTo(200d);
        assertThat(ps.getDpi()).isEqualTo(72);
    }
}
