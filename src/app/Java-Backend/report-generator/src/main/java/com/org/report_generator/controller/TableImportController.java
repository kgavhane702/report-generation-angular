package com.org.report_generator.controller;

import com.org.report_generator.dto.table.ExcelTableImportResponse;
import com.org.report_generator.service.ExcelTableImportService;
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

    private final ExcelTableImportService excelTableImportService;

    public TableImportController(ExcelTableImportService excelTableImportService) {
        this.excelTableImportService = excelTableImportService;
    }

    @PostMapping(value = "/api/table/import/excel", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ExcelTableImportResponse importExcel(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "sheetIndex", required = false) Integer sheetIndex
    ) throws Exception {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Excel file is required");
        }
        return excelTableImportService.parseXlsx(file.getInputStream(), sheetIndex);
    }
}
