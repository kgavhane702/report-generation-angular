package com.org.report_generator.render.html;

import com.org.report_generator.model.document.DocumentModel;
import com.org.report_generator.service.DocumentRenderService;
import org.springframework.stereotype.Service;

/**
 * Thin adapter around the current HTML renderer implementation.
 * Keeps output identical while allowing future renderers (DOCX/PPTX) to coexist.
 */
@Service
public class HtmlDocumentRendererImpl implements HtmlDocumentRenderer {
    private final DocumentRenderService delegate;

    public HtmlDocumentRendererImpl(DocumentRenderService delegate) {
        this.delegate = delegate;
    }

    @Override
    public String render(DocumentModel document) {
        return delegate.render(document);
    }
}


