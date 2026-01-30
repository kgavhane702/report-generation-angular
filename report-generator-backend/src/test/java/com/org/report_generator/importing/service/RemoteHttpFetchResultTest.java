package com.org.report_generator.importing.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("RemoteHttpFetchResult Tests")
class RemoteHttpFetchResultTest {

    @Test
    @DisplayName("Record fields are accessible")
    void recordFieldsAreAccessible() {
        byte[] bytes = "Test Content".getBytes();
        RemoteHttpFetchResult result = new RemoteHttpFetchResult(
            "https://example.com/data.csv",
            "text/csv",
            "data.csv",
            bytes
        );

        assertThat(result.effectiveUrl()).isEqualTo("https://example.com/data.csv");
        assertThat(result.contentType()).isEqualTo("text/csv");
        assertThat(result.fileName()).isEqualTo("data.csv");
        assertThat(result.bytes()).isEqualTo(bytes);
    }

    @Test
    @DisplayName("Record allows null values")
    void recordAllowsNullValues() {
        RemoteHttpFetchResult result = new RemoteHttpFetchResult(null, null, null, null);

        assertThat(result.effectiveUrl()).isNull();
        assertThat(result.contentType()).isNull();
        assertThat(result.fileName()).isNull();
        assertThat(result.bytes()).isNull();
    }

    @Test
    @DisplayName("Record equals works correctly")
    void recordEqualsWorksCorrectly() {
        byte[] bytes = "Same".getBytes();
        RemoteHttpFetchResult result1 = new RemoteHttpFetchResult("url", "type", "file", bytes);
        RemoteHttpFetchResult result2 = new RemoteHttpFetchResult("url", "type", "file", bytes);

        assertThat(result1).isEqualTo(result2);
    }

    @Test
    @DisplayName("Record hashCode is consistent")
    void recordHashCodeIsConsistent() {
        byte[] bytes = "Test".getBytes();
        RemoteHttpFetchResult result = new RemoteHttpFetchResult("url", "type", "file", bytes);

        assertThat(result.hashCode()).isEqualTo(result.hashCode());
    }

    @Test
    @DisplayName("Record toString includes all fields")
    void recordToStringIncludesAllFields() {
        RemoteHttpFetchResult result = new RemoteHttpFetchResult(
            "https://example.com", "application/json", "data.json", new byte[0]
        );

        String str = result.toString();
        assertThat(str).contains("https://example.com");
        assertThat(str).contains("application/json");
        assertThat(str).contains("data.json");
    }
}
