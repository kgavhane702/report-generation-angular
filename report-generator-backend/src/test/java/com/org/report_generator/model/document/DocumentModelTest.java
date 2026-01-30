package com.org.report_generator.model.document;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class DocumentModelTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void defaultsAreInitialized() {
        DocumentModel doc = new DocumentModel();
        assertThat(doc.getPageSize()).isNotNull();
        assertThat(doc.getSections()).isNotNull();
    }

    @Test
    void allArgsConstructorWorks() {
        PageSize ps = new PageSize(254d, 190.5d, 96);
        HeaderConfig header = new HeaderConfig();
        header.setLeftText("Left");
        FooterConfig footer = new FooterConfig();
        footer.setCenterText("Center");
        LogoConfig logo = new LogoConfig("http://logo.png", "top-left", 100, 50);

        Section section = new Section("s1", "Section 1", List.of());
        DocumentModel doc = new DocumentModel("Test Doc", ps, List.of(section), header, footer, logo);

        assertThat(doc.getTitle()).isEqualTo("Test Doc");
        assertThat(doc.getPageSize().getWidthMm()).isEqualTo(254d);
        assertThat(doc.getSections()).hasSize(1);
        assertThat(doc.getHeader().getLeftText()).isEqualTo("Left");
        assertThat(doc.getFooter().getCenterText()).isEqualTo("Center");
        assertThat(doc.getLogo().getUrl()).isEqualTo("http://logo.png");
    }

    @Test
    void jsonSerializationRoundTrip() throws Exception {
        DocumentModel doc = new DocumentModel();
        doc.setTitle("Test");
        doc.setPageSize(new PageSize(100d, 200d, 72));

        String json = objectMapper.writeValueAsString(doc);
        DocumentModel parsed = objectMapper.readValue(json, DocumentModel.class);

        assertThat(parsed.getTitle()).isEqualTo("Test");
        assertThat(parsed.getPageSize().getWidthMm()).isEqualTo(100d);
    }
}
