package com.org.report_generator.export;

import com.org.report_generator.config.PdfExportProperties;
import com.org.report_generator.model.document.DocumentModel;
import com.org.report_generator.render.html.HtmlDocumentRenderer;
import com.org.report_generator.service.PdfGeneratorService;
import com.org.report_generator.service.UiPdfGeneratorService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PdfExporterTest {

    @Mock
    private HtmlDocumentRenderer htmlRenderer;

    @Mock
    private PdfGeneratorService pdfGeneratorService;

    @Mock
    private UiPdfGeneratorService uiPdfGeneratorService;

    @Mock
    private PdfExportProperties pdfExportProperties;

    private PdfExporter pdfExporter;

    @BeforeEach
    void setUp() {
        pdfExporter = new PdfExporter(htmlRenderer, pdfGeneratorService, uiPdfGeneratorService, pdfExportProperties);
    }

    @Test
    void format_shouldReturnPdf() {
        assertThat(pdfExporter.format()).isEqualTo(ExportFormat.PDF);
    }

    @Test
    void export_shouldUseBackendRenderer_whenPropertiesNull() {
        PdfExporter exporter = new PdfExporter(htmlRenderer, pdfGeneratorService, uiPdfGeneratorService, null);
        DocumentModel document = new DocumentModel();
        byte[] expectedPdf = "PDF content".getBytes();
        
        when(htmlRenderer.render(any(DocumentModel.class))).thenReturn("<html></html>");
        when(pdfGeneratorService.generatePdf(anyString(), any(DocumentModel.class))).thenReturn(expectedPdf);
        
        ExportResult result = exporter.export(document);
        
        assertThat(result.bytes()).isEqualTo(expectedPdf);
        assertThat(result.mediaType()).isEqualTo(MediaType.APPLICATION_PDF);
        assertThat(result.fileExtension()).isEqualTo("pdf");
        verify(htmlRenderer).render(document);
        verify(pdfGeneratorService).generatePdf(anyString(), any(DocumentModel.class));
    }

    @Test
    void export_shouldUseBackendRenderer_whenRendererIsBackend() {
        DocumentModel document = new DocumentModel();
        byte[] expectedPdf = "Backend PDF".getBytes();
        
        when(pdfExportProperties.getRenderer()).thenReturn(PdfExportProperties.Renderer.BACKEND);
        when(htmlRenderer.render(any(DocumentModel.class))).thenReturn("<html></html>");
        when(pdfGeneratorService.generatePdf(anyString(), any(DocumentModel.class))).thenReturn(expectedPdf);
        
        ExportResult result = pdfExporter.export(document);
        
        assertThat(result.bytes()).isEqualTo(expectedPdf);
        verify(htmlRenderer).render(document);
        verify(pdfGeneratorService).generatePdf(anyString(), any(DocumentModel.class));
    }

    @Test
    void export_shouldUseUiRenderer_whenRendererIsUi() {
        DocumentModel document = new DocumentModel();
        byte[] expectedPdf = "UI PDF".getBytes();
        
        when(pdfExportProperties.getRenderer()).thenReturn(PdfExportProperties.Renderer.UI);
        when(uiPdfGeneratorService.generatePdfFromUi(any(DocumentModel.class))).thenReturn(expectedPdf);
        
        ExportResult result = pdfExporter.export(document);
        
        assertThat(result.bytes()).isEqualTo(expectedPdf);
        verify(uiPdfGeneratorService).generatePdfFromUi(document);
    }

    @Test
    void export_shouldReturnPdfMediaType() {
        DocumentModel document = new DocumentModel();
        
        when(pdfExportProperties.getRenderer()).thenReturn(PdfExportProperties.Renderer.UI);
        when(uiPdfGeneratorService.generatePdfFromUi(any(DocumentModel.class))).thenReturn(new byte[0]);
        
        ExportResult result = pdfExporter.export(document);
        
        assertThat(result.mediaType()).isEqualTo(MediaType.APPLICATION_PDF);
    }

    @Test
    void export_shouldReturnPdfFileExtension() {
        DocumentModel document = new DocumentModel();
        
        when(pdfExportProperties.getRenderer()).thenReturn(PdfExportProperties.Renderer.UI);
        when(uiPdfGeneratorService.generatePdfFromUi(any(DocumentModel.class))).thenReturn(new byte[0]);
        
        ExportResult result = pdfExporter.export(document);
        
        assertThat(result.fileExtension()).isEqualTo("pdf");
    }
}
