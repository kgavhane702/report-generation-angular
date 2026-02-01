package com.org.report_generator.render.pptx;

import com.org.report_generator.model.document.DocumentModel;
import com.org.report_generator.model.document.Page;
import org.apache.poi.xslf.usermodel.XSLFSlide;
import org.apache.poi.xslf.usermodel.XMLSlideShow;

public record PptxRenderContext(
    DocumentModel document,
    Page page,
    XMLSlideShow pptx,
    XSLFSlide slide
) {}
