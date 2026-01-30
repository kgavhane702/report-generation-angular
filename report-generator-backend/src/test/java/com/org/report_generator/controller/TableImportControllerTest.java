package com.org.report_generator.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.org.report_generator.config.ImportLimitsConfig;
import com.org.report_generator.dto.http.HttpMethod;
import com.org.report_generator.dto.http.HttpRequestSpecDto;
import com.org.report_generator.dto.http.TableImportFromUrlRequest;
import com.org.report_generator.dto.table.TableCellDto;
import com.org.report_generator.dto.table.TableImportResponse;
import com.org.report_generator.dto.table.TableRowDto;
import com.org.report_generator.exception.ApiExceptionHandler;
import com.org.report_generator.importing.enums.ImportFormat;
import com.org.report_generator.importing.enums.ImportTarget;
import com.org.report_generator.importing.model.ImportOptions;
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

@WebMvcTest(TableImportController.class)
@Import(ApiExceptionHandler.class)
class TableImportControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

        @Autowired
        private TableImportController controller;

    @MockitoBean
    private TabularImportService tabularImportService;

    @MockitoBean
    private ImportLimitsConfig limitsConfig;

    @MockitoBean
    private RemoteHttpFetcherService remoteFetcher;

    @MockitoBean
    private FormatDetector formatDetector;

    @Test
    void importCsv_returnsApiResponse() throws Exception {
        Mockito.when(limitsConfig.getMaxFileSizeBytes()).thenReturn(1024L * 1024);

        TableImportResponse response = new TableImportResponse(
                List.of(new TableRowDto("r-0", List.of(
                        new TableCellDto("0-0", "A", null, null),
                        new TableCellDto("0-1", "B", null, null)
                ))),
                List.of(0.5, 0.5),
                List.of(1.0)
        );

        Mockito.when(tabularImportService.importForTarget(
                any(),
                eq(ImportFormat.CSV),
                eq(ImportTarget.TABLE),
                any(ImportOptions.class),
                eq(TableImportResponse.class)
        )).thenReturn(response);

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "sample.csv",
                "text/csv",
                "A,B\n1,2\n".getBytes()
        );

        mockMvc.perform(multipart("/api/table/import/csv")
                        .file(file))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.rows").isArray());
    }

    @Test
    void importExcel_returnsApiResponse() throws Exception {
        Mockito.when(limitsConfig.getMaxFileSizeBytes()).thenReturn(1024L * 1024);

        TableImportResponse response = sampleTableResponse();
        Mockito.when(tabularImportService.importForTarget(
                any(),
                eq(ImportFormat.XLSX),
                eq(ImportTarget.TABLE),
                any(ImportOptions.class),
                eq(TableImportResponse.class)
        )).thenReturn(response);

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "sample.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "fake".getBytes()
        );

        mockMvc.perform(multipart("/api/table/import/excel")
                        .file(file)
                        .param("sheetIndex", "0"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.rows").isArray());
    }

    @Test
    void importXml_returnsApiResponse() throws Exception {
        Mockito.when(limitsConfig.getMaxFileSizeBytes()).thenReturn(1024L * 1024);

        TableImportResponse response = sampleTableResponse();
        Mockito.when(tabularImportService.importForTarget(
                any(),
                eq(ImportFormat.XML),
                eq(ImportTarget.TABLE),
                any(ImportOptions.class),
                eq(TableImportResponse.class)
        )).thenReturn(response);

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "sample.xml",
                "application/xml",
                "<rows/>".getBytes()
        );

        mockMvc.perform(multipart("/api/table/import/xml")
                        .file(file))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.rows").isArray());
    }

    @Test
    void importJson_returnsApiResponse() throws Exception {
        Mockito.when(limitsConfig.getMaxFileSizeBytes()).thenReturn(1024L * 1024);

        TableImportResponse response = sampleTableResponse();
        Mockito.when(tabularImportService.importForTarget(
                any(),
                eq(ImportFormat.JSON),
                eq(ImportTarget.TABLE),
                any(ImportOptions.class),
                eq(TableImportResponse.class)
        )).thenReturn(response);

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "sample.json",
                "application/json",
                "[{\"a\":1}]".getBytes()
        );

        mockMvc.perform(multipart("/api/table/import/json")
                        .file(file))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.rows").isArray());
    }

    @Test
    void importExcel_rejectsOversizedFile_returnsBadRequest() throws Exception {
        Mockito.when(limitsConfig.getMaxFileSizeBytes()).thenReturn(3L);

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "big.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "1234".getBytes()
        );

        mockMvc.perform(multipart("/api/table/import/excel")
                        .file(file))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("BAD_REQUEST"));

        verify(tabularImportService, never()).importForTarget(any(), any(), any(), any(), any());
    }

    @Test
    void importCsv_serviceThrows_returnsInternalError() throws Exception {
        Mockito.when(limitsConfig.getMaxFileSizeBytes()).thenReturn(1024L * 1024);

        Mockito.when(tabularImportService.importForTarget(
                any(),
                eq(ImportFormat.CSV),
                eq(ImportTarget.TABLE),
                any(ImportOptions.class),
                eq(TableImportResponse.class)
        )).thenThrow(new RuntimeException("boom"));

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "sample.csv",
                "text/csv",
                "A,B\n1,2\n".getBytes()
        );

        mockMvc.perform(multipart("/api/table/import/csv")
                        .file(file))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("INTERNAL_ERROR"));
    }

    @Test
    void importCsv_rejectsOversizedFile_returnsBadRequest() throws Exception {
        Mockito.when(limitsConfig.getMaxFileSizeBytes()).thenReturn(3L);

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "big.csv",
                "text/csv",
                "1234".getBytes()
        );

        mockMvc.perform(multipart("/api/table/import/csv")
                        .file(file))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("BAD_REQUEST"));

        verify(tabularImportService, never()).importForTarget(any(), any(), any(), any(), any());
    }

    @Test
    void importJson_rejectsEmptyFile() throws Exception {
        Mockito.when(limitsConfig.getMaxFileSizeBytes()).thenReturn(1024L * 1024);

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "empty.json",
                "application/json",
                new byte[0]
        );

        mockMvc.perform(multipart("/api/table/import/json")
                        .file(file))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("BAD_REQUEST"));
    }

        @Test
        void importExcel_nullFile_throwsIllegalArgumentException() {
                Mockito.when(limitsConfig.getMaxFileSizeBytes()).thenReturn(1024L * 1024);
                assertThrows(IllegalArgumentException.class, () -> controller.importExcel(null, null));
        }

        @Test
        void importCsv_nullFile_throwsIllegalArgumentException() {
                Mockito.when(limitsConfig.getMaxFileSizeBytes()).thenReturn(1024L * 1024);
                assertThrows(IllegalArgumentException.class, () -> controller.importCsv(null, null));
        }

        @Test
        void importJson_nullFile_throwsIllegalArgumentException() {
                Mockito.when(limitsConfig.getMaxFileSizeBytes()).thenReturn(1024L * 1024);
                assertThrows(IllegalArgumentException.class, () -> controller.importJson(null));
        }

        @Test
        void importXml_nullFile_throwsIllegalArgumentException() {
                Mockito.when(limitsConfig.getMaxFileSizeBytes()).thenReturn(1024L * 1024);
                assertThrows(IllegalArgumentException.class, () -> controller.importXml(null));
        }

        @Test
        void importJson_rejectsOversizedFile_throwsIllegalArgumentException() {
                Mockito.when(limitsConfig.getMaxFileSizeBytes()).thenReturn(3L);

                MockMultipartFile file = new MockMultipartFile(
                                "file",
                                "big.json",
                                "application/json",
                                "1234".getBytes()
                );

                assertThrows(IllegalArgumentException.class, () -> controller.importJson(file));
        }

        @Test
        void importXml_rejectsOversizedFile_throwsIllegalArgumentException() {
                Mockito.when(limitsConfig.getMaxFileSizeBytes()).thenReturn(3L);

                MockMultipartFile file = new MockMultipartFile(
                                "file",
                                "big.xml",
                                "application/xml",
                                "1234".getBytes()
                );

                assertThrows(IllegalArgumentException.class, () -> controller.importXml(file));
        }

        @Test
        void importExcel_serviceThrows_executesControllerCatchBlock() throws Exception {
                Mockito.when(limitsConfig.getMaxFileSizeBytes()).thenReturn(1024L * 1024);

                Mockito.when(tabularImportService.importForTarget(
                                any(),
                                eq(ImportFormat.XLSX),
                                eq(ImportTarget.TABLE),
                                any(ImportOptions.class),
                                eq(TableImportResponse.class)
                )).thenThrow(new RuntimeException("boom"));

                MockMultipartFile file = new MockMultipartFile(
                                "file",
                                "sample.xlsx",
                                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                                "fake".getBytes()
                );

                assertThrows(RuntimeException.class, () -> controller.importExcel(file, 0));
        }

        @Test
        void importJson_serviceThrows_executesControllerCatchBlock() throws Exception {
                Mockito.when(limitsConfig.getMaxFileSizeBytes()).thenReturn(1024L * 1024);

                Mockito.when(tabularImportService.importForTarget(
                                any(),
                                eq(ImportFormat.JSON),
                                eq(ImportTarget.TABLE),
                                any(ImportOptions.class),
                                eq(TableImportResponse.class)
                )).thenThrow(new RuntimeException("boom"));

                MockMultipartFile file = new MockMultipartFile(
                                "file",
                                "sample.json",
                                "application/json",
                                "[{\"a\":1}]".getBytes()
                );

                assertThrows(RuntimeException.class, () -> controller.importJson(file));
        }

        @Test
        void importXml_serviceThrows_executesControllerCatchBlock() throws Exception {
                Mockito.when(limitsConfig.getMaxFileSizeBytes()).thenReturn(1024L * 1024);

                Mockito.when(tabularImportService.importForTarget(
                                any(),
                                eq(ImportFormat.XML),
                                eq(ImportTarget.TABLE),
                                any(ImportOptions.class),
                                eq(TableImportResponse.class)
                )).thenThrow(new RuntimeException("boom"));

                MockMultipartFile file = new MockMultipartFile(
                                "file",
                                "sample.xml",
                                "application/xml",
                                "<rows/>".getBytes()
                );

                assertThrows(RuntimeException.class, () -> controller.importXml(file));
        }

    @Test
    void importFromUrl_returnsApiResponse() throws Exception {
        Mockito.when(limitsConfig.getMaxFileSizeBytes()).thenReturn(1024L * 1024);

        RemoteHttpFetchResult fetched = new RemoteHttpFetchResult(
                "https://example.test/data.csv",
                "text/csv",
                "data.csv",
                "A,B\n1,2\n".getBytes()
        );
        Mockito.when(remoteFetcher.fetch(any(), any())).thenReturn(fetched);
        Mockito.when(formatDetector.detect(any(), anyString(), anyString(), any())).thenReturn(ImportFormat.CSV);

        Mockito.when(tabularImportService.importForTarget(
                any(),
                eq(ImportFormat.CSV),
                eq(ImportTarget.TABLE),
                any(ImportOptions.class),
                eq(TableImportResponse.class)
        )).thenReturn(sampleTableResponse());

        TableImportFromUrlRequest body = new TableImportFromUrlRequest(
                new HttpRequestSpecDto("https://example.test/data.csv", HttpMethod.GET, null, null, null, null, null, null, null, null),
                null,
                null,
                ","
        );

        mockMvc.perform(post("/api/table/import/url")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.rows").isArray());
    }

    @Test
    void importFromUrl_rejectsEmptyRemoteBytes_returnsBadRequest() throws Exception {
        Mockito.when(limitsConfig.getMaxFileSizeBytes()).thenReturn(1024L * 1024);

        RemoteHttpFetchResult fetched = new RemoteHttpFetchResult(
                "https://example.test/data.csv",
                "text/csv",
                "data.csv",
                new byte[0]
        );
        Mockito.when(remoteFetcher.fetch(any(), any())).thenReturn(fetched);
        Mockito.when(formatDetector.detect(any(), anyString(), anyString(), any())).thenReturn(ImportFormat.CSV);

        TableImportFromUrlRequest body = new TableImportFromUrlRequest(
                new HttpRequestSpecDto("https://example.test/data.csv", HttpMethod.GET, null, null, null, null, null, null, null, null),
                null,
                null,
                null
        );

        mockMvc.perform(post("/api/table/import/url")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("BAD_REQUEST"));
    }

    @Test
    void importFromUrl_rejectsOversizedRemoteBytes_returnsBadRequest() throws Exception {
        Mockito.when(limitsConfig.getMaxFileSizeBytes()).thenReturn(3L);

        RemoteHttpFetchResult fetched = new RemoteHttpFetchResult(
                "https://example.test/data.csv",
                "text/csv",
                "data.csv",
                "1234".getBytes()
        );
        Mockito.when(remoteFetcher.fetch(any(), any())).thenReturn(fetched);
        Mockito.when(formatDetector.detect(any(), anyString(), anyString(), any())).thenReturn(ImportFormat.CSV);

        TableImportFromUrlRequest body = new TableImportFromUrlRequest(
                new HttpRequestSpecDto("https://example.test/data.csv", HttpMethod.GET, null, null, null, null, null, null, null, null),
                null,
                null,
                null
        );

        mockMvc.perform(post("/api/table/import/url")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("BAD_REQUEST"));
    }

    @Test
    void importFromUrl_rejectsNullRemoteBytes_returnsBadRequest() throws Exception {
        Mockito.when(limitsConfig.getMaxFileSizeBytes()).thenReturn(1024L * 1024);

        RemoteHttpFetchResult fetched = new RemoteHttpFetchResult(
                "https://example.test/data.csv",
                "text/csv",
                "data.csv",
                null
        );
        Mockito.when(remoteFetcher.fetch(any(), any())).thenReturn(fetched);
        Mockito.when(formatDetector.detect(any(), anyString(), anyString(), Mockito.nullable(byte[].class)))
                .thenReturn(ImportFormat.CSV);

        TableImportFromUrlRequest body = new TableImportFromUrlRequest(
                new HttpRequestSpecDto("https://example.test/data.csv", HttpMethod.GET, null, null, null, null, null, null, null, null),
                null,
                null,
                null
        );

        mockMvc.perform(post("/api/table/import/url")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("BAD_REQUEST"));
    }

    @Test
    void importFromUrl_serviceThrows_returnsInternalError() throws Exception {
        Mockito.when(limitsConfig.getMaxFileSizeBytes()).thenReturn(1024L * 1024);

        RemoteHttpFetchResult fetched = new RemoteHttpFetchResult(
                "https://example.test/data.csv",
                "text/csv",
                "data.csv",
                "A,B\n1,2\n".getBytes()
        );
        Mockito.when(remoteFetcher.fetch(any(), any())).thenReturn(fetched);
        Mockito.when(formatDetector.detect(any(), anyString(), anyString(), any())).thenReturn(ImportFormat.CSV);

        Mockito.when(tabularImportService.importForTarget(
                any(),
                eq(ImportFormat.CSV),
                eq(ImportTarget.TABLE),
                any(ImportOptions.class),
                eq(TableImportResponse.class)
        )).thenThrow(new RuntimeException("boom"));

        TableImportFromUrlRequest body = new TableImportFromUrlRequest(
                new HttpRequestSpecDto("https://example.test/data.csv", HttpMethod.GET, null, null, null, null, null, null, null, null),
                null,
                null,
                ","
        );

        mockMvc.perform(post("/api/table/import/url")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("INTERNAL_ERROR"));
    }

    private static TableImportResponse sampleTableResponse() {
        return new TableImportResponse(
                List.of(new TableRowDto("r-0", List.of(
                        new TableCellDto("0-0", "A", null, null),
                        new TableCellDto("0-1", "B", null, null)
                ))),
                List.of(0.5, 0.5),
                List.of(1.0)
        );
    }
}
