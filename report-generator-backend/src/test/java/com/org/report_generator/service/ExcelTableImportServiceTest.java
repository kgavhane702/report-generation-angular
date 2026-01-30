package com.org.report_generator.service;

import com.org.report_generator.dto.table.TableImportResponse;
import com.org.report_generator.config.ImportLimitsConfig;
import org.junit.jupiter.api.Test;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.apache.poi.ss.util.CellRangeAddress;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
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
            TableImportResponse resp = svc.parseXlsx(is, 0);
            assertNotNull(resp);
            assertNotNull(resp.rows());
            assertFalse(resp.rows().isEmpty());
            assertNotNull(resp.columnFractions());
            assertNotNull(resp.rowFractions());
        }
    }

    @Test
    void parseXlsx_selectsFirstNonEmptySheet_andPreservesMerges() throws Exception {
        ImportLimitsConfig limits = new ImportLimitsConfig();
        ExcelTableImportService svc = new ExcelTableImportService(limits);

        byte[] bytes;
        try (XSSFWorkbook wb = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            wb.createSheet("Empty");
            var dataSheet = wb.createSheet("Data");

            Row header = dataSheet.createRow(0);
            header.createCell(0).setCellValue("Group");
            header.createCell(1).setCellValue("");
            dataSheet.addMergedRegion(new CellRangeAddress(0, 0, 0, 1));

            Row row1 = dataSheet.createRow(1);
            row1.createCell(0).setCellValue("A");
            row1.createCell(1).setCellValue("B");

            wb.write(out);
            bytes = out.toByteArray();
        }

        try (InputStream is = new ByteArrayInputStream(bytes)) {
            TableImportResponse resp = svc.parseXlsx(is, null);
            assertNotNull(resp);
            assertEquals(2, resp.rows().size());
            assertEquals(2, resp.rows().get(0).cells().size());

            var c00 = resp.rows().get(0).cells().get(0);
            var c01 = resp.rows().get(0).cells().get(1);
            assertNotNull(c00.merge());
            assertEquals(1, c00.merge().rowSpan());
            assertEquals(2, c00.merge().colSpan());
            assertNotNull(c01.coveredBy());
            assertEquals(0, c01.coveredBy().row());
            assertEquals(0, c01.coveredBy().col());
        }
    }
}
