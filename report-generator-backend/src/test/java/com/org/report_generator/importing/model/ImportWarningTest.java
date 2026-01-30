package com.org.report_generator.importing.model;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ImportWarningTest {

    @Test
    void shouldCreateWarningWithCodeAndMessage() {
        ImportWarning warning = new ImportWarning("TRUNCATED_ROWS", "Too many rows, truncated to 1000");
        
        assertThat(warning.code()).isEqualTo("TRUNCATED_ROWS");
        assertThat(warning.message()).isEqualTo("Too many rows, truncated to 1000");
    }

    @Test
    void shouldCreateWarningWithEmptyMessage() {
        ImportWarning warning = new ImportWarning("EMPTY_WARNING", "");
        
        assertThat(warning.code()).isEqualTo("EMPTY_WARNING");
        assertThat(warning.message()).isEmpty();
    }

    @Test
    void shouldCreateWarningWithNullValues() {
        ImportWarning warning = new ImportWarning(null, null);
        
        assertThat(warning.code()).isNull();
        assertThat(warning.message()).isNull();
    }

    @Test
    void shouldSupportEquality() {
        ImportWarning w1 = new ImportWarning("CODE", "msg");
        ImportWarning w2 = new ImportWarning("CODE", "msg");
        ImportWarning w3 = new ImportWarning("OTHER", "msg");
        
        assertThat(w1).isEqualTo(w2);
        assertThat(w1).isNotEqualTo(w3);
    }

    @Test
    void shouldSupportHashCode() {
        ImportWarning w1 = new ImportWarning("CODE", "msg");
        ImportWarning w2 = new ImportWarning("CODE", "msg");
        
        assertThat(w1.hashCode()).isEqualTo(w2.hashCode());
    }
}
