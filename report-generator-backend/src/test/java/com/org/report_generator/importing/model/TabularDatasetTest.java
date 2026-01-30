package com.org.report_generator.importing.model;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class TabularDatasetTest {

    @Test
    void shouldCreateDatasetWithRowsAndFractions() {
        TabularCell cell1 = new TabularCell("c1", "A", null, null);
        TabularCell cell2 = new TabularCell("c2", "B", null, null);
        TabularRow row = new TabularRow("r1", List.of(cell1, cell2));
        
        List<Double> colFractions = List.of(0.5, 0.5);
        List<Double> rowFractions = List.of(1.0);
        
        TabularDataset dataset = new TabularDataset(List.of(row), colFractions, rowFractions);
        
        assertThat(dataset.rows()).hasSize(1);
        assertThat(dataset.columnFractions()).hasSize(2);
        assertThat(dataset.rowFractions()).hasSize(1);
    }

    @Test
    void shouldCreateEmptyDataset() {
        TabularDataset dataset = new TabularDataset(List.of(), List.of(), List.of());
        
        assertThat(dataset.rows()).isEmpty();
        assertThat(dataset.columnFractions()).isEmpty();
        assertThat(dataset.rowFractions()).isEmpty();
    }

    @Test
    void shouldCreateDatasetWithMultipleRows() {
        TabularCell cell1 = new TabularCell("c1", "A", null, null);
        TabularCell cell2 = new TabularCell("c2", "B", null, null);
        TabularRow row1 = new TabularRow("r1", List.of(cell1));
        TabularRow row2 = new TabularRow("r2", List.of(cell2));
        
        TabularDataset dataset = new TabularDataset(
            List.of(row1, row2), 
            List.of(1.0), 
            List.of(0.5, 0.5)
        );
        
        assertThat(dataset.rows()).hasSize(2);
        assertThat(dataset.rows().get(0).id()).isEqualTo("r1");
        assertThat(dataset.rows().get(1).id()).isEqualTo("r2");
    }

    @Test
    void shouldSupportEquality() {
        TabularDataset dataset1 = new TabularDataset(List.of(), List.of(0.5), List.of(1.0));
        TabularDataset dataset2 = new TabularDataset(List.of(), List.of(0.5), List.of(1.0));
        TabularDataset dataset3 = new TabularDataset(List.of(), List.of(0.3), List.of(1.0));
        
        assertThat(dataset1).isEqualTo(dataset2);
        assertThat(dataset1).isNotEqualTo(dataset3);
    }

    @Test
    void shouldSupportHashCode() {
        TabularDataset dataset1 = new TabularDataset(List.of(), List.of(0.5), List.of(1.0));
        TabularDataset dataset2 = new TabularDataset(List.of(), List.of(0.5), List.of(1.0));
        
        assertThat(dataset1.hashCode()).isEqualTo(dataset2.hashCode());
    }
}
