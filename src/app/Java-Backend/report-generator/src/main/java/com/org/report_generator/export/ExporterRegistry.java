package com.org.report_generator.export;

import org.springframework.stereotype.Component;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

@Component
public class ExporterRegistry {
    private final Map<ExportFormat, DocumentExporter> exporters = new EnumMap<>(ExportFormat.class);

    public ExporterRegistry(List<DocumentExporter> exporters) {
        for (DocumentExporter exporter : exporters) {
            this.exporters.put(exporter.format(), exporter);
        }
    }

    public DocumentExporter get(ExportFormat format) {
        DocumentExporter exporter = exporters.get(format);
        if (exporter == null) {
            throw new IllegalArgumentException("No exporter registered for format: " + format);
        }
        return exporter;
    }
}


