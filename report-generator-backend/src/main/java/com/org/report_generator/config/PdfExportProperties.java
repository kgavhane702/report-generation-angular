package com.org.report_generator.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "export.pdf")
public class PdfExportProperties {

    public enum Renderer {
        BACKEND,
        UI
    }

    /** Which renderer to use for PDF export. */
    private Renderer renderer = Renderer.BACKEND;

    /** Base URL where the Angular UI is reachable for UI-rendered PDF generation. */
    private String uiBaseUrl = "http://localhost:4200";

    /** Path to the export route in the Angular app. */
    private String uiExportPath = "/export";

    /** Timeout for UI export route to signal readiness. */
    private int uiReadyTimeoutMs = 60_000;

    /** Navigation timeout for loading the export route. */
    private int uiNavigationTimeoutMs = 30_000;

    public Renderer getRenderer() {
        return renderer;
    }

    public void setRenderer(Renderer renderer) {
        this.renderer = renderer;
    }

    public String getUiBaseUrl() {
        return uiBaseUrl;
    }

    public void setUiBaseUrl(String uiBaseUrl) {
        this.uiBaseUrl = uiBaseUrl;
    }

    public String getUiExportPath() {
        return uiExportPath;
    }

    public void setUiExportPath(String uiExportPath) {
        this.uiExportPath = uiExportPath;
    }

    public int getUiReadyTimeoutMs() {
        return uiReadyTimeoutMs;
    }

    public void setUiReadyTimeoutMs(int uiReadyTimeoutMs) {
        this.uiReadyTimeoutMs = uiReadyTimeoutMs;
    }

    public int getUiNavigationTimeoutMs() {
        return uiNavigationTimeoutMs;
    }

    public void setUiNavigationTimeoutMs(int uiNavigationTimeoutMs) {
        this.uiNavigationTimeoutMs = uiNavigationTimeoutMs;
    }
}
