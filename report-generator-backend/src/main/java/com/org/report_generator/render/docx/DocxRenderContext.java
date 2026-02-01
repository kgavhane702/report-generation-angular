package com.org.report_generator.render.docx;

import com.org.report_generator.model.document.DocumentModel;
import com.org.report_generator.model.document.Page;
import org.apache.poi.xwpf.usermodel.XWPFDocument;

public record DocxRenderContext(
    DocumentModel document,
    Page page,
    XWPFDocument docx
) {}
