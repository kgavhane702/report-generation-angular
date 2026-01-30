package com.org.report_generator.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.org.report_generator.dto.PdfGenerationRequest;
import com.org.report_generator.export.DocumentExporter;
import com.org.report_generator.export.ExportFormat;
import com.org.report_generator.export.ExportResult;
import com.org.report_generator.export.ExporterRegistry;
import com.org.report_generator.model.document.DocumentModel;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(DocumentExportController.class)
class DocumentExportControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private ExporterRegistry exporterRegistry;

    @Test
    void healthEndpoint_returnsOk() throws Exception {
        mockMvc.perform(get("/api/document/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"));
    }

    @Test
    void exportPdf_returnsAttachment() throws Exception {
        DocumentExporter exporter = Mockito.mock(DocumentExporter.class);
        Mockito.when(exporterRegistry.get(eq(ExportFormat.PDF))).thenReturn(exporter);
        Mockito.when(exporter.export(any())).thenReturn(new ExportResult(
                "PDF".getBytes(),
                MediaType.APPLICATION_PDF,
                "pdf"
        ));

        PdfGenerationRequest req = new PdfGenerationRequest(new DocumentModel());
        req.getDocument().setTitle("Test Doc");

        mockMvc.perform(post("/api/document/export?format=pdf")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_PDF))
                .andExpect(header().string("Content-Disposition", containsString("attachment; filename=\"")))
                .andExpect(header().string("Content-Disposition", containsString(".pdf\"")));
    }
}
