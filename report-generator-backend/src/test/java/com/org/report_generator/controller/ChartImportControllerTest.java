package com.org.report_generator.controller;

import com.org.report_generator.config.ImportLimitsConfig;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.org.report_generator.dto.chart.ChartDataDto;
import com.org.report_generator.dto.chart.ChartImportAggregation;
import com.org.report_generator.dto.chart.ChartImportMappingDto;
import com.org.report_generator.dto.chart.ChartImportResponse;
import com.org.report_generator.dto.chart.ChartSeriesDto;
import com.org.report_generator.dto.chart.TabularPreviewDto;
import com.org.report_generator.dto.http.ChartImportFromUrlRequest;
import com.org.report_generator.dto.http.HttpMethod;
import com.org.report_generator.dto.http.HttpRequestSpecDto;
import com.org.report_generator.exception.ApiExceptionHandler;
import com.org.report_generator.importing.enums.ImportFormat;
import com.org.report_generator.importing.model.ImportOptions;
import com.org.report_generator.importing.model.TabularDataset;
import com.org.report_generator.importing.service.ChartImportService;
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
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ChartImportController.class)
@Import(ApiExceptionHandler.class)
class ChartImportControllerTest {

    @Autowired
    private MockMvc mockMvc;

        @Autowired
        private ObjectMapper objectMapper;

    @MockitoBean
    private TabularImportService tabularImportService;

    @MockitoBean
    private ChartImportService chartImportService;

    @MockitoBean
    private ImportLimitsConfig limitsConfig;

    @MockitoBean
    private RemoteHttpFetcherService remoteFetcher;

    @MockitoBean
    private FormatDetector formatDetector;

    @Test
    void importChart_success() throws Exception {
        Mockito.when(limitsConfig.getMaxFileSizeBytes()).thenReturn(1024L * 1024);
        Mockito.when(tabularImportService.importDataset(any(), eq(ImportFormat.CSV), any(ImportOptions.class)))
                .thenReturn(new TabularDataset(List.of(), List.of(), List.of()));

        ChartImportResponse response = new ChartImportResponse(
                new ChartDataDto("bar", List.of("A"), List.of(true), List.of(new ChartSeriesDto("S1", List.of(1d), null, null, null))),
                new ChartImportMappingDto(true, 0, 0, List.of(1), ChartImportAggregation.SUM),
                new TabularPreviewDto(1, 2, List.of(List.of("A", "1"))),
                List.of()
        );
        Mockito.when(chartImportService.importChart(any(), any())).thenReturn(response);

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "sample.csv",
                "text/csv",
                "A,1\n".getBytes()
        );

        mockMvc.perform(multipart("/api/import/chart")
                        .file(file)
                        .param("chartType", "bar"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.chartData.chartType").value("bar"));
    }

    @Test
    void importChart_detectsJsonFormatFromFilename() throws Exception {
        Mockito.when(limitsConfig.getMaxFileSizeBytes()).thenReturn(1024L * 1024);
        Mockito.when(tabularImportService.importDataset(any(), eq(ImportFormat.JSON), any(ImportOptions.class)))
                .thenReturn(new TabularDataset(List.of(), List.of(), List.of()));

        Mockito.when(chartImportService.importChart(any(), any())).thenReturn(sampleResponse("line"));

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "sample.json",
                "application/json",
                "[{\"a\":1}]".getBytes()
        );

        mockMvc.perform(multipart("/api/import/chart")
                        .file(file)
                        .param("chartType", "line"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        verify(tabularImportService).importDataset(any(), eq(ImportFormat.JSON), any(ImportOptions.class));
    }

    @Test
    void importChart_usesProvidedFormatParamOverFilename() throws Exception {
        Mockito.when(limitsConfig.getMaxFileSizeBytes()).thenReturn(1024L * 1024);
        Mockito.when(tabularImportService.importDataset(any(), eq(ImportFormat.XML), any(ImportOptions.class)))
                .thenReturn(new TabularDataset(List.of(), List.of(), List.of()));

        Mockito.when(chartImportService.importChart(any(), any())).thenReturn(sampleResponse("bar"));

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "sample.csv",
                "text/csv",
                "A,1\n".getBytes()
        );

        mockMvc.perform(multipart("/api/import/chart")
                        .file(file)
                        .param("chartType", "bar")
                        .param("format", "XML"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        verify(tabularImportService).importDataset(any(), eq(ImportFormat.XML), any(ImportOptions.class));
    }

    @Test
    void importChart_defaultsToXlsxWhenNoExtension() throws Exception {
        Mockito.when(limitsConfig.getMaxFileSizeBytes()).thenReturn(1024L * 1024);
        Mockito.when(tabularImportService.importDataset(any(), eq(ImportFormat.XLSX), any(ImportOptions.class)))
                .thenReturn(new TabularDataset(List.of(), List.of(), List.of()));

        Mockito.when(chartImportService.importChart(any(), any())).thenReturn(sampleResponse("bar"));

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "sample",
                "application/octet-stream",
                "not-really-xlsx".getBytes()
        );

        mockMvc.perform(multipart("/api/import/chart")
                        .file(file)
                        .param("chartType", "bar"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        verify(tabularImportService).importDataset(any(), eq(ImportFormat.XLSX), any(ImportOptions.class));
    }

    @Test
    void importChart_defaultsToXlsxWhenFilenameNull() throws Exception {
        Mockito.when(limitsConfig.getMaxFileSizeBytes()).thenReturn(1024L * 1024);
        Mockito.when(tabularImportService.importDataset(any(), eq(ImportFormat.XLSX), any(ImportOptions.class)))
                .thenReturn(new TabularDataset(List.of(), List.of(), List.of()));

        Mockito.when(chartImportService.importChart(any(), any())).thenReturn(sampleResponse("bar"));

        MockMultipartFile file = new MockMultipartFile(
                "file",
                null,
                "application/octet-stream",
                "not-really-xlsx".getBytes()
        );

        mockMvc.perform(multipart("/api/import/chart")
                        .file(file)
                        .param("chartType", "bar"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        verify(tabularImportService).importDataset(any(), eq(ImportFormat.XLSX), any(ImportOptions.class));
    }

    @Test
    void importChart_rejectsEmptyFile_returnsBadRequest() throws Exception {
        Mockito.when(limitsConfig.getMaxFileSizeBytes()).thenReturn(1024L * 1024);

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "empty.csv",
                "text/csv",
                new byte[0]
        );

        mockMvc.perform(multipart("/api/import/chart")
                        .file(file)
                        .param("chartType", "bar"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("BAD_REQUEST"));

        verify(tabularImportService, never()).importDataset(any(), any(), any());
        verify(chartImportService, never()).importChart(any(), any());
    }

    @Test
    void importChart_rejectsOversizedFile_returnsBadRequest() throws Exception {
        Mockito.when(limitsConfig.getMaxFileSizeBytes()).thenReturn(3L);

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "big.csv",
                "text/csv",
                "1234".getBytes()
        );

        mockMvc.perform(multipart("/api/import/chart")
                        .file(file)
                        .param("chartType", "bar"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("BAD_REQUEST"));
    }

    @Test
    void importChart_missingChartType_returnsBadRequest() throws Exception {
        Mockito.when(limitsConfig.getMaxFileSizeBytes()).thenReturn(1024L * 1024);

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "sample.csv",
                "text/csv",
                "A,1\n".getBytes()
        );

        mockMvc.perform(multipart("/api/import/chart")
                        .file(file)
                        .param("chartType", ""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("BAD_REQUEST"));
    }

    @Test
    void importChart_serviceThrows_returnsInternalError() throws Exception {
        Mockito.when(limitsConfig.getMaxFileSizeBytes()).thenReturn(1024L * 1024);
        Mockito.when(tabularImportService.importDataset(any(), eq(ImportFormat.CSV), any(ImportOptions.class)))
                .thenReturn(new TabularDataset(List.of(), List.of(), List.of()));
        Mockito.when(chartImportService.importChart(any(), any()))
                .thenThrow(new RuntimeException("boom"));

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "sample.csv",
                "text/csv",
                "A,1\n".getBytes()
        );

        mockMvc.perform(multipart("/api/import/chart")
                        .file(file)
                        .param("chartType", "bar"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("INTERNAL_ERROR"));
    }

    @Test
    void importChartFromUrl_success() throws Exception {
        Mockito.when(limitsConfig.getMaxFileSizeBytes()).thenReturn(1024L * 1024);

        RemoteHttpFetchResult fetched = new RemoteHttpFetchResult(
                "https://example.test/data.csv",
                "text/csv",
                "data.csv",
                "A,1\n".getBytes()
        );
        Mockito.when(remoteFetcher.fetch(any(), any())).thenReturn(fetched);
        Mockito.when(formatDetector.detect(any(), anyString(), anyString(), any())).thenReturn(ImportFormat.CSV);
        Mockito.when(tabularImportService.importDataset(any(), eq(ImportFormat.CSV), any(ImportOptions.class)))
                .thenReturn(new TabularDataset(List.of(), List.of(), List.of()));
        Mockito.when(chartImportService.importChart(any(), any())).thenReturn(sampleResponse("bar"));

        ChartImportFromUrlRequest body = new ChartImportFromUrlRequest(
                new HttpRequestSpecDto("https://example.test/data.csv", HttpMethod.GET, null, null, null, null, null, null, null, null),
                null,
                null,
                ",",
                "bar",
                true,
                0,
                0,
                List.of(1),
                ChartImportAggregation.SUM
        );

        mockMvc.perform(post("/api/import/chart/url")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    void importChartFromUrl_rejectsEmptyRemoteBytes_returnsBadRequest() throws Exception {
        Mockito.when(limitsConfig.getMaxFileSizeBytes()).thenReturn(1024L * 1024);

        RemoteHttpFetchResult fetched = new RemoteHttpFetchResult(
                "https://example.test/data.csv",
                "text/csv",
                "data.csv",
                new byte[0]
        );
        Mockito.when(remoteFetcher.fetch(any(), any())).thenReturn(fetched);
        Mockito.when(formatDetector.detect(any(), anyString(), anyString(), any())).thenReturn(ImportFormat.CSV);

        ChartImportFromUrlRequest body = new ChartImportFromUrlRequest(
                new HttpRequestSpecDto("https://example.test/data.csv", HttpMethod.GET, null, null, null, null, null, null, null, null),
                null,
                null,
                null,
                "bar",
                null,
                null,
                null,
                null,
                null
        );

        mockMvc.perform(post("/api/import/chart/url")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("BAD_REQUEST"));
    }

    @Test
    void importChartFromUrl_rejectsOversizedRemoteBytes_returnsBadRequest() throws Exception {
        Mockito.when(limitsConfig.getMaxFileSizeBytes()).thenReturn(3L);

        RemoteHttpFetchResult fetched = new RemoteHttpFetchResult(
                "https://example.test/data.csv",
                "text/csv",
                "data.csv",
                "1234".getBytes()
        );
        Mockito.when(remoteFetcher.fetch(any(), any())).thenReturn(fetched);
        Mockito.when(formatDetector.detect(any(), anyString(), anyString(), any())).thenReturn(ImportFormat.CSV);

        ChartImportFromUrlRequest body = new ChartImportFromUrlRequest(
                new HttpRequestSpecDto("https://example.test/data.csv", HttpMethod.GET, null, null, null, null, null, null, null, null),
                null,
                null,
                null,
                "bar",
                null,
                null,
                null,
                null,
                null
        );

        mockMvc.perform(post("/api/import/chart/url")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("BAD_REQUEST"));
    }

    @Test
    void importChartFromUrl_nullRequest_throwsIllegalArgument() {
        ChartImportController controller = new ChartImportController(
                tabularImportService,
                chartImportService,
                limitsConfig,
                remoteFetcher,
                formatDetector
        );

        assertThrows(IllegalArgumentException.class, () ->
                controller.importChartFromUrl(null, new MockHttpServletRequest())
        );
    }

    @Test
    void importChartFromUrl_serviceThrows_returnsInternalError() throws Exception {
        Mockito.when(limitsConfig.getMaxFileSizeBytes()).thenReturn(1024L * 1024);

        RemoteHttpFetchResult fetched = new RemoteHttpFetchResult(
                "https://example.test/data.csv",
                "text/csv",
                "data.csv",
                "A,1\n".getBytes()
        );
        Mockito.when(remoteFetcher.fetch(any(), any())).thenReturn(fetched);
        Mockito.when(formatDetector.detect(any(), anyString(), anyString(), any())).thenReturn(ImportFormat.CSV);
        Mockito.when(tabularImportService.importDataset(any(), eq(ImportFormat.CSV), any(ImportOptions.class)))
                .thenThrow(new RuntimeException("boom"));

        ChartImportFromUrlRequest body = new ChartImportFromUrlRequest(
                new HttpRequestSpecDto("https://example.test/data.csv", HttpMethod.GET, null, null, null, null, null, null, null, null),
                null,
                null,
                ",",
                "bar",
                true,
                0,
                0,
                List.of(1),
                ChartImportAggregation.SUM
        );

        mockMvc.perform(post("/api/import/chart/url")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("INTERNAL_ERROR"));
    }

    @Test
    void importChartFromUrl_validationFailure_returnsBadRequest() throws Exception {
        ChartImportFromUrlRequest body = new ChartImportFromUrlRequest(
                new HttpRequestSpecDto("https://example.test/data.csv", HttpMethod.GET, null, null, null, null, null, null, null, null),
                null,
                null,
                null,
                " ",
                null,
                null,
                null,
                null,
                null
        );

        mockMvc.perform(post("/api/import/chart/url")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("VALIDATION_FAILED"));
    }

    private static ChartImportResponse sampleResponse(String chartType) {
        return new ChartImportResponse(
                new ChartDataDto(chartType, List.of("A"), List.of(true), List.of(new ChartSeriesDto("S1", List.of(1d), null, null, null))),
                new ChartImportMappingDto(true, 0, 0, List.of(1), ChartImportAggregation.SUM),
                new TabularPreviewDto(1, 2, List.of(List.of("A", "1"))),
                List.of()
        );
    }
}
