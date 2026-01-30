package com.org.report_generator.dto.common;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.*;

class ApiResponseTest {

    @Test
    void ok_createsSuccessfulResponse() {
        String data = "Test data";
        ApiResponse<String> response = ApiResponse.ok(data);

        assertThat(response.success()).isTrue();
        assertThat(response.data()).isEqualTo("Test data");
        assertThat(response.error()).isNull();
    }

    @Test
    void ok_withNullData_createsSuccessfulResponse() {
        ApiResponse<String> response = ApiResponse.ok(null);

        assertThat(response.success()).isTrue();
        assertThat(response.data()).isNull();
        assertThat(response.error()).isNull();
    }

    @Test
    void fail_withApiError_createsFailedResponse() {
        ApiError error = new ApiError("ERR_CODE", "Error message", null);
        ApiResponse<Void> response = ApiResponse.fail(error);

        assertThat(response.success()).isFalse();
        assertThat(response.data()).isNull();
        assertThat(response.error()).isEqualTo(error);
    }

    @Test
    void fail_withCodeAndMessage_createsFailedResponse() {
        ApiResponse<Void> response = ApiResponse.fail("VALIDATION_ERROR", "Invalid input");

        assertThat(response.success()).isFalse();
        assertThat(response.data()).isNull();
        assertThat(response.error()).isNotNull();
        assertThat(response.error().code()).isEqualTo("VALIDATION_ERROR");
        assertThat(response.error().message()).isEqualTo("Invalid input");
    }

    @Test
    void fail_withCodeMessageAndDetails_createsFailedResponse() {
        Map<String, Object> details = Map.of("field", "name", "reason", "too short");
        ApiResponse<Void> response = ApiResponse.fail("VALIDATION_ERROR", "Invalid input", details);

        assertThat(response.success()).isFalse();
        assertThat(response.error()).isNotNull();
        assertThat(response.error().details()).isEqualTo(details);
    }

    @Test
    void record_equality() {
        String data = "Same data";
        ApiResponse<String> response1 = ApiResponse.ok(data);
        ApiResponse<String> response2 = ApiResponse.ok(data);

        assertThat(response1).isEqualTo(response2);
    }

    @Test
    void record_hashCode() {
        String data = "Same data";
        ApiResponse<String> response1 = ApiResponse.ok(data);
        ApiResponse<String> response2 = ApiResponse.ok(data);

        assertThat(response1.hashCode()).isEqualTo(response2.hashCode());
    }
}
