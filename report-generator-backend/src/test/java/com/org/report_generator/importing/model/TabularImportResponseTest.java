package com.org.report_generator.importing.model;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class TabularImportResponseTest {

    @Test
    void shouldCreateResponseWithDatasetAndWarnings() {
        TabularDataset dataset = new TabularDataset(List.of(), List.of(), List.of());
        ImportWarning warning = new ImportWarning("WARN", "Warning message");
        
        TabularImportResponse response = new TabularImportResponse(dataset, List.of(warning));
        
        assertThat(response.dataset()).isEqualTo(dataset);
        assertThat(response.warnings()).hasSize(1);
        assertThat(response.warnings().get(0).code()).isEqualTo("WARN");
    }

    @Test
    void shouldCreateResponseWithEmptyWarnings() {
        TabularDataset dataset = new TabularDataset(List.of(), List.of(), List.of());
        
        TabularImportResponse response = new TabularImportResponse(dataset, List.of());
        
        assertThat(response.dataset()).isEqualTo(dataset);
        assertThat(response.warnings()).isEmpty();
    }

    @Test
    void shouldCreateResponseWithNullDataset() {
        TabularImportResponse response = new TabularImportResponse(null, List.of());
        
        assertThat(response.dataset()).isNull();
        assertThat(response.warnings()).isEmpty();
    }

    @Test
    void shouldCreateResponseWithMultipleWarnings() {
        TabularDataset dataset = new TabularDataset(List.of(), List.of(), List.of());
        ImportWarning w1 = new ImportWarning("W1", "First warning");
        ImportWarning w2 = new ImportWarning("W2", "Second warning");
        
        TabularImportResponse response = new TabularImportResponse(dataset, List.of(w1, w2));
        
        assertThat(response.warnings()).hasSize(2);
    }

    @Test
    void shouldSupportEquality() {
        TabularDataset dataset = new TabularDataset(List.of(), List.of(), List.of());
        TabularImportResponse r1 = new TabularImportResponse(dataset, List.of());
        TabularImportResponse r2 = new TabularImportResponse(dataset, List.of());
        
        assertThat(r1).isEqualTo(r2);
    }

    @Test
    void shouldSupportHashCode() {
        TabularDataset dataset = new TabularDataset(List.of(), List.of(), List.of());
        TabularImportResponse r1 = new TabularImportResponse(dataset, List.of());
        TabularImportResponse r2 = new TabularImportResponse(dataset, List.of());
        
        assertThat(r1.hashCode()).isEqualTo(r2.hashCode());
    }
}
