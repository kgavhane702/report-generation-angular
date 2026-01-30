package com.org.report_generator.model.document;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class PageTest {

    @Test
    void defaultsAreInitialized() {
        Page page = new Page();
        assertThat(page.getWidgets()).isNotNull();
    }

    @Test
    void allArgsConstructorWorks() {
        Widget w = new Widget();
        w.setId("w1");
        w.setType("text");

        Page page = new Page("p1", 1, "landscape", List.of(w));

        assertThat(page.getId()).isEqualTo("p1");
        assertThat(page.getNumber()).isEqualTo(1);
        assertThat(page.getOrientation()).isEqualTo("landscape");
        assertThat(page.getWidgets()).hasSize(1);
        assertThat(page.getWidgets().get(0).getType()).isEqualTo("text");
    }

    @Test
    void settersWork() {
        Page page = new Page();
        page.setId("p2");
        page.setNumber(5);
        page.setOrientation("portrait");

        assertThat(page.getId()).isEqualTo("p2");
        assertThat(page.getNumber()).isEqualTo(5);
        assertThat(page.getOrientation()).isEqualTo("portrait");
    }
}
