package com.org.report_generator.service.renderer;

import com.org.report_generator.model.document.DocumentModel;
import com.org.report_generator.model.document.Page;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.Collections;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("PageStylesRenderer Tests")
class PageStylesRendererTest {

    @Nested
    @DisplayName("getCss Tests")
    class GetCssTests {

        @Test
        @DisplayName("Returns CSS with page class styles")
        void returnsCssWithPageClassStyles() {
            DocumentModel document = new DocumentModel();
            Page page = new Page();
            page.setId("page-1");
            
            String css = PageStylesRenderer.getCss(List.of(page), document);
            
            assertThat(css).contains(".page");
            assertThat(css).contains("position: relative");
        }

        @Test
        @DisplayName("Returns CSS with page surface styles")
        void returnsCssWithPageSurfaceStyles() {
            DocumentModel document = new DocumentModel();
            Page page = new Page();
            page.setId("page-1");
            
            String css = PageStylesRenderer.getCss(List.of(page), document);
            
            assertThat(css).contains(".page__surface");
            assertThat(css).contains("background: #ffffff");
        }

        @Test
        @DisplayName("Returns CSS with print media query")
        void returnsCssWithPrintMediaQuery() {
            DocumentModel document = new DocumentModel();
            Page page = new Page();
            page.setId("page-1");
            
            String css = PageStylesRenderer.getCss(List.of(page), document);
            
            assertThat(css).contains("@media print");
        }

        @Test
        @DisplayName("Returns CSS with header styles")
        void returnsCssWithHeaderStyles() {
            DocumentModel document = new DocumentModel();
            Page page = new Page();
            page.setId("page-1");
            
            String css = PageStylesRenderer.getCss(List.of(page), document);
            
            assertThat(css).contains(".page__header");
            assertThat(css).contains("z-index: 1000");
        }

        @Test
        @DisplayName("Returns CSS with footer styles")
        void returnsCssWithFooterStyles() {
            DocumentModel document = new DocumentModel();
            Page page = new Page();
            page.setId("page-1");
            
            String css = PageStylesRenderer.getCss(List.of(page), document);
            
            assertThat(css).contains(".page__footer");
        }

        @Test
        @DisplayName("Handles multiple pages without error")
        void handlesMultiplePages() {
            DocumentModel document = new DocumentModel();
            Page page1 = new Page();
            page1.setId("page-1");
            Page page2 = new Page();
            page2.setId("page-2");
            
            String css = PageStylesRenderer.getCss(List.of(page1, page2), document);
            
            assertThat(css).isNotNull();
            assertThat(css).contains(".page");
        }

        @Test
        @DisplayName("Handles empty page list")
        void handlesEmptyPageList() {
            DocumentModel document = new DocumentModel();
            
            String css = PageStylesRenderer.getCss(Collections.emptyList(), document);
            
            assertThat(css).isNotNull();
            assertThat(css).contains(".page");
        }
    }

    @Nested
    @DisplayName("Logo Image Styles Tests")
    class LogoImageStylesTests {

        @Test
        @DisplayName("Contains logo image styles")
        void containsLogoImageStyles() {
            DocumentModel document = new DocumentModel();
            Page page = new Page();
            page.setId("page-1");
            
            String css = PageStylesRenderer.getCss(List.of(page), document);
            
            assertThat(css).contains(".page__logo-image");
            assertThat(css).contains("max-height");
            assertThat(css).contains("object-fit: contain");
        }

        @Test
        @DisplayName("Contains inline logo image variant")
        void containsInlineLogoImageVariant() {
            DocumentModel document = new DocumentModel();
            Page page = new Page();
            page.setId("page-1");
            
            String css = PageStylesRenderer.getCss(List.of(page), document);
            
            assertThat(css).contains(".page__logo-image--inline");
        }
    }
}
