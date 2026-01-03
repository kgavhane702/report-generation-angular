package com.org.report_generator.export;

import com.org.report_generator.model.document.DocumentModel;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class ExporterRegistryTest {

    @Test
    void resolvesPdfExporter() {
        DocumentExporter pdf = new DocumentExporter() {
            @Override public ExportFormat format() { return ExportFormat.PDF; }
            @Override public ExportResult export(DocumentModel document) {
                return new ExportResult(new byte[]{1,2,3}, MediaType.APPLICATION_PDF, "pdf");
            }
        };

        ExporterRegistry registry = new ExporterRegistry(List.of(pdf));
        assertSame(pdf, registry.get(ExportFormat.PDF));
    }

    @Test
    void throwsWhenMissingExporter() {
        ExporterRegistry registry = new ExporterRegistry(List.of());
        assertThrows(IllegalArgumentException.class, () -> registry.get(ExportFormat.PDF));
    }
}


