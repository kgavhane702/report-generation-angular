package com.org.report_generator.importing.controller;

import com.org.report_generator.config.ImportLimitsConfig;
import com.org.report_generator.importing.enums.ImportFormat;
import com.org.report_generator.importing.model.TabularDataset;
import com.org.report_generator.importing.service.TabularImportService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(TabularImportController.class)
class TabularImportControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private TabularImportService tabularImportService;

    @MockitoBean
    private ImportLimitsConfig limitsConfig;

    @Test
    void importTabular_withValidFile_returnsSuccess() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
            "file", "test.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "test content".getBytes()
        );
        
        TabularDataset dataset = new TabularDataset(List.of(), List.of(), List.of());
        
        when(limitsConfig.getMaxFileSizeBytes()).thenReturn(10_000_000L);
        when(tabularImportService.importDataset(any(), eq(ImportFormat.XLSX), any())).thenReturn(dataset);
        
        mockMvc.perform(multipart("/api/import/tabular")
                .file(file)
                .contentType(MediaType.MULTIPART_FORM_DATA))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.dataset").exists());
    }

    @Test
    void importTabular_withCsvFormat_returnsSuccess() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
            "file", "test.csv", "text/csv",
            "a,b\n1,2".getBytes()
        );
        
        TabularDataset dataset = new TabularDataset(List.of(), List.of(), List.of());
        
        when(limitsConfig.getMaxFileSizeBytes()).thenReturn(10_000_000L);
        when(tabularImportService.importDataset(any(), eq(ImportFormat.CSV), any())).thenReturn(dataset);
        
        mockMvc.perform(multipart("/api/import/tabular")
                .file(file)
                .param("format", "CSV")
                .contentType(MediaType.MULTIPART_FORM_DATA))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    void importTabular_withEmptyFile_returnsBadRequest() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
            "file", "empty.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            new byte[0]
        );
        
        when(limitsConfig.getMaxFileSizeBytes()).thenReturn(10_000_000L);
        
        mockMvc.perform(multipart("/api/import/tabular")
                .file(file)
                .contentType(MediaType.MULTIPART_FORM_DATA))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    void importTabular_withFileTooLarge_returnsBadRequest() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
            "file", "large.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            new byte[1000]
        );
        
        when(limitsConfig.getMaxFileSizeBytes()).thenReturn(100L); // Set limit lower than file size
        
        mockMvc.perform(multipart("/api/import/tabular")
                .file(file)
                .contentType(MediaType.MULTIPART_FORM_DATA))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    void importTabular_withSheetIndex_passesToService() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
            "file", "test.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "test content".getBytes()
        );
        
        TabularDataset dataset = new TabularDataset(List.of(), List.of(), List.of());
        
        when(limitsConfig.getMaxFileSizeBytes()).thenReturn(10_000_000L);
        when(tabularImportService.importDataset(any(), eq(ImportFormat.XLSX), any())).thenReturn(dataset);
        
        mockMvc.perform(multipart("/api/import/tabular")
                .file(file)
                .param("sheetIndex", "2")
                .contentType(MediaType.MULTIPART_FORM_DATA))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true));
    }
}
