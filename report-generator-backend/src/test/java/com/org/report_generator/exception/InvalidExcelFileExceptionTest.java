package com.org.report_generator.exception;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.*;

class InvalidExcelFileExceptionTest {

    @Test
    void constructor_withMessage_setsMessage() {
        InvalidExcelFileException ex = new InvalidExcelFileException("Invalid Excel format");

        assertThat(ex.getMessage()).isEqualTo("Invalid Excel format");
        assertThat(ex.getCause()).isNull();
    }

    @Test
    void constructor_withMessageAndCause_setsBoth() {
        Exception cause = new IllegalStateException("Corrupted file");
        InvalidExcelFileException ex = new InvalidExcelFileException("Cannot read Excel file", cause);

        assertThat(ex.getMessage()).isEqualTo("Cannot read Excel file");
        assertThat(ex.getCause()).isEqualTo(cause);
    }

    @Test
    void isRuntimeException() {
        InvalidExcelFileException ex = new InvalidExcelFileException("Test");

        assertThat(ex).isInstanceOf(RuntimeException.class);
    }

    @Test
    void getCause_returnsNestedCause() {
        RuntimeException nested = new RuntimeException("POI error");
        InvalidExcelFileException ex = new InvalidExcelFileException("Parse error", nested);

        assertThat(ex.getCause()).isEqualTo(nested);
    }
}
