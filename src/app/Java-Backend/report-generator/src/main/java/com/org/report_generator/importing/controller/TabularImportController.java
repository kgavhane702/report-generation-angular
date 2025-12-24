package com.org.report_generator.importing.controller;

import com.org.report_generator.importing.enums.ImportFormat;
import com.org.report_generator.importing.model.ImportOptions;
import com.org.report_generator.importing.model.TabularDataset;
import com.org.report_generator.importing.model.TabularImportResponse;
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

import java.util.List;

/**
 * Generic tabular import endpoint (XLSX-only for now).
 *
 * This endpoint exists to enable reuse for other consumers (e.g. Charts) without
 * coupling those features to Excel-specific controllers/DTOs.
 */
@RestController
@CrossOrigin(origins = "*")
@RequestMapping
public class TabularImportController {

    private static final Logger logger = LoggerFactory.getLogger(TabularImportController.class);
    private final TabularImportService tabularImportService;
    private final ImportLimitsConfig limitsConfig;

    public TabularImportController(TabularImportService tabularImportService, ImportLimitsConfig limitsConfig) {
        this.tabularImportService = tabularImportService;
        this.limitsConfig = limitsConfig;
    }

    @PostMapping(value = "/api/import/tabular", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public TabularImportResponse importTabular(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "sheetIndex", required = false) Integer sheetIndex,
            @RequestParam(value = "format", required = false) ImportFormat format
    ) throws Exception {
        long startTime = System.currentTimeMillis();
        ImportFormat fmt = format == null ? ImportFormat.XLSX : format;
        logger.info("Tabular import request: file={}, size={} bytes, format={}, sheetIndex={}", 
            file != null ? file.getOriginalFilename() : "null",
            file != null ? file.getSize() : 0,
            fmt, sheetIndex);
        
        if (file == null || file.isEmpty()) {
            logger.warn("Tabular import rejected: empty file");
            throw new IllegalArgumentException("Import file is required");
        }
        
        // Validate file size
        if (file.getSize() > limitsConfig.getMaxFileSizeBytes()) {
            logger.warn("Tabular import rejected: file size {} bytes exceeds limit {} bytes", 
                file.getSize(), limitsConfig.getMaxFileSizeBytes());
            throw new IllegalArgumentException(
                String.format("File size exceeds maximum limit: %d bytes > %d bytes", 
                    file.getSize(), limitsConfig.getMaxFileSizeBytes()));
        }

        try {
            TabularDataset dataset = tabularImportService.importDataset(file, fmt, new ImportOptions(sheetIndex));
            long duration = System.currentTimeMillis() - startTime;
            logger.info("Tabular import successful in {}ms: {} rows x {} columns", 
                duration, 
                dataset.rows().size(),
                dataset.rows().isEmpty() ? 0 : dataset.rows().get(0).cells().size());
            return new TabularImportResponse(dataset, List.of());
        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            logger.error("Tabular import failed after {}ms", duration, e);
            throw e;
        }
    }
}


