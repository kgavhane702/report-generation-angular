package com.org.report_generator.export;

import com.org.report_generator.model.document.DocumentModel;
import com.org.report_generator.service.PptxGeneratorService;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;

@Component
public class PptxExporter implements DocumentExporter {

    private final PptxGeneratorService pptxGenerator;

    public PptxExporter(PptxGeneratorService pptxGenerator) {
        this.pptxGenerator = pptxGenerator;
    }

    @Override
    public ExportFormat format() {
        return ExportFormat.PPTX;
    }

    @Override
    public ExportResult export(DocumentModel document) {
        byte[] bytes = pptxGenerator.generatePptx(document);
        // Correct MIME type for .pptx
        MediaType mediaType = MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.presentationml.presentation");
        return new ExportResult(bytes, mediaType, "pptx");
    }
}
