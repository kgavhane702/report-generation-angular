package com.org.report_generator.exception;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.*;

class PdfGenerationTimeoutExceptionTest {

    @Test
    void constructor_withMessage_setsMessage() {
        PdfGenerationTimeoutException ex = new PdfGenerationTimeoutException("Timeout after 60 seconds");

        assertThat(ex.getMessage()).isEqualTo("Timeout after 60 seconds");
        assertThat(ex.getCause()).isNull();
    }

    @Test
    void constructor_withMessageAndCause_setsBoth() {
        Exception cause = new InterruptedException("Thread interrupted");
        PdfGenerationTimeoutException ex = new PdfGenerationTimeoutException("PDF timeout", cause);

        assertThat(ex.getMessage()).isEqualTo("PDF timeout");
        assertThat(ex.getCause()).isEqualTo(cause);
    }

    @Test
    void extendsPdfGenerationException() {
        PdfGenerationTimeoutException ex = new PdfGenerationTimeoutException("Test");

        assertThat(ex).isInstanceOf(PdfGenerationException.class);
    }

    @Test
    void isRuntimeException() {
        PdfGenerationTimeoutException ex = new PdfGenerationTimeoutException("Test");

        assertThat(ex).isInstanceOf(RuntimeException.class);
    }
}
