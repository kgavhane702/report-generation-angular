package com.org.report_generator.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;

/**
 * Demo-only endpoints to serve sample datasets over HTTP so you can test URL-based imports.
 *
 * NOTE: This is intentionally a separate controller (does not modify existing import endpoints).
 */
@RestController
@RequestMapping("/api/sample-data")
public class SampleDataController {

    private static final Logger logger = LoggerFactory.getLogger(SampleDataController.class);

    @GetMapping(value = "/stacked-bar-multiple-data.json", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<byte[]> stackedBarMultipleDataJson() throws IOException, InterruptedException {
      return serve("sample-data/stacked-bar-multiple-data.json", MediaType.APPLICATION_JSON, "stacked-bar-multiple-data.json");
    }

    @GetMapping(value = "/sample_split_headers.csv", produces = "text/csv")
    public ResponseEntity<byte[]> sampleSplitHeadersCsv() throws IOException, InterruptedException {
        return serve("sample-data/sample_split_headers.csv", MediaType.valueOf("text/csv"), "sample_split_headers.csv");
    }

    private ResponseEntity<byte[]> serve(String classpathPath, MediaType contentType, String filename) throws IOException {
        ClassPathResource resource = new ClassPathResource(classpathPath);
        if (!resource.exists()) {
            throw new IllegalArgumentException("Sample resource not found: " + classpathPath);
        }
        byte[] bytes = resource.getInputStream().readAllBytes();
        logger.info("Serving sample resource: {} ({} bytes)", classpathPath, bytes.length);

        return ResponseEntity.ok()
                .contentType(contentType)
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"")
                .body(bytes);
    }
}


