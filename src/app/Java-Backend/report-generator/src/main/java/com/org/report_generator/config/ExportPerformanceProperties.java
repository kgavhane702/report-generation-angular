package com.org.report_generator.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Performance tuning knobs for export/render pipelines.
 *
 * Defaults are conservative so small documents remain fast and we don't overwhelm the host.
 */
@ConfigurationProperties(prefix = "export.performance")
public class ExportPerformanceProperties {

    /**
     * Number of threads used for parallel HTML page rendering.
     * If <= 0, defaults to min(4, availableProcessors).
     */
    private int htmlRenderThreads = 0;

    /**
     * Enable parallel page rendering only when page count >= this threshold.
     * Keeps overhead low for small docs (3-6 pages) but scales for large docs.
     */
    private int parallelThresholdPages = 12;

    /**
     * URL table auto-fit scaling runs an expensive DOM measurement pass inside Chromium before printing.
     * This improves correctness (less clipped text) but can slow down very large documents.
     */
    private boolean urlTableAutoFitEnabled = true;

    public int getHtmlRenderThreads() {
        return htmlRenderThreads;
    }

    public void setHtmlRenderThreads(int htmlRenderThreads) {
        this.htmlRenderThreads = htmlRenderThreads;
    }

    public int getParallelThresholdPages() {
        return parallelThresholdPages;
    }

    public void setParallelThresholdPages(int parallelThresholdPages) {
        this.parallelThresholdPages = parallelThresholdPages;
    }

    public boolean isUrlTableAutoFitEnabled() {
        return urlTableAutoFitEnabled;
    }

    public void setUrlTableAutoFitEnabled(boolean urlTableAutoFitEnabled) {
        this.urlTableAutoFitEnabled = urlTableAutoFitEnabled;
    }
}


