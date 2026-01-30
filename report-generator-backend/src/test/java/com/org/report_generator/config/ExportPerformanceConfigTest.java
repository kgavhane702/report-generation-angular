package com.org.report_generator.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.*;

@DisplayName("ExportPerformanceConfig Tests")
class ExportPerformanceConfigTest {

    @Test
    @DisplayName("htmlRenderExecutor uses requested thread count when positive")
    void htmlRenderExecutor_usesRequestedThreadCount_whenPositive() throws InterruptedException {
        ExportPerformanceConfig config = new ExportPerformanceConfig();
        ExportPerformanceProperties props = new ExportPerformanceProperties();
        props.setHtmlRenderThreads(2);

        ExecutorService executor = config.htmlRenderExecutor(props);

        assertThat(executor).isNotNull();
        executor.shutdown();
        assertThat(executor.awaitTermination(1, TimeUnit.SECONDS)).isTrue();
    }

    @Test
    @DisplayName("htmlRenderExecutor uses default thread count when zero")
    void htmlRenderExecutor_usesDefaultThreadCount_whenZero() throws InterruptedException {
        ExportPerformanceConfig config = new ExportPerformanceConfig();
        ExportPerformanceProperties props = new ExportPerformanceProperties();
        props.setHtmlRenderThreads(0);

        ExecutorService executor = config.htmlRenderExecutor(props);

        assertThat(executor).isNotNull();
        executor.shutdown();
        assertThat(executor.awaitTermination(1, TimeUnit.SECONDS)).isTrue();
    }

    @Test
    @DisplayName("htmlRenderExecutor uses default thread count when negative")
    void htmlRenderExecutor_usesDefaultThreadCount_whenNegative() throws InterruptedException {
        ExportPerformanceConfig config = new ExportPerformanceConfig();
        ExportPerformanceProperties props = new ExportPerformanceProperties();
        props.setHtmlRenderThreads(-1);

        ExecutorService executor = config.htmlRenderExecutor(props);

        assertThat(executor).isNotNull();
        executor.shutdown();
        assertThat(executor.awaitTermination(1, TimeUnit.SECONDS)).isTrue();
    }

    @Test
    @DisplayName("htmlRenderExecutor creates daemon threads")
    void htmlRenderExecutor_createsDaemonThreads() throws Exception {
        ExportPerformanceConfig config = new ExportPerformanceConfig();
        ExportPerformanceProperties props = new ExportPerformanceProperties();
        props.setHtmlRenderThreads(1);

        ExecutorService executor = config.htmlRenderExecutor(props);
        final boolean[] isDaemon = {false};
        final String[] threadName = {""};

        executor.submit(() -> {
            isDaemon[0] = Thread.currentThread().isDaemon();
            threadName[0] = Thread.currentThread().getName();
        }).get(1, TimeUnit.SECONDS);

        assertThat(isDaemon[0]).isTrue();
        assertThat(threadName[0]).startsWith("html-render-");

        executor.shutdown();
        executor.awaitTermination(1, TimeUnit.SECONDS);
    }

    @Test
    @DisplayName("htmlRenderExecutor executes tasks successfully")
    void htmlRenderExecutor_executesTasksSuccessfully() throws Exception {
        ExportPerformanceConfig config = new ExportPerformanceConfig();
        ExportPerformanceProperties props = new ExportPerformanceProperties();
        props.setHtmlRenderThreads(2);

        ExecutorService executor = config.htmlRenderExecutor(props);
        String result = executor.submit(() -> "test-result").get(1, TimeUnit.SECONDS);

        assertThat(result).isEqualTo("test-result");

        executor.shutdown();
        executor.awaitTermination(1, TimeUnit.SECONDS);
    }
}
