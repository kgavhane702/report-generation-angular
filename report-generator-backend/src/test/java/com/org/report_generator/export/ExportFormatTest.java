package com.org.report_generator.export;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import static org.assertj.core.api.Assertions.*;

class ExportFormatTest {

    @Test
    void values_containsPdfAndImage() {
        ExportFormat[] formats = ExportFormat.values();
        assertThat(formats).contains(ExportFormat.PDF);
    }

    @Test
    void valueOf_PDF_returnsPdf() {
        ExportFormat format = ExportFormat.valueOf("PDF");
        assertThat(format).isEqualTo(ExportFormat.PDF);
    }
}
