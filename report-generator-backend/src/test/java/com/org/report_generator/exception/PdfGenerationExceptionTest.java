package com.org.report_generator.exception;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.*;

class PdfGenerationExceptionTest {

    @Test
    void constructor_withMessage_setsMessage() {
        PdfGenerationException ex = new PdfGenerationException("PDF generation failed");

        assertThat(ex.getMessage()).isEqualTo("PDF generation failed");
        assertThat(ex.getCause()).isNull();
    }

    @Test
    void constructor_withMessageAndCause_setsBoth() {
        Exception cause = new IllegalStateException("Browser not available");
        PdfGenerationException ex = new PdfGenerationException("PDF generation failed", cause);

        assertThat(ex.getMessage()).isEqualTo("PDF generation failed");
        assertThat(ex.getCause()).isEqualTo(cause);
    }

    @Test
    void isRuntimeException() {
        PdfGenerationException ex = new PdfGenerationException("Test");

        assertThat(ex).isInstanceOf(RuntimeException.class);
    }

    @Test
    void getCause_returnsCause() {
        RuntimeException cause = new RuntimeException("Root cause");
        PdfGenerationException ex = new PdfGenerationException("Wrapped error", cause);

        assertThat(ex.getCause()).isInstanceOf(RuntimeException.class);
        assertThat(ex.getCause().getMessage()).isEqualTo("Root cause");
    }
}
