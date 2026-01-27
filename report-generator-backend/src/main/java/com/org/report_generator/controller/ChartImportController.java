package com.org.report_generator.controller;

import com.org.report_generator.config.ImportLimitsConfig;
import com.org.report_generator.dto.chart.ChartImportAggregation;
import com.org.report_generator.dto.chart.ChartImportResponse;
import com.org.report_generator.dto.common.ApiResponse;
import com.org.report_generator.dto.common.ApiResponseEntity;
import com.org.report_generator.dto.http.ChartImportFromUrlRequest;
import com.org.report_generator.importing.enums.ImportFormat;
import com.org.report_generator.importing.model.ChartImportOptions;
import com.org.report_generator.importing.model.ImportOptions;
import com.org.report_generator.importing.model.TabularDataset;
import com.org.report_generator.importing.service.ChartImportService;
import com.org.report_generator.importing.service.FormatDetector;
import com.org.report_generator.importing.service.TabularImportService;
import com.org.report_generator.importing.service.RemoteHttpFetchResult;
import com.org.report_generator.importing.service.RemoteHttpFetcherService;
import com.org.report_generator.importing.util.ByteArrayMultipartFile;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.bind.annotation.RequestBody;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

import java.util.List;

/**
 * Chart import endpoint: parses XLSX/CSV/JSON/XML via the generic tabular pipeline,
 * then converts the tabular dataset into ChartData (labels + series) with mapping + warnings.
 */
@RestController
@CrossOrigin(origins = "*")
@RequestMapping
public class ChartImportController {

    private static final Logger logger = LoggerFactory.getLogger(ChartImportController.class);

    private final TabularImportService tabularImportService;
    private final ChartImportService chartImportService;
    private final ImportLimitsConfig limitsConfig;
    private final RemoteHttpFetcherService remoteFetcher;
    private final FormatDetector formatDetector;

    public ChartImportController(
            TabularImportService tabularImportService,
            ChartImportService chartImportService,
            ImportLimitsConfig limitsConfig,
            RemoteHttpFetcherService remoteFetcher,
            FormatDetector formatDetector
    ) {
        this.tabularImportService = tabularImportService;
        this.chartImportService = chartImportService;
        this.limitsConfig = limitsConfig;
        this.remoteFetcher = remoteFetcher;
        this.formatDetector = formatDetector;
    }

    @PostMapping(
            value = "/api/import/chart",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE
    )
    public ResponseEntity<ApiResponse<ChartImportResponse>> importChart(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "format", required = false) ImportFormat format,
            @RequestParam(value = "sheetIndex", required = false) Integer sheetIndex,
            @RequestParam(value = "delimiter", required = false) String delimiter,
            @RequestParam("chartType") String chartType,
            @RequestParam(value = "hasHeader", required = false) Boolean hasHeader,
            @RequestParam(value = "headerRowIndex", required = false) Integer headerRowIndex,
            @RequestParam(value = "categoryColumnIndex", required = false) Integer categoryColumnIndex,
            @RequestParam(value = "seriesColumnIndexes", required = false) List<Integer> seriesColumnIndexes,
            @RequestParam(value = "aggregation", required = false) ChartImportAggregation aggregation
    ) throws Exception {
        long startTime = System.currentTimeMillis();

        String fileName = file != null ? file.getOriginalFilename() : "null";
        long fileSize = file != null ? file.getSize() : 0;

        ImportFormat fmt = resolveFormat(format, fileName);
        logger.info("Chart import request: file={}, size={} bytes, format={}, chartType={}", fileName, fileSize, fmt, chartType);

        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Import file is required");
        }
        if (file.getSize() > limitsConfig.getMaxFileSizeBytes()) {
            throw new IllegalArgumentException(
                    String.format("File size exceeds maximum limit: %d bytes > %d bytes",
                            file.getSize(), limitsConfig.getMaxFileSizeBytes()));
        }
        if (chartType == null || chartType.isBlank()) {
            throw new IllegalArgumentException("chartType is required");
        }

        try {
            TabularDataset dataset = tabularImportService.importDataset(file, fmt, new ImportOptions(sheetIndex, delimiter));

            ChartImportOptions options = new ChartImportOptions(
                    chartType.trim(),
                    hasHeader == null || hasHeader,
                    headerRowIndex == null ? 0 : headerRowIndex,
                    categoryColumnIndex == null ? 0 : categoryColumnIndex,
                    seriesColumnIndexes,
                    aggregation == null ? ChartImportAggregation.SUM : aggregation
            );

            ChartImportResponse response = chartImportService.importChart(dataset, options);
            long duration = System.currentTimeMillis() - startTime;
            logger.info("Chart import successful in {}ms", duration);
            return ApiResponseEntity.ok(response);
        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            logger.error("Chart import failed after {}ms", duration, e);
            throw e;
        }
    }

    @PostMapping(
            value = "/api/import/chart/url",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE
    )
    public ResponseEntity<ApiResponse<ChartImportResponse>> importChartFromUrl(
            @Valid @RequestBody ChartImportFromUrlRequest request,
            HttpServletRequest httpRequest
    ) throws Exception {
        long startTime = System.currentTimeMillis();
        logger.info("Chart URL import request: method={}, url={}, chartType={}",
                request != null ? request.request().method() : "null",
                request != null ? request.request().url() : "null",
                request != null ? request.chartType() : "null");

        if (request == null) {
            throw new IllegalArgumentException("Request body is required");
        }

        RemoteHttpFetchResult fetched = remoteFetcher.fetch(request.request(), httpRequest);
        ImportFormat fmt = formatDetector.detect(request.format(), fetched.effectiveUrl(), fetched.contentType(), fetched.bytes());

        if (fetched.bytes() == null || fetched.bytes().length == 0) {
            throw new IllegalArgumentException("Remote resource is empty");
        }
        if (fetched.bytes().length > limitsConfig.getMaxFileSizeBytes()) {
            throw new IllegalArgumentException(
                    String.format("Remote size exceeds maximum limit: %d bytes > %d bytes",
                            fetched.bytes().length, limitsConfig.getMaxFileSizeBytes()));
        }

        MultipartFile file = new ByteArrayMultipartFile(
                "file",
                fetched.fileName(),
                fetched.contentType(),
                fetched.bytes()
        );

        try {
            TabularDataset dataset = tabularImportService.importDataset(
                    file,
                    fmt,
                    new ImportOptions(request.sheetIndex(), request.delimiter())
            );

            ChartImportOptions options = new ChartImportOptions(
                    request.chartType().trim(),
                    request.hasHeader() == null || request.hasHeader(),
                    request.headerRowIndex() == null ? 0 : request.headerRowIndex(),
                    request.categoryColumnIndex() == null ? 0 : request.categoryColumnIndex(),
                    request.seriesColumnIndexes(),
                    request.aggregation() == null ? ChartImportAggregation.SUM : request.aggregation()
            );

            ChartImportResponse response = chartImportService.importChart(dataset, options);
            long duration = System.currentTimeMillis() - startTime;
            logger.info("Chart URL import successful in {}ms", duration);
            return ApiResponseEntity.ok(response);
        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            logger.error("Chart URL import failed after {}ms", duration, e);
            throw e;
        }
    }

    private static ImportFormat resolveFormat(ImportFormat provided, String fileName) {
        if (provided != null) return provided;
        if (fileName == null) return ImportFormat.XLSX;
        String lower = fileName.toLowerCase();
        if (lower.endsWith(".csv")) return ImportFormat.CSV;
        if (lower.endsWith(".json")) return ImportFormat.JSON;
        if (lower.endsWith(".xml")) return ImportFormat.XML;
        return ImportFormat.XLSX;
    }
}


