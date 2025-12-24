package com.org.report_generator.importing.adapter;

import com.org.report_generator.dto.table.CoveredByDto;
import com.org.report_generator.dto.table.ExcelTableImportResponse;
import com.org.report_generator.dto.table.TableCellDto;
import com.org.report_generator.dto.table.TableCellMergeDto;
import com.org.report_generator.dto.table.TableRowDto;
import com.org.report_generator.importing.enums.ImportTarget;
import com.org.report_generator.importing.model.TabularCell;
import com.org.report_generator.importing.model.TabularDataset;
import com.org.report_generator.importing.model.TabularRow;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Adapter: {@link TabularDataset} -> {@link ExcelTableImportResponse} (TABLE target).
 *
 * This keeps the legacy Excel-table endpoint stable while allowing the parsing pipeline
 * to be format-agnostic internally.
 */
@Component
public class TableWidgetTargetAdapter implements TabularTargetAdapter<ExcelTableImportResponse> {

    @Override
    public ImportTarget target() {
        return ImportTarget.TABLE;
    }

    @Override
    public Class<ExcelTableImportResponse> outputType() {
        return ExcelTableImportResponse.class;
    }

    @Override
    public ExcelTableImportResponse adapt(TabularDataset dataset) {
        List<TableRowDto> rows = dataset.rows().stream()
                .map(TableWidgetTargetAdapter::toRow)
                .toList();
        return new ExcelTableImportResponse(rows, dataset.columnFractions(), dataset.rowFractions());
    }

    private static TableRowDto toRow(TabularRow row) {
        List<TableCellDto> cells = row.cells().stream()
                .map(TableWidgetTargetAdapter::toCell)
                .toList();
        return new TableRowDto(row.id(), cells);
    }

    private static TableCellDto toCell(TabularCell c) {
        TableCellMergeDto merge = c.merge() == null ? null : new TableCellMergeDto(c.merge().rowSpan(), c.merge().colSpan());
        CoveredByDto coveredBy = c.coveredBy() == null ? null : new CoveredByDto(c.coveredBy().row(), c.coveredBy().col());
        String html = c.contentHtml() == null ? "" : c.contentHtml();
        return new TableCellDto(c.id(), html, merge, coveredBy);
    }
}


