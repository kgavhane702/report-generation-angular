package com.org.report_generator.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.org.report_generator.config.ImportLimitsConfig;
import com.org.report_generator.dto.http.EditastraImportFromUrlRequest;
import com.org.report_generator.dto.http.HttpRequestSpecDto;
import com.org.report_generator.dto.http.HttpMethod;
import com.org.report_generator.exception.ApiExceptionHandler;
import com.org.report_generator.importing.enums.ImportFormat;
import com.org.report_generator.importing.model.ImportOptions;
import com.org.report_generator.importing.model.TabularCell;
import com.org.report_generator.importing.model.TabularDataset;
import com.org.report_generator.importing.model.TabularRow;
import com.org.report_generator.importing.service.FormatDetector;
import com.org.report_generator.importing.service.RemoteHttpFetchResult;
import com.org.report_generator.importing.service.RemoteHttpFetcherService;
import com.org.report_generator.importing.service.TabularImportService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(EditastraImportController.class)
@Import(ApiExceptionHandler.class)
class EditastraImportControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private TabularImportService tabularImportService;

    @MockitoBean
    private ImportLimitsConfig limitsConfig;

    @MockitoBean
    private RemoteHttpFetcherService remoteFetcher;

    @MockitoBean
    private FormatDetector formatDetector;

    @Test
    void importFromUrl_flattensDatasetToHtml() throws Exception {
        Mockito.when(limitsConfig.getMaxFileSizeBytes()).thenReturn(1024L * 1024);
        Mockito.when(remoteFetcher.fetch(any(), any())).thenReturn(new RemoteHttpFetchResult(
                "http://example.com/data.csv",
                "text/csv",
                "data.csv",
                "A,B\n1,2".getBytes()
        ));
        Mockito.when(formatDetector.detect(any(), any(), any(), any())).thenReturn(ImportFormat.CSV);

        TabularDataset dataset = new TabularDataset(
                List.of(
                        new TabularRow("r-0", List.of(
                                new TabularCell("0-0", "A", null, null),
                                new TabularCell("0-1", "B", null, null)
                        )),
                        new TabularRow("r-1", List.of(
                                new TabularCell("1-0", "1", null, null),
                                new TabularCell("1-1", "2", null, null)
                        ))
                ),
                List.of(0.5, 0.5),
                List.of(0.5, 0.5)
        );

        Mockito.when(tabularImportService.importDataset(any(), eq(ImportFormat.CSV), any(ImportOptions.class)))
                .thenReturn(dataset);

        EditastraImportFromUrlRequest req = new EditastraImportFromUrlRequest(
                new HttpRequestSpecDto("http://example.com/data.csv", HttpMethod.GET, null, null, null, null, null, null, null, null),
                ImportFormat.CSV,
                null,
                null
        );

        mockMvc.perform(post("/api/editastra/import/url")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.contentHtml").value("<div>A&nbsp;|&nbsp;B</div><div>1&nbsp;|&nbsp;2</div>"));
    }
}
