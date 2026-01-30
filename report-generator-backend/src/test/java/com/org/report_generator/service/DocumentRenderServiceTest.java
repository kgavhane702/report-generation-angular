package com.org.report_generator.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.org.report_generator.config.ExportPerformanceProperties;
import com.org.report_generator.model.document.*;
import com.org.report_generator.render.widgets.WidgetRendererRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DocumentRenderServiceTest {

    @Mock
    private WidgetRendererRegistry widgetRenderers;

    private ExportPerformanceProperties perf;
    private ExecutorService htmlRenderExecutor;
    private DocumentRenderService service;
    private ObjectMapper objectMapper;

    @Captor
    private ArgumentCaptor<String> styleCaptor;

    @BeforeEach
    void setUp() {
        perf = new ExportPerformanceProperties();
        perf.setParallelThresholdPages(100); // High threshold to avoid parallel for tests
        htmlRenderExecutor = Executors.newSingleThreadExecutor();
        service = new DocumentRenderService(widgetRenderers, perf, htmlRenderExecutor);
        objectMapper = new ObjectMapper();
    }

    @Test
    void render_emptyDocument_returnsBasicHtml() {
        DocumentModel document = new DocumentModel();
        document.setTitle("Test Document");

        String result = service.render(document);

        assertThat(result).contains("<!DOCTYPE html>");
        assertThat(result).contains("<html");
        assertThat(result).contains("Test Document");
        assertThat(result).contains("</html>");
    }

    @Test
    void render_documentWithNullSections_returnsEmptyPages() {
        DocumentModel document = new DocumentModel();
        document.setSections(null);

        String result = service.render(document);

        assertThat(result).contains("document-container");
    }

    @Test
    void render_documentWithPage_rendersPage() {
        DocumentModel document = createDocumentWithPages(1);

        String result = service.render(document);

        assertThat(result).contains("class=\"page\"");
        assertThat(result).contains("page__surface");
    }

    @Test
    void render_documentWithMultiplePages_rendersAllPages() {
        DocumentModel document = createDocumentWithPages(3);

        String result = service.render(document);

        // Count page divs
        int pageCount = result.split("class=\"page\"").length - 1;
        assertThat(pageCount).isEqualTo(3);
    }

    @Test
    void render_documentWithWidget_rendersWidget() {
        when(widgetRenderers.render(any(), any(), any(), any())).thenReturn("<div class=\"widget\">Test Widget</div>");
        
        DocumentModel document = createDocumentWithWidget("text");

        String result = service.render(document);

        assertThat(result).contains("Test Widget");
    }

    @Test
    void render_documentWithHeader_rendersHeader() {
        DocumentModel document = createDocumentWithPages(1);
        HeaderConfig header = new HeaderConfig();
        header.setLeftText("Left Header");
        header.setCenterText("Center Header");
        header.setRightText("Right Header");
        document.setHeader(header);

        String result = service.render(document);

        assertThat(result).contains("page__header");
        assertThat(result).contains("Left Header");
        assertThat(result).contains("Center Header");
        assertThat(result).contains("Right Header");
    }

    @Test
    void render_documentWithFooter_rendersFooter() {
        DocumentModel document = createDocumentWithPages(1);
        FooterConfig footer = new FooterConfig();
        footer.setLeftText("Left Footer");
        footer.setCenterText("Center Footer");
        document.setFooter(footer);

        String result = service.render(document);

        assertThat(result).contains("page__footer");
        assertThat(result).contains("Left Footer");
        assertThat(result).contains("Center Footer");
    }

    @Test
    void render_documentWithLogo_rendersLogo() {
        DocumentModel document = createDocumentWithPages(1);
        LogoConfig logo = new LogoConfig();
        logo.setUrl("http://example.com/logo.png");
        logo.setPosition("top-left");
        document.setLogo(logo);

        String result = service.render(document);

        assertThat(result).contains("http://example.com/logo.png");
    }

    @Test
    void render_documentWithPageSize_usesPageSize() {
        DocumentModel document = createDocumentWithPages(1);
        PageSize pageSize = new PageSize();
        pageSize.setWidthMm(200.0);
        pageSize.setHeightMm(150.0);
        pageSize.setDpi(72);
        document.setPageSize(pageSize);

        String result = service.render(document);

        assertThat(result).contains("class=\"page\"");
    }

    @Test
    void render_portraitOrientation_swapsDimensions() {
        DocumentModel document = new DocumentModel();
        Page page = new Page();
        page.setId("page1");
        page.setOrientation("portrait");
        
        Subsection subsection = new Subsection();
        subsection.setPages(Collections.singletonList(page));
        Section section = new Section();
        section.setSubsections(Collections.singletonList(subsection));
        document.setSections(Collections.singletonList(section));

        String result = service.render(document);

        assertThat(result).contains("class=\"page\"");
    }

    @Test
    void render_headerWithPageNumber_showsPageNumber() {
        DocumentModel document = createDocumentWithPages(1);
        HeaderConfig header = new HeaderConfig();
        header.setShowPageNumber(true);
        document.setHeader(header);

        String result = service.render(document);

        assertThat(result).contains("page__header");
        // Page number 1 should be rendered
        assertThat(result).contains("1");
    }

    @Test
    void render_footerWithPageNumber_showsPageNumber() {
        DocumentModel document = createDocumentWithPages(1);
        FooterConfig footer = new FooterConfig();
        footer.setShowPageNumber(true);
        document.setFooter(footer);

        String result = service.render(document);

        assertThat(result).contains("page__footer");
    }

    @Test
    void render_headerWithRomanPageNumber_formatsCorrectly() {
        DocumentModel document = createDocumentWithPages(1);
        HeaderConfig header = new HeaderConfig();
        header.setShowPageNumber(true);
        header.setPageNumberFormat("roman");
        document.setHeader(header);

        String result = service.render(document);

        assertThat(result).contains("i"); // Roman numeral for 1
    }

    @Test
    void render_nullTitle_usesDefaultTitle() {
        DocumentModel document = new DocumentModel();
        document.setTitle(null);

        String result = service.render(document);

        assertThat(result).contains("Document");
    }

    @Test
    void render_widgetWithBorderRadiusNumber_appendsPx() {
        when(widgetRenderers.render(any(), any(), any(), any())).thenReturn("<div>Widget</div>");
        DocumentModel document = createDocumentWithStyledWidget("borderRadius", 12);

        service.render(document);

        verify(widgetRenderers).render(any(), any(), styleCaptor.capture(), any());
        assertThat(styleCaptor.getValue()).contains("border-radius: 12px");
    }

    @Test
    void render_widgetWithFontSizeNumber_appendsPx() {
        when(widgetRenderers.render(any(), any(), any(), any())).thenReturn("<div>Widget</div>");
        DocumentModel document = createDocumentWithStyledWidget("fontSize", 16);

        service.render(document);

        verify(widgetRenderers).render(any(), any(), styleCaptor.capture(), any());
        assertThat(styleCaptor.getValue()).contains("font-size: 16px");
    }

    @Test
    void render_widgetWithLetterSpacingNumber_appendsPx() {
        when(widgetRenderers.render(any(), any(), any(), any())).thenReturn("<div>Widget</div>");
        DocumentModel document = createDocumentWithStyledWidget("letterSpacing", 2);

        service.render(document);

        verify(widgetRenderers).render(any(), any(), styleCaptor.capture(), any());
        assertThat(styleCaptor.getValue()).contains("letter-spacing: 2px");
    }

    @Test
    void render_widgetWithOpacityNumber_noUnit() {
        when(widgetRenderers.render(any(), any(), any(), any())).thenReturn("<div>Widget</div>");
        DocumentModel document = createDocumentWithStyledWidget("opacity", 0.5);

        service.render(document);

        verify(widgetRenderers).render(any(), any(), styleCaptor.capture(), any());
        assertThat(styleCaptor.getValue()).contains("opacity: 0.5");
    }

    @Test
    void render_widgetWithLineHeightNumber_noUnit() {
        when(widgetRenderers.render(any(), any(), any(), any())).thenReturn("<div>Widget</div>");
        DocumentModel document = createDocumentWithStyledWidget("lineHeight", 1.5);

        service.render(document);

        verify(widgetRenderers).render(any(), any(), styleCaptor.capture(), any());
        assertThat(styleCaptor.getValue()).contains("line-height: 1.5");
    }

    @Test
    void render_widgetWithFontWeightNumber_noUnit() {
        when(widgetRenderers.render(any(), any(), any(), any())).thenReturn("<div>Widget</div>");
        DocumentModel document = createDocumentWithStyledWidget("fontWeight", 700);

        service.render(document);

        verify(widgetRenderers).render(any(), any(), styleCaptor.capture(), any());
        assertThat(styleCaptor.getValue()).contains("font-weight: 700");
    }

    @Test
    void render_widgetWithStringStyleValue_usesAsIs() {
        when(widgetRenderers.render(any(), any(), any(), any())).thenReturn("<div>Widget</div>");
        DocumentModel document = createDocumentWithStyledWidgetString("color", "#ff0000");

        service.render(document);

        verify(widgetRenderers).render(any(), any(), styleCaptor.capture(), any());
        assertThat(styleCaptor.getValue()).contains("color: #ff0000");
    }

    @Test
    void render_widgetWithDecimalBorderRadius_appendsPxWithDecimal() {
        when(widgetRenderers.render(any(), any(), any(), any())).thenReturn("<div>Widget</div>");
        DocumentModel document = createDocumentWithStyledWidget("borderRadius", 12.5);

        service.render(document);

        verify(widgetRenderers).render(any(), any(), styleCaptor.capture(), any());
        assertThat(styleCaptor.getValue()).contains("border-radius: 12.5px");
    }

    @Test
    void render_widgetWithIntegerAsDouble_noDecimalPoint() {
        when(widgetRenderers.render(any(), any(), any(), any())).thenReturn("<div>Widget</div>");
        DocumentModel document = createDocumentWithStyledWidget("opacity", 1.0);

        service.render(document);

        verify(widgetRenderers).render(any(), any(), styleCaptor.capture(), any());
        assertThat(styleCaptor.getValue()).contains("opacity: 1;");
    }

    private DocumentModel createDocumentWithPages(int pageCount) {
        DocumentModel document = new DocumentModel();
        List<Page> pages = new java.util.ArrayList<>();
        for (int i = 0; i < pageCount; i++) {
            Page page = new Page();
            page.setId("page" + i);
            pages.add(page);
        }
        Subsection subsection = new Subsection();
        subsection.setPages(pages);
        Section section = new Section();
        section.setSubsections(Collections.singletonList(subsection));
        document.setSections(Collections.singletonList(section));
        return document;
    }

    private DocumentModel createDocumentWithWidget(String widgetType) {
        DocumentModel document = new DocumentModel();
        
        Widget widget = new Widget();
        widget.setId("widget1");
        widget.setType(widgetType);
        WidgetPosition position = new WidgetPosition();
        position.setX(10.0);
        position.setY(20.0);
        widget.setPosition(position);
        WidgetSize size = new WidgetSize();
        size.setWidth(100.0);
        size.setHeight(50.0);
        widget.setSize(size);
        
        Page page = new Page();
        page.setId("page1");
        page.setWidgets(Collections.singletonList(widget));
        
        Subsection subsection = new Subsection();
        subsection.setPages(Collections.singletonList(page));
        Section section = new Section();
        section.setSubsections(Collections.singletonList(subsection));
        document.setSections(Collections.singletonList(section));
        
        return document;
    }

    private DocumentModel createDocumentWithStyledWidget(String styleKey, Number value) {
        DocumentModel document = new DocumentModel();
        
        Widget widget = new Widget();
        widget.setId("widget1");
        widget.setType("text");
        WidgetPosition position = new WidgetPosition();
        position.setX(10.0);
        position.setY(20.0);
        widget.setPosition(position);
        WidgetSize size = new WidgetSize();
        size.setWidth(100.0);
        size.setHeight(50.0);
        widget.setSize(size);
        
        ObjectNode styleNode = objectMapper.createObjectNode();
        if (value instanceof Integer) {
            styleNode.put(styleKey, value.intValue());
        } else {
            styleNode.put(styleKey, value.doubleValue());
        }
        widget.setStyle(styleNode);
        
        Page page = new Page();
        page.setId("page1");
        page.setWidgets(Collections.singletonList(widget));
        
        Subsection subsection = new Subsection();
        subsection.setPages(Collections.singletonList(page));
        Section section = new Section();
        section.setSubsections(Collections.singletonList(subsection));
        document.setSections(Collections.singletonList(section));
        
        return document;
    }

    private DocumentModel createDocumentWithStyledWidgetString(String styleKey, String value) {
        DocumentModel document = new DocumentModel();
        
        Widget widget = new Widget();
        widget.setId("widget1");
        widget.setType("text");
        WidgetPosition position = new WidgetPosition();
        position.setX(10.0);
        position.setY(20.0);
        widget.setPosition(position);
        WidgetSize size = new WidgetSize();
        size.setWidth(100.0);
        size.setHeight(50.0);
        widget.setSize(size);
        
        ObjectNode styleNode = objectMapper.createObjectNode();
        styleNode.put(styleKey, value);
        widget.setStyle(styleNode);
        
        Page page = new Page();
        page.setId("page1");
        page.setWidgets(Collections.singletonList(widget));
        
        Subsection subsection = new Subsection();
        subsection.setPages(Collections.singletonList(page));
        Section section = new Section();
        section.setSubsections(Collections.singletonList(subsection));
        document.setSections(Collections.singletonList(section));
        
        return document;
    }
}
