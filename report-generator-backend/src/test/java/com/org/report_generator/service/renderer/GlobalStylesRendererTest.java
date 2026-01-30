package com.org.report_generator.service.renderer;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("GlobalStylesRenderer Tests")
class GlobalStylesRendererTest {

    @Test
    @DisplayName("getCss returns non-empty CSS")
    void getCss_returnsNonEmptyCss() {
        String css = GlobalStylesRenderer.getCss();
        
        assertThat(css).isNotNull().isNotEmpty();
    }

    @Test
    @DisplayName("getCss contains body styles")
    void getCss_containsBodyStyles() {
        String css = GlobalStylesRenderer.getCss();
        
        assertThat(css).contains("body");
        assertThat(css).contains("font-family");
        assertThat(css).contains("background");
    }

    @Test
    @DisplayName("getCss contains document-container class")
    void getCss_containsDocumentContainer() {
        String css = GlobalStylesRenderer.getCss();
        
        assertThat(css).contains(".document-container");
    }

    @Test
    @DisplayName("getCss contains widget class")
    void getCss_containsWidgetClass() {
        String css = GlobalStylesRenderer.getCss();
        
        assertThat(css).contains(".widget");
        assertThat(css).contains("position: absolute");
    }

    @Test
    @DisplayName("getCss contains print media query")
    void getCss_containsPrintMediaQuery() {
        String css = GlobalStylesRenderer.getCss();
        
        assertThat(css).contains("@media print");
        assertThat(css).contains("box-shadow: none");
    }

    @Test
    @DisplayName("getCss contains print color adjust")
    void getCss_containsPrintColorAdjust() {
        String css = GlobalStylesRenderer.getCss();
        
        assertThat(css).contains("-webkit-print-color-adjust");
        assertThat(css).contains("print-color-adjust");
    }

    @Test
    @DisplayName("getCss returns same instance")
    void getCss_returnsSameInstance() {
        String css1 = GlobalStylesRenderer.getCss();
        String css2 = GlobalStylesRenderer.getCss();
        
        // Static constant should return same string reference
        assertThat(css1).isSameAs(css2);
    }
}
