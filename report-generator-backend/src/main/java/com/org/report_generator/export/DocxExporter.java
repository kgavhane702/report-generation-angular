package com.org.report_generator.export;

import com.org.report_generator.model.document.DocumentModel;
import com.org.report_generator.service.DocxGeneratorService;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;

@Component
public class DocxExporter implements DocumentExporter {

    private final DocxGeneratorService docxGenerator;

    public DocxExporter(DocxGeneratorService docxGenerator) {
        this.docxGenerator = docxGenerator;
    }

    @Override
    public ExportFormat format() {
        return ExportFormat.DOCX;
    }

    @Override
    public ExportResult export(DocumentModel document) {
        byte[] bytes = docxGenerator.generateDocx(document);
        // Correct MIME type for .docx
        MediaType mediaType = MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        return new ExportResult(bytes, mediaType, "docx");
    }
}
