package com.org.report_generator.service;

import com.org.report_generator.model.document.DocumentModel;
import com.org.report_generator.model.document.Page;
import com.org.report_generator.model.document.PageSize;
import com.org.report_generator.model.document.Section;
import com.org.report_generator.model.document.Subsection;
import com.org.report_generator.model.document.Widget;
import com.org.report_generator.model.document.WidgetPosition;
import com.org.report_generator.render.pptx.PptxRenderContext;
import com.org.report_generator.render.pptx.PptxWidgetRenderer;
import com.org.report_generator.render.pptx.PptxWidgetRendererRegistry;
import org.apache.poi.xslf.usermodel.XMLSlideShow;
import org.apache.poi.xslf.usermodel.XSLFSlide;
import org.apache.poi.xslf.usermodel.XSLFSlideLayout;
import org.apache.poi.xslf.usermodel.XSLFSlideMaster;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.awt.Dimension;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

@Service
public class PptxGeneratorService {

    private static final Logger logger = LoggerFactory.getLogger(PptxGeneratorService.class);
    
    private final PptxWidgetRendererRegistry registry;

    public PptxGeneratorService(PptxWidgetRendererRegistry registry) {
        this.registry = registry;
    }

    public byte[] generatePptx(DocumentModel document) {
        try (XMLSlideShow pptx = new XMLSlideShow();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            // Collect pages
            List<Page> pages = collectPages(document);
            logger.info("Generating PPTX for {} pages", pages.size());

            // Apply slide size from document
            applySlideSize(pptx, document, pages.isEmpty() ? null : pages.get(0));

            // Get blank layout for slides
            XSLFSlideMaster master = pptx.getSlideMasters().isEmpty() ? null : pptx.getSlideMasters().get(0);
            XSLFSlideLayout blankLayout = findBlankLayout(master);

            // Iterate Pages - each page becomes a slide
            for (Page page : pages) {
                XSLFSlide slide;
                if (blankLayout != null) {
                    slide = pptx.createSlide(blankLayout);
                } else {
                    slide = pptx.createSlide();
                }
                
                renderSlide(pptx, slide, page, document);
            }

            // Write to output stream
            pptx.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new RuntimeException("Failed to generate PPTX", e);
        }
    }

    private XSLFSlideLayout findBlankLayout(XSLFSlideMaster master) {
        if (master == null) return null;
        for (XSLFSlideLayout layout : master.getSlideLayouts()) {
            String name = layout.getName();
            if (name != null && name.toLowerCase(Locale.ROOT).contains("blank")) {
                return layout;
            }
        }
        // Return first layout if no blank found
        XSLFSlideLayout[] layouts = master.getSlideLayouts();
        return layouts.length > 0 ? layouts[0] : null;
    }

    private void renderSlide(XMLSlideShow pptx, XSLFSlide slide, Page page, DocumentModel document) {
        if (page.getWidgets() == null) return;

        PptxRenderContext ctx = new PptxRenderContext(document, page, pptx, slide);

        // Sort widgets by (y, x) for consistent rendering order
        List<Widget> widgets = new ArrayList<>(page.getWidgets());
        widgets.sort((a, b) -> {
            WidgetPosition ap = a != null ? a.getPosition() : null;
            WidgetPosition bp = b != null ? b.getPosition() : null;
            double ay = ap != null && ap.getY() != null ? ap.getY() : Double.MAX_VALUE;
            double by = bp != null && bp.getY() != null ? bp.getY() : Double.MAX_VALUE;
            int cy = Double.compare(ay, by);
            if (cy != 0) return cy;
            double ax = ap != null && ap.getX() != null ? ap.getX() : Double.MAX_VALUE;
            double bx = bp != null && bp.getX() != null ? bp.getX() : Double.MAX_VALUE;
            return Double.compare(ax, bx);
        });

        for (Widget widget : widgets) {
            if (widget == null) continue;
            
            String type = Optional.ofNullable(widget.getType()).orElse("").toLowerCase(Locale.ROOT);
            PptxWidgetRenderer renderer = registry.getRenderer(type);
            if (renderer == null && type.equals("shape")) {
                renderer = registry.getRenderer("object");
            }
            
            if (renderer != null) {
                try {
                    renderer.render(widget, ctx);
                } catch (Exception e) {
                    logger.error("Failed to render widget type={} id={}", type, widget.getId(), e);
                }
            } else {
                logger.warn("No PPTX renderer for widget type: {}", type);
            }
        }
    }

    private void applySlideSize(XMLSlideShow pptx, DocumentModel document, Page page) {
        PageSize pageSize = Optional.ofNullable(document.getPageSize()).orElse(new PageSize());
        double baseWidthMm = Optional.ofNullable(pageSize.getWidthMm()).orElse(254d);
        double baseHeightMm = Optional.ofNullable(pageSize.getHeightMm()).orElse(190.5d);

        String orientation = page != null ? Optional.ofNullable(page.getOrientation()).orElse("landscape") : "landscape";
        boolean portrait = orientation.equalsIgnoreCase("portrait");
        double widthMm = portrait ? Math.min(baseWidthMm, baseHeightMm) : Math.max(baseWidthMm, baseHeightMm);
        double heightMm = portrait ? Math.max(baseWidthMm, baseHeightMm) : Math.min(baseWidthMm, baseHeightMm);

        // Convert mm to points (1 inch = 25.4mm, 1 inch = 72 points)
        int widthPts = (int) Math.round(widthMm * 72.0 / 25.4);
        int heightPts = (int) Math.round(heightMm * 72.0 / 25.4);

        pptx.setPageSize(new Dimension(widthPts, heightPts));
    }

    private List<Page> collectPages(DocumentModel document) {
        List<Page> pages = new ArrayList<>();
        if (document.getSections() == null) return pages;
        for (Section section : document.getSections()) {
            if (section == null || section.getSubsections() == null) continue;
            for (Subsection subsection : section.getSubsections()) {
                if (subsection == null || subsection.getPages() == null) continue;
                for (Page page : subsection.getPages()) {
                    if (page != null) {
                        pages.add(page);
                    }
                }
            }
        }
        return pages;
    }
}
