package com.org.report_generator.importing.model;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class TabularRowTest {

    @Test
    void shouldCreateRowWithIdAndCells() {
        TabularCell cell1 = new TabularCell("c1", "A", null, null);
        TabularCell cell2 = new TabularCell("c2", "B", null, null);
        TabularRow row = new TabularRow("row-1", List.of(cell1, cell2));
        
        assertThat(row.id()).isEqualTo("row-1");
        assertThat(row.cells()).hasSize(2);
        assertThat(row.cells().get(0).contentHtml()).isEqualTo("A");
        assertThat(row.cells().get(1).contentHtml()).isEqualTo("B");
    }

    @Test
    void shouldCreateEmptyRow() {
        TabularRow row = new TabularRow("empty-row", List.of());
        
        assertThat(row.id()).isEqualTo("empty-row");
        assertThat(row.cells()).isEmpty();
    }

    @Test
    void shouldCreateRowWithNullId() {
        TabularRow row = new TabularRow(null, List.of());
        
        assertThat(row.id()).isNull();
    }

    @Test
    void shouldSupportEquality() {
        TabularCell cell = new TabularCell("c1", "A", null, null);
        TabularRow row1 = new TabularRow("r1", List.of(cell));
        TabularRow row2 = new TabularRow("r1", List.of(cell));
        TabularRow row3 = new TabularRow("r2", List.of(cell));
        
        assertThat(row1).isEqualTo(row2);
        assertThat(row1).isNotEqualTo(row3);
    }

    @Test
    void shouldSupportHashCode() {
        TabularCell cell = new TabularCell("c1", "A", null, null);
        TabularRow row1 = new TabularRow("r1", List.of(cell));
        TabularRow row2 = new TabularRow("r1", List.of(cell));
        
        assertThat(row1.hashCode()).isEqualTo(row2.hashCode());
    }
}
