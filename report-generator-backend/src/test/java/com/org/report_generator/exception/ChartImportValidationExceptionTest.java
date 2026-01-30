package com.org.report_generator.exception;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.*;

class ChartImportValidationExceptionTest {

    @Test
    void constructor_withMessage_setsMessage() {
        ChartImportValidationException ex = new ChartImportValidationException("Invalid chart data");

        assertThat(ex.getMessage()).isEqualTo("Invalid chart data");
        assertThat(ex.getDetails()).isNull();
    }

    @Test
    void constructor_withMessageAndDetails_setsBoth() {
        Map<String, Object> details = Map.of(
                "field", "category",
                "reason", "missing values"
        );
        ChartImportValidationException ex = new ChartImportValidationException("Validation failed", details);

        assertThat(ex.getMessage()).isEqualTo("Validation failed");
        assertThat(ex.getDetails()).isEqualTo(details);
    }

    @Test
    void getDetails_withNullDetails_returnsNull() {
        ChartImportValidationException ex = new ChartImportValidationException("Error");

        assertThat(ex.getDetails()).isNull();
    }

    @Test
    void getDetails_withEmptyDetails_returnsEmptyMap() {
        ChartImportValidationException ex = new ChartImportValidationException("Error", Map.of());

        assertThat(ex.getDetails()).isEmpty();
    }

    @Test
    void isRuntimeException() {
        ChartImportValidationException ex = new ChartImportValidationException("Test");

        assertThat(ex).isInstanceOf(RuntimeException.class);
    }
}
