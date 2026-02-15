package com.org.report_generator.ingest;

import com.org.report_generator.model.document.DocumentModel;
import org.springframework.stereotype.Service;

@Service
public class DocumentIngestPipeline {

    private final DocumentValidator validator;
    private final DocumentNormalizer normalizer;

    public DocumentIngestPipeline(DocumentValidator validator, DocumentNormalizer normalizer) {
        this.validator = validator;
        this.normalizer = normalizer;
    }

    public DocumentModel ingest(DocumentModel incomingDocument) {
        validator.validate(incomingDocument);
        return normalizer.normalize(incomingDocument);
    }
}
