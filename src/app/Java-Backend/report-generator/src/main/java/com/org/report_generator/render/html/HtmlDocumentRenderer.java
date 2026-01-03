package com.org.report_generator.render.html;

import com.org.report_generator.model.document.DocumentModel;

public interface HtmlDocumentRenderer {
    String render(DocumentModel document);
}


