package com.org.report_generator.importing.adapter;

import com.org.report_generator.dto.table.TableImportResponse;
import com.org.report_generator.importing.enums.ImportTarget;
import com.org.report_generator.importing.model.CoveredBy;
import com.org.report_generator.importing.model.TabularCell;
import com.org.report_generator.importing.model.TabularDataset;
import com.org.report_generator.importing.model.TabularMerge;
import com.org.report_generator.importing.model.TabularRow;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class TableWidgetTargetAdapterTest {

    private TableWidgetTargetAdapter adapter;

    @BeforeEach
    void setUp() {
        adapter = new TableWidgetTargetAdapter();
    }

    @Test
    void target_returnsTable() {
        assertThat(adapter.target()).isEqualTo(ImportTarget.TABLE);
    }

    @Test
    void outputType_returnsTableImportResponse() {
        assertThat(adapter.outputType()).isEqualTo(TableImportResponse.class);
    }

    @Test
    void adapt_withSimpleDataset_convertsToResponse() {
        TabularCell cell = new TabularCell("c1", "Hello", null, null);
        TabularRow row = new TabularRow("r1", List.of(cell));
        TabularDataset dataset = new TabularDataset(
            List.of(row),
            List.of(1.0),
            List.of(1.0)
        );

        TableImportResponse result = adapter.adapt(dataset);

        assertThat(result.rows()).hasSize(1);
        assertThat(result.rows().get(0).id()).isEqualTo("r1");
        assertThat(result.rows().get(0).cells()).hasSize(1);
        assertThat(result.rows().get(0).cells().get(0).contentHtml()).isEqualTo("Hello");
        assertThat(result.columnFractions()).containsExactly(1.0);
        assertThat(result.rowFractions()).containsExactly(1.0);
    }

    @Test
    void adapt_withMergedCell_convertsMergeInfo() {
        TabularMerge merge = new TabularMerge(2, 3);
        TabularCell cell = new TabularCell("c1", "Merged Cell", merge, null);
        TabularRow row = new TabularRow("r1", List.of(cell));
        TabularDataset dataset = new TabularDataset(List.of(row), List.of(1.0), List.of(1.0));

        TableImportResponse result = adapter.adapt(dataset);

        assertThat(result.rows().get(0).cells().get(0).merge()).isNotNull();
        assertThat(result.rows().get(0).cells().get(0).merge().rowSpan()).isEqualTo(2);
        assertThat(result.rows().get(0).cells().get(0).merge().colSpan()).isEqualTo(3);
    }

    @Test
    void adapt_withCoveredByCell_convertsCoveredByInfo() {
        CoveredBy coveredBy = new CoveredBy(0, 0);
        TabularCell cell = new TabularCell("c1", "", null, coveredBy);
        TabularRow row = new TabularRow("r1", List.of(cell));
        TabularDataset dataset = new TabularDataset(List.of(row), List.of(1.0), List.of(1.0));

        TableImportResponse result = adapter.adapt(dataset);

        assertThat(result.rows().get(0).cells().get(0).coveredBy()).isNotNull();
        assertThat(result.rows().get(0).cells().get(0).coveredBy().row()).isEqualTo(0);
        assertThat(result.rows().get(0).cells().get(0).coveredBy().col()).isEqualTo(0);
    }

    @Test
    void adapt_withNullContentHtml_convertsToEmptyString() {
        TabularCell cell = new TabularCell("c1", null, null, null);
        TabularRow row = new TabularRow("r1", List.of(cell));
        TabularDataset dataset = new TabularDataset(List.of(row), List.of(1.0), List.of(1.0));

        TableImportResponse result = adapter.adapt(dataset);

        assertThat(result.rows().get(0).cells().get(0).contentHtml()).isEmpty();
    }

    @Test
    void adapt_withEmptyDataset_returnsEmptyResponse() {
        TabularDataset dataset = new TabularDataset(List.of(), List.of(), List.of());

        TableImportResponse result = adapter.adapt(dataset);

        assertThat(result.rows()).isEmpty();
        assertThat(result.columnFractions()).isEmpty();
        assertThat(result.rowFractions()).isEmpty();
    }

    @Test
    void adapt_withMultipleRowsAndCells_convertsAllData() {
        TabularCell cell1 = new TabularCell("c1", "A", null, null);
        TabularCell cell2 = new TabularCell("c2", "B", null, null);
        TabularRow row1 = new TabularRow("r1", List.of(cell1, cell2));
        
        TabularCell cell3 = new TabularCell("c3", "C", null, null);
        TabularCell cell4 = new TabularCell("c4", "D", null, null);
        TabularRow row2 = new TabularRow("r2", List.of(cell3, cell4));
        
        TabularDataset dataset = new TabularDataset(
            List.of(row1, row2),
            List.of(0.5, 0.5),
            List.of(0.5, 0.5)
        );

        TableImportResponse result = adapter.adapt(dataset);

        assertThat(result.rows()).hasSize(2);
        assertThat(result.rows().get(0).cells()).hasSize(2);
        assertThat(result.rows().get(1).cells()).hasSize(2);
        assertThat(result.columnFractions()).containsExactly(0.5, 0.5);
        assertThat(result.rowFractions()).containsExactly(0.5, 0.5);
    }
}
