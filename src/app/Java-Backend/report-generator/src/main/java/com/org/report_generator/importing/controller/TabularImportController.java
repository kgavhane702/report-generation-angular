package com.org.report_generator.importing.controller;

import com.org.report_generator.importing.enums.ImportFormat;
import com.org.report_generator.importing.model.ImportOptions;
import com.org.report_generator.importing.model.TabularDataset;
import com.org.report_generator.importing.model.TabularImportResponse;
import com.org.report_generator.importing.service.TabularImportService;
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

    private final TabularImportService tabularImportService;

    public TabularImportController(TabularImportService tabularImportService) {
        this.tabularImportService = tabularImportService;
    }

    @PostMapping(value = "/api/import/tabular", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public TabularImportResponse importTabular(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "sheetIndex", required = false) Integer sheetIndex,
            @RequestParam(value = "format", required = false) ImportFormat format
    ) throws Exception {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Import file is required");
        }

        ImportFormat fmt = format == null ? ImportFormat.XLSX : format;
        TabularDataset dataset = tabularImportService.importDataset(file, fmt, new ImportOptions(sheetIndex));
        return new TabularImportResponse(dataset, List.of());
    }
}


