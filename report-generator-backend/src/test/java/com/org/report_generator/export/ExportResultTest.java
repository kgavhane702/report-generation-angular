package com.org.report_generator.export;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import static org.assertj.core.api.Assertions.assertThat;

class ExportResultTest {

    @Test
    void shouldCreateExportResultWithAllFields() {
        byte[] content = "PDF content".getBytes();
        ExportResult result = new ExportResult(content, MediaType.APPLICATION_PDF, "pdf");
        
        assertThat(result.bytes()).isEqualTo(content);
        assertThat(result.mediaType()).isEqualTo(MediaType.APPLICATION_PDF);
        assertThat(result.fileExtension()).isEqualTo("pdf");
    }

    @Test
    void shouldCreateExportResultWithEmptyBytes() {
        ExportResult result = new ExportResult(new byte[0], MediaType.APPLICATION_PDF, "pdf");
        
        assertThat(result.bytes()).isEmpty();
    }

    @Test
    void shouldCreateExportResultWithNullBytes() {
        ExportResult result = new ExportResult(null, MediaType.APPLICATION_PDF, "pdf");
        
        assertThat(result.bytes()).isNull();
    }

    @Test
    void shouldSupportDifferentMediaTypes() {
        ExportResult pdfResult = new ExportResult("pdf".getBytes(), MediaType.APPLICATION_PDF, "pdf");
        ExportResult htmlResult = new ExportResult("html".getBytes(), MediaType.TEXT_HTML, "html");
        
        assertThat(pdfResult.mediaType()).isEqualTo(MediaType.APPLICATION_PDF);
        assertThat(htmlResult.mediaType()).isEqualTo(MediaType.TEXT_HTML);
    }

    @Test
    void shouldSupportEquality() {
        byte[] content = "test".getBytes();
        ExportResult result1 = new ExportResult(content, MediaType.APPLICATION_PDF, "pdf");
        ExportResult result2 = new ExportResult(content, MediaType.APPLICATION_PDF, "pdf");
        
        assertThat(result1).isEqualTo(result2);
    }

    @Test
    void shouldSupportHashCode() {
        byte[] content = "test".getBytes();
        ExportResult result1 = new ExportResult(content, MediaType.APPLICATION_PDF, "pdf");
        ExportResult result2 = new ExportResult(content, MediaType.APPLICATION_PDF, "pdf");
        
        assertThat(result1.hashCode()).isEqualTo(result2.hashCode());
    }
}
