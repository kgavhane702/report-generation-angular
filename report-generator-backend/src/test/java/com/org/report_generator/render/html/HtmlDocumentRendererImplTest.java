package com.org.report_generator.render.html;

import com.org.report_generator.model.document.DocumentModel;
import com.org.report_generator.service.DocumentRenderService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class HtmlDocumentRendererImplTest {

    @Mock
    private DocumentRenderService delegate;

    private HtmlDocumentRendererImpl renderer;

    @BeforeEach
    void setUp() {
        renderer = new HtmlDocumentRendererImpl(delegate);
    }

    @Test
    void render_delegatesToDocumentRenderService() {
        DocumentModel document = new DocumentModel();
        document.setTitle("Test Document");
        String expectedHtml = "<html><body>Test</body></html>";
        
        when(delegate.render(any(DocumentModel.class))).thenReturn(expectedHtml);
        
        String result = renderer.render(document);
        
        assertThat(result).isEqualTo(expectedHtml);
        verify(delegate).render(document);
    }

    @Test
    void render_withNullDocument_delegatesToService() {
        when(delegate.render(null)).thenReturn("");
        
        String result = renderer.render(null);
        
        assertThat(result).isEmpty();
        verify(delegate).render(null);
    }

    @Test
    void render_withEmptyDocument_delegatesToService() {
        DocumentModel document = new DocumentModel();
        String expectedHtml = "<html><body></body></html>";
        
        when(delegate.render(any(DocumentModel.class))).thenReturn(expectedHtml);
        
        String result = renderer.render(document);
        
        assertThat(result).isEqualTo(expectedHtml);
    }
}
