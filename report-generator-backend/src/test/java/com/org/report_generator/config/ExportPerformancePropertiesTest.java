package com.org.report_generator.config;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.*;

class ExportPerformancePropertiesTest {

    @Test
    void defaultValues_areSet() {
        ExportPerformanceProperties props = new ExportPerformanceProperties();

        assertThat(props.getHtmlRenderThreads()).isEqualTo(0);
        assertThat(props.getParallelThresholdPages()).isEqualTo(12);
        assertThat(props.isUrlTableAutoFitEnabled()).isTrue();
    }

    @Test
    void setHtmlRenderThreads_updatesValue() {
        ExportPerformanceProperties props = new ExportPerformanceProperties();
        props.setHtmlRenderThreads(8);

        assertThat(props.getHtmlRenderThreads()).isEqualTo(8);
    }

    @Test
    void setParallelThresholdPages_updatesValue() {
        ExportPerformanceProperties props = new ExportPerformanceProperties();
        props.setParallelThresholdPages(20);

        assertThat(props.getParallelThresholdPages()).isEqualTo(20);
    }

    @Test
    void setUrlTableAutoFitEnabled_updatesValue() {
        ExportPerformanceProperties props = new ExportPerformanceProperties();
        props.setUrlTableAutoFitEnabled(false);

        assertThat(props.isUrlTableAutoFitEnabled()).isFalse();
    }
}
