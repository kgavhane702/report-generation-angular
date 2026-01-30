package com.org.report_generator.config;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.*;

class PdfExportPropertiesTest {

    @Test
    void defaultValues_areSet() {
        PdfExportProperties props = new PdfExportProperties();

        assertThat(props.getRenderer()).isEqualTo(PdfExportProperties.Renderer.BACKEND);
        assertThat(props.getUiBaseUrl()).isEqualTo("http://localhost:4200");
        assertThat(props.getUiExportPath()).isEqualTo("/export");
        assertThat(props.getUiReadyTimeoutMs()).isEqualTo(60_000);
        assertThat(props.getUiNavigationTimeoutMs()).isEqualTo(30_000);
    }

    @Test
    void setRenderer_updatesRenderer() {
        PdfExportProperties props = new PdfExportProperties();
        props.setRenderer(PdfExportProperties.Renderer.UI);

        assertThat(props.getRenderer()).isEqualTo(PdfExportProperties.Renderer.UI);
    }

    @Test
    void setUiBaseUrl_updatesUrl() {
        PdfExportProperties props = new PdfExportProperties();
        props.setUiBaseUrl("http://example.com:3000");

        assertThat(props.getUiBaseUrl()).isEqualTo("http://example.com:3000");
    }

    @Test
    void setUiExportPath_updatesPath() {
        PdfExportProperties props = new PdfExportProperties();
        props.setUiExportPath("/custom-export");

        assertThat(props.getUiExportPath()).isEqualTo("/custom-export");
    }

    @Test
    void setUiReadyTimeoutMs_updatesTimeout() {
        PdfExportProperties props = new PdfExportProperties();
        props.setUiReadyTimeoutMs(120_000);

        assertThat(props.getUiReadyTimeoutMs()).isEqualTo(120_000);
    }

    @Test
    void setUiNavigationTimeoutMs_updatesTimeout() {
        PdfExportProperties props = new PdfExportProperties();
        props.setUiNavigationTimeoutMs(45_000);

        assertThat(props.getUiNavigationTimeoutMs()).isEqualTo(45_000);
    }

    @Test
    void rendererEnum_hasBackendAndUi() {
        assertThat(PdfExportProperties.Renderer.values())
                .containsExactlyInAnyOrder(
                        PdfExportProperties.Renderer.BACKEND,
                        PdfExportProperties.Renderer.UI
                );
    }
}
