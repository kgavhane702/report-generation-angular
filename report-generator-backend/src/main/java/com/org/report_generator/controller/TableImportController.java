package com.org.report_generator.controller;

import com.org.report_generator.dto.common.ApiResponse;
import com.org.report_generator.dto.common.ApiResponseEntity;
import com.org.report_generator.dto.http.TableImportFromUrlRequest;
import com.org.report_generator.dto.table.TableImportResponse;
import com.org.report_generator.importing.service.FormatDetector;
import com.org.report_generator.importing.service.RemoteHttpFetchResult;
import com.org.report_generator.importing.service.RemoteHttpFetcherService;
import com.org.report_generator.importing.enums.ImportFormat;
import com.org.report_generator.importing.enums.ImportTarget;
import com.org.report_generator.importing.model.ImportOptions;
import com.org.report_generator.config.ImportLimitsConfig;
import com.org.report_generator.importing.service.TabularImportService;
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

@RestController
@CrossOrigin(origins = "*")
@RequestMapping
public class TableImportController {

    private static final Logger logger = LoggerFactory.getLogger(TableImportController.class);
    private final TabularImportService tabularImportService;
    private final ImportLimitsConfig limitsConfig;
    private final RemoteHttpFetcherService remoteFetcher;
    private final FormatDetector formatDetector;

    public TableImportController(
            TabularImportService tabularImportService,
            ImportLimitsConfig limitsConfig,
            RemoteHttpFetcherService remoteFetcher,
            FormatDetector formatDetector
    ) {
        this.tabularImportService = tabularImportService;
        this.limitsConfig = limitsConfig;
        this.remoteFetcher = remoteFetcher;
        this.formatDetector = formatDetector;
    }

    @PostMapping(
            value = "/api/table/import/excel",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE
    )
    public ResponseEntity<ApiResponse<TableImportResponse>> importExcel(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "sheetIndex", required = false) Integer sheetIndex
    ) throws Exception {
        long startTime = System.currentTimeMillis();
        logger.info("Excel table import request: file={}, size={} bytes, sheetIndex={}", 
            file != null ? file.getOriginalFilename() : "null", 
            file != null ? file.getSize() : 0, 
            sheetIndex);
        
        if (file == null || file.isEmpty()) {
            logger.warn("Excel import rejected: empty file");
            throw new IllegalArgumentException("Excel file is required");
        }
        
        // Validate file size
        if (file.getSize() > limitsConfig.getMaxFileSizeBytes()) {
            logger.warn("Excel import rejected: file size {} bytes exceeds limit {} bytes", 
                file.getSize(), limitsConfig.getMaxFileSizeBytes());
            throw new IllegalArgumentException(
                String.format("File size exceeds maximum limit: %d bytes > %d bytes", 
                    file.getSize(), limitsConfig.getMaxFileSizeBytes()));
        }
        
        try {
            TableImportResponse response = tabularImportService.importForTarget(
                    file,
                    ImportFormat.XLSX,
                    ImportTarget.TABLE,
                    new ImportOptions(sheetIndex, null),
                    TableImportResponse.class
            );
            long duration = System.currentTimeMillis() - startTime;
            logger.info("Excel table import successful in {}ms: {} rows", 
                duration, response.rows().size());
            return ApiResponseEntity.ok(response);
        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            logger.error("Excel table import failed after {}ms", duration, e);
            throw e;
        }
    }

    @PostMapping(
            value = "/api/table/import/csv",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE
    )
    public ResponseEntity<ApiResponse<TableImportResponse>> importCsv(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "delimiter", required = false) String delimiter
    ) throws Exception {
        long startTime = System.currentTimeMillis();
        logger.info("CSV table import request: file={}, size={} bytes, delimiter={}", 
                file != null ? file.getOriginalFilename() : "null",
                file != null ? file.getSize() : 0,
                delimiter);

        if (file == null || file.isEmpty()) {
            logger.warn("CSV import rejected: empty file");
            throw new IllegalArgumentException("CSV file is required");
        }

        // Validate file size
        if (file.getSize() > limitsConfig.getMaxFileSizeBytes()) {
            logger.warn("CSV import rejected: file size {} bytes exceeds limit {} bytes",
                    file.getSize(), limitsConfig.getMaxFileSizeBytes());
            throw new IllegalArgumentException(
                    String.format("File size exceeds maximum limit: %d bytes > %d bytes",
                            file.getSize(), limitsConfig.getMaxFileSizeBytes()));
        }

        try {
            TableImportResponse response = tabularImportService.importForTarget(
                    file,
                    ImportFormat.CSV,
                    ImportTarget.TABLE,
                    new ImportOptions(null, delimiter),
                    TableImportResponse.class
            );
            long duration = System.currentTimeMillis() - startTime;
            logger.info("CSV table import successful in {}ms: {} rows",
                    duration, response.rows().size());
            return ApiResponseEntity.ok(response);
        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            logger.error("CSV table import failed after {}ms", duration, e);
            throw e;
        }
    }

    @PostMapping(
            value = "/api/table/import/json",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE
    )
    public ResponseEntity<ApiResponse<TableImportResponse>> importJson(
            @RequestParam("file") MultipartFile file
    ) throws Exception {
        long startTime = System.currentTimeMillis();
        logger.info("JSON table import request: file={}, size={} bytes",
                file != null ? file.getOriginalFilename() : "null",
                file != null ? file.getSize() : 0);

        if (file == null || file.isEmpty()) {
            logger.warn("JSON import rejected: empty file");
            throw new IllegalArgumentException("JSON file is required");
        }

        if (file.getSize() > limitsConfig.getMaxFileSizeBytes()) {
            logger.warn("JSON import rejected: file size {} bytes exceeds limit {} bytes",
                    file.getSize(), limitsConfig.getMaxFileSizeBytes());
            throw new IllegalArgumentException(
                    String.format("File size exceeds maximum limit: %d bytes > %d bytes",
                            file.getSize(), limitsConfig.getMaxFileSizeBytes()));
        }

        try {
            TableImportResponse response = tabularImportService.importForTarget(
                    file,
                    ImportFormat.JSON,
                    ImportTarget.TABLE,
                    new ImportOptions(null, null),
                    TableImportResponse.class
            );
            long duration = System.currentTimeMillis() - startTime;
            logger.info("JSON table import successful in {}ms: {} rows",
                    duration, response.rows().size());
            return ApiResponseEntity.ok(response);
        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            logger.error("JSON table import failed after {}ms", duration, e);
            throw e;
        }
    }

    @PostMapping(
            value = "/api/table/import/xml",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE
    )
    public ResponseEntity<ApiResponse<TableImportResponse>> importXml(
            @RequestParam("file") MultipartFile file
    ) throws Exception {
        long startTime = System.currentTimeMillis();
        logger.info("XML table import request: file={}, size={} bytes",
                file != null ? file.getOriginalFilename() : "null",
                file != null ? file.getSize() : 0);

        if (file == null || file.isEmpty()) {
            logger.warn("XML import rejected: empty file");
            throw new IllegalArgumentException("XML file is required");
        }

        if (file.getSize() > limitsConfig.getMaxFileSizeBytes()) {
            logger.warn("XML import rejected: file size {} bytes exceeds limit {} bytes",
                    file.getSize(), limitsConfig.getMaxFileSizeBytes());
            throw new IllegalArgumentException(
                    String.format("File size exceeds maximum limit: %d bytes > %d bytes",
                            file.getSize(), limitsConfig.getMaxFileSizeBytes()));
        }

        try {
            TableImportResponse response = tabularImportService.importForTarget(
                    file,
                    ImportFormat.XML,
                    ImportTarget.TABLE,
                    new ImportOptions(null, null),
                    TableImportResponse.class
            );
            long duration = System.currentTimeMillis() - startTime;
            logger.info("XML table import successful in {}ms: {} rows",
                    duration, response.rows().size());
            return ApiResponseEntity.ok(response);
        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            logger.error("XML table import failed after {}ms", duration, e);
            throw e;
        }
    }

    @PostMapping(
            value = "/api/table/import/url",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE
    )
    public ResponseEntity<ApiResponse<TableImportResponse>> importFromUrl(
            @Valid @RequestBody TableImportFromUrlRequest request,
            HttpServletRequest httpRequest
    ) throws Exception {
        long startTime = System.currentTimeMillis();
        logger.info("URL table import request: method={}, url={}",
                request != null ? request.request().method() : "null",
                request != null ? request.request().url() : "null");

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
            TableImportResponse response = tabularImportService.importForTarget(
                    file,
                    fmt,
                    ImportTarget.TABLE,
                    new ImportOptions(request.sheetIndex(), request.delimiter()),
                    TableImportResponse.class
            );
            long duration = System.currentTimeMillis() - startTime;
            logger.info("URL table import successful in {}ms: {} rows", duration, response.rows().size());
            return ApiResponseEntity.ok(response);
        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            logger.error("URL table import failed after {}ms", duration, e);
            throw e;
        }
    }
}
