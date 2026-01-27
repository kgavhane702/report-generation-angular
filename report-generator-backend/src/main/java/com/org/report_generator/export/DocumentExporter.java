package com.org.report_generator.export;

import com.org.report_generator.model.document.DocumentModel;

public interface DocumentExporter {
    ExportFormat format();
    ExportResult export(DocumentModel document);
}


