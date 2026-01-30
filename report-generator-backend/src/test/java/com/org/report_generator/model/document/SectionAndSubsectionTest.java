package com.org.report_generator.model.document;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class SectionAndSubsectionTest {

    @Test
    void sectionDefaultsAreInitialized() {
        Section section = new Section();
        assertThat(section.getSubsections()).isNotNull();
    }

    @Test
    void sectionAllArgsConstructorWorks() {
        Subsection sub = new Subsection("sub1", "Subsection 1", List.of());
        Section section = new Section("s1", "Section 1", List.of(sub));

        assertThat(section.getId()).isEqualTo("s1");
        assertThat(section.getTitle()).isEqualTo("Section 1");
        assertThat(section.getSubsections()).hasSize(1);
        assertThat(section.getSubsections().get(0).getTitle()).isEqualTo("Subsection 1");
    }

    @Test
    void subsectionDefaultsAreInitialized() {
        Subsection subsection = new Subsection();
        assertThat(subsection.getPages()).isNotNull();
    }

    @Test
    void subsectionAllArgsConstructorWorks() {
        Page page = new Page("p1", 1, "landscape", List.of());
        Subsection sub = new Subsection("sub1", "Sub Title", List.of(page));

        assertThat(sub.getId()).isEqualTo("sub1");
        assertThat(sub.getTitle()).isEqualTo("Sub Title");
        assertThat(sub.getPages()).hasSize(1);
        assertThat(sub.getPages().get(0).getId()).isEqualTo("p1");
    }
}
