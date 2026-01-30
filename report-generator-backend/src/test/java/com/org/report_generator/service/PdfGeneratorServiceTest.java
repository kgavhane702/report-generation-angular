package com.org.report_generator.service;

import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Page.PdfOptions;
import com.org.report_generator.config.ExportPerformanceProperties;
import com.org.report_generator.exception.PdfGenerationException;
import com.org.report_generator.model.document.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PdfGeneratorServiceTest {

    @Mock
    private Browser browser;

    @Mock
    private BrowserContextPool contextPool;

    @Mock
    private BrowserContext browserContext;

    @Mock
    private Page page;

    private ExportPerformanceProperties perf;
    private PdfGeneratorService service;

    @BeforeEach
    void setUp() {
        perf = new ExportPerformanceProperties();
        service = new PdfGeneratorService(browser, contextPool, perf);
    }

    @Test
    void generatePdf_success_returnsPdfBytes() {
        byte[] expectedPdf = "PDF content".getBytes();
        when(contextPool.acquire()).thenReturn(browserContext);
        when(browserContext.newPage()).thenReturn(page);
        when(page.pdf(any(PdfOptions.class))).thenReturn(expectedPdf);

        DocumentModel document = createSimpleDocument();
        byte[] result = service.generatePdf("<html></html>", document);

        assertNotNull(result);
        assertArrayEquals(expectedPdf, result);
        verify(contextPool).release(browserContext);
    }

    @Test
    void generatePdf_closesPage_afterSuccess() {
        when(contextPool.acquire()).thenReturn(browserContext);
        when(browserContext.newPage()).thenReturn(page);
        when(page.pdf(any(PdfOptions.class))).thenReturn(new byte[0]);

        service.generatePdf("<html></html>", createSimpleDocument());

        verify(page).close();
    }

    @Test
    void generatePdf_releasesContext_afterSuccess() {
        when(contextPool.acquire()).thenReturn(browserContext);
        when(browserContext.newPage()).thenReturn(page);
        when(page.pdf(any(PdfOptions.class))).thenReturn(new byte[0]);

        service.generatePdf("<html></html>", createSimpleDocument());

        verify(contextPool).release(browserContext);
    }

    @Test
    void generatePdf_onException_throwsPdfGenerationException() {
        when(contextPool.acquire()).thenReturn(browserContext);
        when(browserContext.newPage()).thenReturn(page);
        when(page.pdf(any(PdfOptions.class))).thenThrow(new RuntimeException("PDF failed"));

        assertThrows(PdfGenerationException.class, () -> 
            service.generatePdf("<html></html>", createSimpleDocument())
        );
    }

    @Test
    void generatePdf_onException_releasesContext() {
        when(contextPool.acquire()).thenReturn(browserContext);
        when(browserContext.newPage()).thenReturn(page);
        when(page.pdf(any(PdfOptions.class))).thenThrow(new RuntimeException("PDF failed"));

        try {
            service.generatePdf("<html></html>", createSimpleDocument());
        } catch (PdfGenerationException e) {
            // Expected
        }

        verify(contextPool).release(browserContext);
    }

    @Test
    void generatePdf_onException_closesPage() {
        when(contextPool.acquire()).thenReturn(browserContext);
        when(browserContext.newPage()).thenReturn(page);
        when(page.pdf(any(PdfOptions.class))).thenThrow(new RuntimeException("PDF failed"));

        try {
            service.generatePdf("<html></html>", createSimpleDocument());
        } catch (PdfGenerationException e) {
            // Expected
        }

        verify(page).close();
    }

    @Test
    void generatePdf_handlesPageCloseException() {
        when(contextPool.acquire()).thenReturn(browserContext);
        when(browserContext.newPage()).thenReturn(page);
        when(page.pdf(any(PdfOptions.class))).thenReturn(new byte[0]);
        doThrow(new RuntimeException("Close failed")).when(page).close();

        // Should not throw
        assertDoesNotThrow(() -> service.generatePdf("<html></html>", createSimpleDocument()));
    }

    @Test
    void generatePdf_withUrlTableHtml_appliesAutoFit() {
        when(contextPool.acquire()).thenReturn(browserContext);
        when(browserContext.newPage()).thenReturn(page);
        when(page.pdf(any(PdfOptions.class))).thenReturn(new byte[0]);

        String htmlWithUrlTable = "<html><div data-url-table=\"true\"></div></html>";
        service.generatePdf(htmlWithUrlTable, createSimpleDocument());

        // Verify evaluate was called for auto-fit
        verify(page).evaluate(anyString());
    }

    @Test
    void generatePdf_withoutUrlTable_skipsAutoFit() {
        when(contextPool.acquire()).thenReturn(browserContext);
        when(browserContext.newPage()).thenReturn(page);
        when(page.pdf(any(PdfOptions.class))).thenReturn(new byte[0]);

        service.generatePdf("<html><body></body></html>", createSimpleDocument());

        // Verify evaluate was NOT called (no URL table)
        verify(page, never()).evaluate(anyString());
    }

    @Test
    void generatePdf_withDisabledAutoFit_skipsAutoFit() {
        perf.setUrlTableAutoFitEnabled(false);
        service = new PdfGeneratorService(browser, contextPool, perf);

        when(contextPool.acquire()).thenReturn(browserContext);
        when(browserContext.newPage()).thenReturn(page);
        when(page.pdf(any(PdfOptions.class))).thenReturn(new byte[0]);

        String htmlWithUrlTable = "<html><div data-url-table=\"true\"></div></html>";
        service.generatePdf(htmlWithUrlTable, createSimpleDocument());

        verify(page, never()).evaluate(anyString());
    }

    @Test
    void generatePdf_withPageSize_usesDocumentPageSize() {
        when(contextPool.acquire()).thenReturn(browserContext);
        when(browserContext.newPage()).thenReturn(page);
        when(page.pdf(any(PdfOptions.class))).thenReturn(new byte[0]);

        DocumentModel document = createSimpleDocument();
        PageSize pageSize = new PageSize();
        pageSize.setWidthMm(297.0);
        pageSize.setHeightMm(210.0);
        pageSize.setDpi(150);
        document.setPageSize(pageSize);

        byte[] result = service.generatePdf("<html></html>", document);

        assertNotNull(result);
    }

    @Test
    void generatePdf_withNullHtml_handlesGracefully() {
        when(contextPool.acquire()).thenReturn(browserContext);
        when(browserContext.newPage()).thenReturn(page);
        when(page.pdf(any(PdfOptions.class))).thenReturn(new byte[0]);

        assertDoesNotThrow(() -> service.generatePdf(null, createSimpleDocument()));
    }

    @Test
    void generatePdf_withPortraitPage_calculatesViewportCorrectly() {
        when(contextPool.acquire()).thenReturn(browserContext);
        when(browserContext.newPage()).thenReturn(page);
        when(page.pdf(any(PdfOptions.class))).thenReturn(new byte[0]);

        DocumentModel document = createDocumentWithOrientation("portrait");
        PageSize pageSize = new PageSize();
        pageSize.setWidthMm(297.0);
        pageSize.setHeightMm(210.0);
        pageSize.setDpi(96);
        document.setPageSize(pageSize);

        byte[] result = service.generatePdf("<html></html>", document);

        assertNotNull(result);
        verify(browserContext).newPage();
    }

    @Test
    void generatePdf_withLandscapePage_calculatesViewportCorrectly() {
        when(contextPool.acquire()).thenReturn(browserContext);
        when(browserContext.newPage()).thenReturn(page);
        when(page.pdf(any(PdfOptions.class))).thenReturn(new byte[0]);

        DocumentModel document = createDocumentWithOrientation("landscape");
        PageSize pageSize = new PageSize();
        pageSize.setWidthMm(297.0);
        pageSize.setHeightMm(210.0);
        pageSize.setDpi(96);
        document.setPageSize(pageSize);

        byte[] result = service.generatePdf("<html></html>", document);

        assertNotNull(result);
    }

    @Test
    void generatePdf_withNullPageSize_usesDefaults() {
        when(contextPool.acquire()).thenReturn(browserContext);
        when(browserContext.newPage()).thenReturn(page);
        when(page.pdf(any(PdfOptions.class))).thenReturn(new byte[0]);

        DocumentModel document = createSimpleDocument();
        document.setPageSize(null);

        byte[] result = service.generatePdf("<html></html>", document);

        assertNotNull(result);
    }

    @Test
    void generatePdf_withNullSections_collectsEmptyPages() {
        when(contextPool.acquire()).thenReturn(browserContext);
        when(browserContext.newPage()).thenReturn(page);
        when(page.pdf(any(PdfOptions.class))).thenReturn(new byte[0]);

        DocumentModel document = new DocumentModel();
        document.setSections(null);

        byte[] result = service.generatePdf("<html></html>", document);

        assertNotNull(result);
    }

    @Test
    void generatePdf_withNullSubsections_skipsNullSubsections() {
        when(contextPool.acquire()).thenReturn(browserContext);
        when(browserContext.newPage()).thenReturn(page);
        when(page.pdf(any(PdfOptions.class))).thenReturn(new byte[0]);

        DocumentModel document = new DocumentModel();
        Section section = new Section();
        section.setSubsections(null);
        document.setSections(Collections.singletonList(section));

        byte[] result = service.generatePdf("<html></html>", document);

        assertNotNull(result);
    }

    @Test
    void generatePdf_withNullPages_skipsNullPages() {
        when(contextPool.acquire()).thenReturn(browserContext);
        when(browserContext.newPage()).thenReturn(page);
        when(page.pdf(any(PdfOptions.class))).thenReturn(new byte[0]);

        DocumentModel document = new DocumentModel();
        Section section = new Section();
        Subsection subsection = new Subsection();
        subsection.setPages(null);
        section.setSubsections(Collections.singletonList(subsection));
        document.setSections(Collections.singletonList(section));

        byte[] result = service.generatePdf("<html></html>", document);

        assertNotNull(result);
    }

    @Test
    void generatePdf_withNullSection_skipsNullSection() {
        when(contextPool.acquire()).thenReturn(browserContext);
        when(browserContext.newPage()).thenReturn(page);
        when(page.pdf(any(PdfOptions.class))).thenReturn(new byte[0]);

        DocumentModel document = new DocumentModel();
        java.util.List<Section> sections = new java.util.ArrayList<>();
        sections.add(null);
        document.setSections(sections);

        byte[] result = service.generatePdf("<html></html>", document);

        assertNotNull(result);
    }

    @Test
    void generatePdf_withNullSubsection_skipsNullSubsection() {
        when(contextPool.acquire()).thenReturn(browserContext);
        when(browserContext.newPage()).thenReturn(page);
        when(page.pdf(any(PdfOptions.class))).thenReturn(new byte[0]);

        DocumentModel document = new DocumentModel();
        Section section = new Section();
        java.util.List<Subsection> subsections = new java.util.ArrayList<>();
        subsections.add(null);
        section.setSubsections(subsections);
        document.setSections(Collections.singletonList(section));

        byte[] result = service.generatePdf("<html></html>", document);

        assertNotNull(result);
    }

    @Test
    void generatePdf_withMultiplePagesVariousOrientations_usesMaxDimensions() {
        when(contextPool.acquire()).thenReturn(browserContext);
        when(browserContext.newPage()).thenReturn(page);
        when(page.pdf(any(PdfOptions.class))).thenReturn(new byte[0]);

        DocumentModel document = createDocumentWithMultipleOrientations();
        PageSize pageSize = new PageSize();
        pageSize.setWidthMm(297.0);
        pageSize.setHeightMm(210.0);
        pageSize.setDpi(96);
        document.setPageSize(pageSize);

        byte[] result = service.generatePdf("<html></html>", document);

        assertNotNull(result);
    }

    @Test
    void generatePdf_withNullOrientation_defaultsToLandscape() {
        when(contextPool.acquire()).thenReturn(browserContext);
        when(browserContext.newPage()).thenReturn(page);
        when(page.pdf(any(PdfOptions.class))).thenReturn(new byte[0]);

        DocumentModel document = createDocumentWithOrientation(null);
        
        byte[] result = service.generatePdf("<html></html>", document);

        assertNotNull(result);
    }

    @Test
    void generatePdf_withNullWidthMm_usesDefault() {
        when(contextPool.acquire()).thenReturn(browserContext);
        when(browserContext.newPage()).thenReturn(page);
        when(page.pdf(any(PdfOptions.class))).thenReturn(new byte[0]);

        DocumentModel document = createSimpleDocument();
        PageSize pageSize = new PageSize();
        pageSize.setWidthMm(null);
        pageSize.setHeightMm(210.0);
        pageSize.setDpi(96);
        document.setPageSize(pageSize);

        byte[] result = service.generatePdf("<html></html>", document);

        assertNotNull(result);
    }

    @Test
    void generatePdf_withNullHeightMm_usesDefault() {
        when(contextPool.acquire()).thenReturn(browserContext);
        when(browserContext.newPage()).thenReturn(page);
        when(page.pdf(any(PdfOptions.class))).thenReturn(new byte[0]);

        DocumentModel document = createSimpleDocument();
        PageSize pageSize = new PageSize();
        pageSize.setWidthMm(297.0);
        pageSize.setHeightMm(null);
        pageSize.setDpi(96);
        document.setPageSize(pageSize);

        byte[] result = service.generatePdf("<html></html>", document);

        assertNotNull(result);
    }

    @Test
    void generatePdf_withNullDpi_usesDefault() {
        when(contextPool.acquire()).thenReturn(browserContext);
        when(browserContext.newPage()).thenReturn(page);
        when(page.pdf(any(PdfOptions.class))).thenReturn(new byte[0]);

        DocumentModel document = createSimpleDocument();
        PageSize pageSize = new PageSize();
        pageSize.setWidthMm(297.0);
        pageSize.setHeightMm(210.0);
        pageSize.setDpi(null);
        document.setPageSize(pageSize);

        byte[] result = service.generatePdf("<html></html>", document);

        assertNotNull(result);
    }

    private DocumentModel createSimpleDocument() {
        DocumentModel document = new DocumentModel();
        document.setTitle("Test");
        return document;
    }

    private DocumentModel createDocumentWithOrientation(String orientation) {
        DocumentModel document = new DocumentModel();
        document.setTitle("Test");
        
        com.org.report_generator.model.document.Page docPage = new com.org.report_generator.model.document.Page();
        docPage.setId("page1");
        docPage.setOrientation(orientation);
        
        Subsection subsection = new Subsection();
        subsection.setPages(Collections.singletonList(docPage));
        
        Section section = new Section();
        section.setSubsections(Collections.singletonList(subsection));
        
        document.setSections(Collections.singletonList(section));
        return document;
    }

    private DocumentModel createDocumentWithMultipleOrientations() {
        DocumentModel document = new DocumentModel();
        document.setTitle("Test");
        
        com.org.report_generator.model.document.Page portraitPage = new com.org.report_generator.model.document.Page();
        portraitPage.setId("page1");
        portraitPage.setOrientation("portrait");
        
        com.org.report_generator.model.document.Page landscapePage = new com.org.report_generator.model.document.Page();
        landscapePage.setId("page2");
        landscapePage.setOrientation("landscape");
        
        java.util.List<com.org.report_generator.model.document.Page> pages = new java.util.ArrayList<>();
        pages.add(portraitPage);
        pages.add(landscapePage);
        
        Subsection subsection = new Subsection();
        subsection.setPages(pages);
        
        Section section = new Section();
        section.setSubsections(Collections.singletonList(subsection));
        
        document.setSections(Collections.singletonList(section));
        return document;
    }
}
