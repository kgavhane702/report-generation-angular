package com.org.report_generator.service;

import com.org.report_generator.dto.table.ExcelTableImportResponse;
import com.org.report_generator.config.ImportLimitsConfig;
import org.junit.jupiter.api.Test;

import java.io.InputStream;

import static org.junit.jupiter.api.Assertions.*;

class ExcelTableImportServiceTest {

    @Test
    void parseXlsx_smokeTest() throws Exception {
        ExcelTableImportService svc = new ExcelTableImportService(new ImportLimitsConfig());
        try (InputStream is = getClass().getResourceAsStream("/sample.xlsx")) {
            if (is == null) {
                // Skip if sample not present in repo.
                return;
            }
            ExcelTableImportResponse resp = svc.parseXlsx(is, 0);
            assertNotNull(resp);
            assertNotNull(resp.rows());
            assertFalse(resp.rows().isEmpty());
            assertNotNull(resp.columnFractions());
            assertNotNull(resp.rowFractions());
        }
    }
}
