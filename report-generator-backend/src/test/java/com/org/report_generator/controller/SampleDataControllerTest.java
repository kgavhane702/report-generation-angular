package com.org.report_generator.controller;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(SampleDataController.class)
@DisplayName("SampleDataController Tests")
class SampleDataControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("GET /api/sample-data/stacked-bar-multiple-data.json returns JSON")
    void getStackedBarMultipleDataJson_returnsJson() throws Exception {
        mockMvc.perform(get("/api/sample-data/stacked-bar-multiple-data.json"))
            .andExpect(status().isOk())
            .andExpect(content().contentType("application/json"))
            .andExpect(header().exists("Cache-Control"))
            .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.containsString("stacked-bar-multiple-data.json")));
    }

    @Test
    @DisplayName("GET /api/sample-data/sample_split_headers.csv returns CSV")
    void getSampleSplitHeadersCsv_returnsCsv() throws Exception {
        mockMvc.perform(get("/api/sample-data/sample_split_headers.csv"))
            .andExpect(status().isOk())
            .andExpect(content().contentType("text/csv"))
            .andExpect(header().exists("Cache-Control"))
            .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.containsString("sample_split_headers.csv")));
    }
}
