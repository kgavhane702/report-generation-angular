package com.org.report_generator.importing.parser.impl;

import com.org.report_generator.dto.table.CoveredByDto;
import com.org.report_generator.dto.table.TableCellDto;
import com.org.report_generator.dto.table.TableCellMergeDto;
import com.org.report_generator.dto.table.TableImportResponse;
import com.org.report_generator.dto.table.TableRowDto;
import com.org.report_generator.importing.model.ImportOptions;
import com.org.report_generator.importing.model.TabularDataset;
import com.org.report_generator.service.ExcelTableImportService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.mock.web.MockMultipartFile;

import java.io.InputStream;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;

class XlsxTabularParserTest {

    @Test
    void delegatesToExcelService_andMapsToDataset() throws Exception {
        ExcelTableImportService excel = Mockito.mock(ExcelTableImportService.class);

        TableCellDto c00 = new TableCellDto("0-0", "Header", new TableCellMergeDto(1, 2), null);
        TableCellDto c01 = new TableCellDto("0-1", "", null, new CoveredByDto(0, 0));
        TableCellDto c10 = new TableCellDto("1-0", "A", null, null);
        TableCellDto c11 = new TableCellDto("1-1", "B", null, null);

        TableImportResponse resp = new TableImportResponse(
                List.of(
                        new TableRowDto("r-0", List.of(c00, c01)),
                        new TableRowDto("r-1", List.of(c10, c11))
                ),
                List.of(0.5, 0.5),
                List.of(0.5, 0.5)
        );

        Mockito.when(excel.parseXlsx(any(InputStream.class), eq(null))).thenReturn(resp);

        XlsxTabularParser parser = new XlsxTabularParser(excel);
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "sample.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                new byte[]{1, 2, 3}
        );

        TabularDataset dataset = parser.parse(file, new ImportOptions(null, null));

        assertThat(dataset.rows()).hasSize(2);
        assertThat(dataset.rows().get(0).cells().get(0).merge()).isNotNull();
        assertThat(dataset.rows().get(0).cells().get(1).coveredBy()).isNotNull();
        assertThat(dataset.columnFractions()).containsExactly(0.5, 0.5);
        assertThat(dataset.rows().get(1).cells().get(1).contentHtml()).contains("B");
    }
}
