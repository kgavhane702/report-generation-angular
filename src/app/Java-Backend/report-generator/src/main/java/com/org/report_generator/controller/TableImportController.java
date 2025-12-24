package com.org.report_generator.controller;

import com.org.report_generator.dto.table.ExcelTableImportResponse;
import com.org.report_generator.importing.enums.ImportFormat;
import com.org.report_generator.importing.enums.ImportTarget;
import com.org.report_generator.importing.model.ImportOptions;
import com.org.report_generator.config.ImportLimitsConfig;
import com.org.report_generator.importing.service.TabularImportService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@CrossOrigin(origins = "*")
@RequestMapping
public class TableImportController {

    private static final Logger logger = LoggerFactory.getLogger(TableImportController.class);
    private final TabularImportService tabularImportService;
    private final ImportLimitsConfig limitsConfig;

    public TableImportController(TabularImportService tabularImportService, ImportLimitsConfig limitsConfig) {
        this.tabularImportService = tabularImportService;
        this.limitsConfig = limitsConfig;
    }

    @PostMapping(value = "/api/table/import/excel", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ExcelTableImportResponse importExcel(
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
            ExcelTableImportResponse response = tabularImportService.importForTarget(
                    file,
                    ImportFormat.XLSX,
                    ImportTarget.TABLE,
                    new ImportOptions(sheetIndex),
                    ExcelTableImportResponse.class
            );
            long duration = System.currentTimeMillis() - startTime;
            logger.info("Excel table import successful in {}ms: {} rows", 
                duration, response.rows().size());
            return response;
        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            logger.error("Excel table import failed after {}ms", duration, e);
            throw e;
        }
    }
}
