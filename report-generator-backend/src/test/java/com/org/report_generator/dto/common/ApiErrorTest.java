package com.org.report_generator.dto.common;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.*;

class ApiErrorTest {

    @Test
    void constructor_setsAllFields() {
        Map<String, Object> details = Map.of("key", "value");
        ApiError error = new ApiError("ERROR_CODE", "Error message", details);

        assertThat(error.code()).isEqualTo("ERROR_CODE");
        assertThat(error.message()).isEqualTo("Error message");
        assertThat(error.details()).isEqualTo(details);
    }

    @Test
    void constructor_withNullDetails_allowsNull() {
        ApiError error = new ApiError("CODE", "Message", null);

        assertThat(error.details()).isNull();
    }

    @Test
    void record_equality() {
        ApiError error1 = new ApiError("CODE", "Message", null);
        ApiError error2 = new ApiError("CODE", "Message", null);

        assertThat(error1).isEqualTo(error2);
    }

    @Test
    void record_hashCode() {
        ApiError error1 = new ApiError("CODE", "Message", null);
        ApiError error2 = new ApiError("CODE", "Message", null);

        assertThat(error1.hashCode()).isEqualTo(error2.hashCode());
    }

    @Test
    void record_toString_containsFields() {
        ApiError error = new ApiError("TEST_CODE", "Test message", null);

        String string = error.toString();
        assertThat(string).contains("TEST_CODE");
        assertThat(string).contains("Test message");
    }
}
