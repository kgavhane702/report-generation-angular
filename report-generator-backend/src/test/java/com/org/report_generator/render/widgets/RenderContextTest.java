package com.org.report_generator.render.widgets;

import com.org.report_generator.model.document.DocumentModel;
import com.org.report_generator.model.document.Page;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class RenderContextTest {

    @Test
    void shouldCreateRenderContextWithDocumentAndPage() {
        DocumentModel document = new DocumentModel();
        document.setTitle("Test Document");
        Page page = new Page();
        page.setId("page-1");
        page.setNumber(1);

        RenderContext ctx = new RenderContext(document, page);

        assertThat(ctx.document()).isEqualTo(document);
        assertThat(ctx.page()).isEqualTo(page);
    }

    @Test
    void shouldAllowNullValues() {
        RenderContext ctx = new RenderContext(null, null);

        assertThat(ctx.document()).isNull();
        assertThat(ctx.page()).isNull();
    }

    @Test
    void shouldSupportEquality() {
        DocumentModel document = new DocumentModel();
        Page page = new Page();

        RenderContext ctx1 = new RenderContext(document, page);
        RenderContext ctx2 = new RenderContext(document, page);

        assertThat(ctx1).isEqualTo(ctx2);
    }

    @Test
    void shouldSupportHashCode() {
        DocumentModel document = new DocumentModel();
        Page page = new Page();

        RenderContext ctx1 = new RenderContext(document, page);
        RenderContext ctx2 = new RenderContext(document, page);

        assertThat(ctx1.hashCode()).isEqualTo(ctx2.hashCode());
    }

    @Test
    void shouldGenerateToString() {
        RenderContext ctx = new RenderContext(null, null);

        String string = ctx.toString();
        
        assertThat(string).contains("RenderContext");
    }
}
