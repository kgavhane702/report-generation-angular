package com.org.report_generator.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Page.PdfOptions;
import com.org.report_generator.config.PdfExportProperties;
import com.org.report_generator.exception.PdfGenerationException;
import com.org.report_generator.exception.PdfGenerationTimeoutException;
import com.org.report_generator.model.document.DocumentModel;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UiPdfGeneratorServiceTest {

    @Mock
    private BrowserContextPool contextPool;

    @Mock
    private BrowserContext browserContext;

    @Mock
    private Page page;

    private PdfExportProperties props;
    private ObjectMapper objectMapper;
    private UiPdfGeneratorService service;

    @BeforeEach
    void setUp() {
        props = new PdfExportProperties();
        props.setUiBaseUrl("http://localhost:4200");
        props.setUiExportPath("/export");
        props.setUiReadyTimeoutMs(5000);
        props.setUiNavigationTimeoutMs(5000);
        objectMapper = new ObjectMapper();
        service = new UiPdfGeneratorService(contextPool, props, objectMapper);
    }

    @Test
    void generatePdfFromUi_success_returnsPdfBytes() {
        byte[] expectedPdf = "PDF content".getBytes();
        when(contextPool.acquire()).thenReturn(browserContext);
        when(browserContext.newPage()).thenReturn(page);
        when(page.pdf(any(PdfOptions.class))).thenReturn(expectedPdf);

        DocumentModel document = createSimpleDocument();
        byte[] result = service.generatePdfFromUi(document);

        assertNotNull(result);
        assertArrayEquals(expectedPdf, result);
    }

    @Test
    void generatePdfFromUi_releasesContext_afterSuccess() {
        when(contextPool.acquire()).thenReturn(browserContext);
        when(browserContext.newPage()).thenReturn(page);
        when(page.pdf(any(PdfOptions.class))).thenReturn(new byte[0]);

        service.generatePdfFromUi(createSimpleDocument());

        verify(contextPool).release(browserContext);
    }

    @Test
    void generatePdfFromUi_closesPage_afterSuccess() {
        when(contextPool.acquire()).thenReturn(browserContext);
        when(browserContext.newPage()).thenReturn(page);
        when(page.pdf(any(PdfOptions.class))).thenReturn(new byte[0]);

        service.generatePdfFromUi(createSimpleDocument());

        verify(page).close();
    }

    @Test
    void generatePdfFromUi_injectsDocumentScript() {
        when(contextPool.acquire()).thenReturn(browserContext);
        when(browserContext.newPage()).thenReturn(page);
        when(page.pdf(any(PdfOptions.class))).thenReturn(new byte[0]);

        service.generatePdfFromUi(createSimpleDocument());

        verify(page).addInitScript(contains("__RG_EXPORT_DOC__"));
    }

    @Test
    void generatePdfFromUi_navigatesToExportUrl() {
        when(contextPool.acquire()).thenReturn(browserContext);
        when(browserContext.newPage()).thenReturn(page);
        when(page.pdf(any(PdfOptions.class))).thenReturn(new byte[0]);

        service.generatePdfFromUi(createSimpleDocument());

        verify(page).navigate(eq("http://localhost:4200/export"), any(Page.NavigateOptions.class));
    }

    @Test
    void generatePdfFromUi_waitsForExportReady() {
        when(contextPool.acquire()).thenReturn(browserContext);
        when(browserContext.newPage()).thenReturn(page);
        when(page.pdf(any(PdfOptions.class))).thenReturn(new byte[0]);

        service.generatePdfFromUi(createSimpleDocument());

        verify(page).waitForFunction(contains("__RG_EXPORT_READY__"), any(), any(Page.WaitForFunctionOptions.class));
    }

    @Test
    void generatePdfFromUi_onException_throwsPdfGenerationException() {
        when(contextPool.acquire()).thenReturn(browserContext);
        when(browserContext.newPage()).thenReturn(page);
        when(page.pdf(any(PdfOptions.class))).thenThrow(new RuntimeException("PDF failed"));

        assertThrows(PdfGenerationException.class, () -> 
            service.generatePdfFromUi(createSimpleDocument())
        );
    }

    @Test
    void generatePdfFromUi_onException_releasesContext() {
        when(contextPool.acquire()).thenReturn(browserContext);
        when(browserContext.newPage()).thenReturn(page);
        when(page.pdf(any(PdfOptions.class))).thenThrow(new RuntimeException("PDF failed"));

        try {
            service.generatePdfFromUi(createSimpleDocument());
        } catch (PdfGenerationException e) {
            // Expected
        }

        verify(contextPool).release(browserContext);
    }

    @Test
    void generatePdfFromUi_onException_closesPage() {
        when(contextPool.acquire()).thenReturn(browserContext);
        when(browserContext.newPage()).thenReturn(page);
        when(page.pdf(any(PdfOptions.class))).thenThrow(new RuntimeException("PDF failed"));

        try {
            service.generatePdfFromUi(createSimpleDocument());
        } catch (PdfGenerationException e) {
            // Expected
        }

        verify(page).close();
    }

    @Test
    void generatePdfFromUi_handlesPageCloseException() {
        when(contextPool.acquire()).thenReturn(browserContext);
        when(browserContext.newPage()).thenReturn(page);
        when(page.pdf(any(PdfOptions.class))).thenReturn(new byte[0]);
        doThrow(new RuntimeException("Close failed")).when(page).close();

        // Should not throw
        assertDoesNotThrow(() -> service.generatePdfFromUi(createSimpleDocument()));
    }

    @Test
    void generatePdfFromUi_onTimeout_throwsPdfGenerationException() {
        when(contextPool.acquire()).thenReturn(browserContext);
        when(browserContext.newPage()).thenReturn(page);
        when(page.waitForFunction(anyString(), any(), any(Page.WaitForFunctionOptions.class)))
            .thenThrow(new com.microsoft.playwright.TimeoutError("Timeout"));

        PdfGenerationException ex = assertThrows(PdfGenerationException.class, () -> 
            service.generatePdfFromUi(createSimpleDocument())
        );
        // The cause should be PdfGenerationTimeoutException
        assertNotNull(ex.getCause());
        assertTrue(ex.getCause() instanceof PdfGenerationTimeoutException);
    }

    @Test
    void generatePdfFromUi_blankUiBaseUrl_throwsException() {
        props.setUiBaseUrl("");
        service = new UiPdfGeneratorService(contextPool, props, objectMapper);

        when(contextPool.acquire()).thenReturn(browserContext);
        when(browserContext.newPage()).thenReturn(page);

        assertThrows(PdfGenerationException.class, () -> 
            service.generatePdfFromUi(createSimpleDocument())
        );
    }

    @Test
    void generatePdfFromUi_nullUiBaseUrl_throwsException() {
        props.setUiBaseUrl(null);
        service = new UiPdfGeneratorService(contextPool, props, objectMapper);

        when(contextPool.acquire()).thenReturn(browserContext);
        when(browserContext.newPage()).thenReturn(page);

        assertThrows(PdfGenerationException.class, () -> 
            service.generatePdfFromUi(createSimpleDocument())
        );
    }

    @Test
    void generatePdfFromUi_blankExportPath_usesDefaultPath() {
        props.setUiExportPath("");
        service = new UiPdfGeneratorService(contextPool, props, objectMapper);

        when(contextPool.acquire()).thenReturn(browserContext);
        when(browserContext.newPage()).thenReturn(page);
        when(page.pdf(any(PdfOptions.class))).thenReturn(new byte[0]);

        service.generatePdfFromUi(createSimpleDocument());

        verify(page).navigate(contains("/export"), any(Page.NavigateOptions.class));
    }

    @Test
    void generatePdfFromUi_customExportPath_usesCustomPath() {
        props.setUiExportPath("/custom-export");
        service = new UiPdfGeneratorService(contextPool, props, objectMapper);

        when(contextPool.acquire()).thenReturn(browserContext);
        when(browserContext.newPage()).thenReturn(page);
        when(page.pdf(any(PdfOptions.class))).thenReturn(new byte[0]);

        service.generatePdfFromUi(createSimpleDocument());

        verify(page).navigate(eq("http://localhost:4200/custom-export"), any(Page.NavigateOptions.class));
    }

    private DocumentModel createSimpleDocument() {
        DocumentModel document = new DocumentModel();
        document.setTitle("Test Document");
        return document;
    }
}
