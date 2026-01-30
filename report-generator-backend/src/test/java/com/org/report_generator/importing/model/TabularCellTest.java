package com.org.report_generator.importing.model;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class TabularCellTest {

    @Test
    void shouldCreateCellWithAllFields() {
        TabularMerge merge = new TabularMerge(2, 3);
        CoveredBy coveredBy = new CoveredBy(0, 0);
        TabularCell cell = new TabularCell("cell-1", "<b>content</b>", merge, coveredBy);
        
        assertThat(cell.id()).isEqualTo("cell-1");
        assertThat(cell.contentHtml()).isEqualTo("<b>content</b>");
        assertThat(cell.merge()).isEqualTo(merge);
        assertThat(cell.coveredBy()).isEqualTo(coveredBy);
    }

    @Test
    void shouldCreateCellWithNullOptionalFields() {
        TabularCell cell = new TabularCell("cell-2", "plain text", null, null);
        
        assertThat(cell.id()).isEqualTo("cell-2");
        assertThat(cell.contentHtml()).isEqualTo("plain text");
        assertThat(cell.merge()).isNull();
        assertThat(cell.coveredBy()).isNull();
    }

    @Test
    void shouldCreateEmptyCell() {
        TabularCell cell = new TabularCell(null, "", null, null);
        
        assertThat(cell.id()).isNull();
        assertThat(cell.contentHtml()).isEmpty();
    }

    @Test
    void shouldSupportEquality() {
        TabularCell cell1 = new TabularCell("id", "content", null, null);
        TabularCell cell2 = new TabularCell("id", "content", null, null);
        TabularCell cell3 = new TabularCell("id2", "content", null, null);
        
        assertThat(cell1).isEqualTo(cell2);
        assertThat(cell1).isNotEqualTo(cell3);
    }

    @Test
    void shouldSupportHashCode() {
        TabularCell cell1 = new TabularCell("id", "content", null, null);
        TabularCell cell2 = new TabularCell("id", "content", null, null);
        
        assertThat(cell1.hashCode()).isEqualTo(cell2.hashCode());
    }
}
