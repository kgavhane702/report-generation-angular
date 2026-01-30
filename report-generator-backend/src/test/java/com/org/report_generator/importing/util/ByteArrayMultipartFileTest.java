package com.org.report_generator.importing.util;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("ByteArrayMultipartFile Tests")
class ByteArrayMultipartFileTest {

    @Test
    @DisplayName("Constructor with all parameters")
    void constructor_withAllParameters_setsFieldsCorrectly() {
        byte[] content = "Hello World".getBytes();
        ByteArrayMultipartFile file = new ByteArrayMultipartFile(
            "testName",
            "test.txt",
            "text/plain",
            content
        );

        assertThat(file.getName()).isEqualTo("testName");
        assertThat(file.getOriginalFilename()).isEqualTo("test.txt");
        assertThat(file.getContentType()).isEqualTo("text/plain");
    }

    @Test
    @DisplayName("Constructor with null name defaults to 'file'")
    void constructor_withNullName_defaultsToFile() {
        ByteArrayMultipartFile file = new ByteArrayMultipartFile(
            null, "test.txt", "text/plain", new byte[0]
        );

        assertThat(file.getName()).isEqualTo("file");
    }

    @Test
    @DisplayName("Constructor with null bytes defaults to empty array")
    void constructor_withNullBytes_defaultsToEmptyArray() throws IOException {
        ByteArrayMultipartFile file = new ByteArrayMultipartFile(
            "test", "test.txt", "text/plain", null
        );

        assertThat(file.getBytes()).isEmpty();
        assertThat(file.isEmpty()).isTrue();
        assertThat(file.getSize()).isZero();
    }

    @Test
    @DisplayName("isEmpty returns false for non-empty content")
    void isEmpty_withContent_returnsFalse() {
        byte[] content = "content".getBytes();
        ByteArrayMultipartFile file = new ByteArrayMultipartFile(
            "test", "test.txt", "text/plain", content
        );

        assertThat(file.isEmpty()).isFalse();
    }

    @Test
    @DisplayName("getSize returns correct byte count")
    void getSize_returnsCorrectByteCount() {
        byte[] content = new byte[42];
        ByteArrayMultipartFile file = new ByteArrayMultipartFile(
            "test", "test.txt", "text/plain", content
        );

        assertThat(file.getSize()).isEqualTo(42);
    }

    @Test
    @DisplayName("getBytes returns content bytes")
    void getBytes_returnsContentBytes() throws IOException {
        byte[] content = "Hello World".getBytes();
        ByteArrayMultipartFile file = new ByteArrayMultipartFile(
            "test", "test.txt", "text/plain", content
        );

        assertThat(file.getBytes()).isEqualTo(content);
    }

    @Test
    @DisplayName("getInputStream returns readable stream")
    void getInputStream_returnsReadableStream() throws IOException {
        byte[] content = "Test Content".getBytes();
        ByteArrayMultipartFile file = new ByteArrayMultipartFile(
            "test", "test.txt", "text/plain", content
        );

        try (InputStream is = file.getInputStream()) {
            byte[] readBytes = is.readAllBytes();
            assertThat(readBytes).isEqualTo(content);
        }
    }

    @Test
    @DisplayName("transferTo throws UnsupportedOperationException")
    void transferTo_throwsUnsupportedOperationException() {
        ByteArrayMultipartFile file = new ByteArrayMultipartFile(
            "test", "test.txt", "text/plain", new byte[0]
        );

        assertThatThrownBy(() -> file.transferTo(new File("temp.txt")))
            .isInstanceOf(UnsupportedOperationException.class)
            .hasMessageContaining("not supported");
    }

    @Test
    @DisplayName("getOriginalFilename returns original filename")
    void getOriginalFilename_returnsOriginalFilename() {
        ByteArrayMultipartFile file = new ByteArrayMultipartFile(
            "test", "original.pdf", "application/pdf", new byte[0]
        );

        assertThat(file.getOriginalFilename()).isEqualTo("original.pdf");
    }

    @Test
    @DisplayName("getContentType returns content type")
    void getContentType_returnsContentType() {
        ByteArrayMultipartFile file = new ByteArrayMultipartFile(
            "test", "image.png", "image/png", new byte[0]
        );

        assertThat(file.getContentType()).isEqualTo("image/png");
    }
}
