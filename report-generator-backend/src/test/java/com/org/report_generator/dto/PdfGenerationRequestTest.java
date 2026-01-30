package com.org.report_generator.dto;

import com.org.report_generator.model.document.DocumentModel;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PdfGenerationRequestTest {

    @Test
    void shouldCreateRequestWithDefaultConstructor() {
        PdfGenerationRequest request = new PdfGenerationRequest();
        
        assertThat(request.getDocument()).isNull();
    }

    @Test
    void shouldSetAndGetDocument() {
        PdfGenerationRequest request = new PdfGenerationRequest();
        DocumentModel document = new DocumentModel();
        document.setTitle("Test Document");
        
        request.setDocument(document);
        
        assertThat(request.getDocument()).isNotNull();
        assertThat(request.getDocument().getTitle()).isEqualTo("Test Document");
    }

    @Test
    void shouldSetDocumentToNull() {
        PdfGenerationRequest request = new PdfGenerationRequest();
        DocumentModel document = new DocumentModel();
        request.setDocument(document);
        
        request.setDocument(null);
        
        assertThat(request.getDocument()).isNull();
    }

    @Test
    void shouldHandleDocumentWithSections() {
        PdfGenerationRequest request = new PdfGenerationRequest();
        DocumentModel document = new DocumentModel();
        document.setTitle("Report");
        
        request.setDocument(document);
        
        assertThat(request.getDocument().getSections()).isEmpty();
    }
}
