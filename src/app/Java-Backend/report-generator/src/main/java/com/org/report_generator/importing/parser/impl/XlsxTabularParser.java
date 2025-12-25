package com.org.report_generator.importing.parser.impl;

import com.org.report_generator.dto.table.TableImportResponse;
import com.org.report_generator.dto.table.TableCellDto;
import com.org.report_generator.dto.table.TableRowDto;
import com.org.report_generator.importing.enums.ImportFormat;
import com.org.report_generator.importing.model.CoveredBy;
import com.org.report_generator.importing.model.ImportOptions;
import com.org.report_generator.importing.model.TabularCell;
import com.org.report_generator.importing.model.TabularDataset;
import com.org.report_generator.importing.model.TabularMerge;
import com.org.report_generator.importing.model.TabularRow;
import com.org.report_generator.importing.parser.TabularParser;
import com.org.report_generator.service.ExcelTableImportService;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * XLSX implementation of {@link TabularParser}.
 *
 * For now, this delegates to the existing {@link ExcelTableImportService} (lowest risk),
 * then maps the result into the format-agnostic {@link TabularDataset}.
 */
@Component
public class XlsxTabularParser implements TabularParser {

    private final ExcelTableImportService excelTableImportService;

    public XlsxTabularParser(ExcelTableImportService excelTableImportService) {
        this.excelTableImportService = excelTableImportService;
    }

    @Override
    public ImportFormat format() {
        return ImportFormat.XLSX;
    }

    @Override
    public TabularDataset parse(MultipartFile file, ImportOptions options) throws Exception {
        Integer sheetIndex = options == null ? null : options.sheetIndex();
        TableImportResponse resp = excelTableImportService.parseXlsx(file.getInputStream(), sheetIndex);
        return toDataset(resp);
    }

    private static TabularDataset toDataset(TableImportResponse resp) {
        List<TabularRow> rows = resp.rows().stream()
                .map(XlsxTabularParser::toRow)
                .toList();
        return new TabularDataset(rows, resp.columnFractions(), resp.rowFractions());
    }

    private static TabularRow toRow(TableRowDto row) {
        List<TabularCell> cells = row.cells().stream()
                .map(XlsxTabularParser::toCell)
                .toList();
        return new TabularRow(row.id(), cells);
    }

    private static TabularCell toCell(TableCellDto c) {
        TabularMerge merge = c.merge() == null ? null : new TabularMerge(c.merge().rowSpan(), c.merge().colSpan());
        CoveredBy coveredBy = c.coveredBy() == null ? null : new CoveredBy(c.coveredBy().row(), c.coveredBy().col());
        return new TabularCell(c.id(), c.contentHtml(), merge, coveredBy);
    }
}


