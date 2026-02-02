package com.org.report_generator.service;

import com.org.report_generator.model.document.DocumentModel;
import com.org.report_generator.model.document.Page;
import com.org.report_generator.model.document.Section;
import com.org.report_generator.model.document.Subsection;
import com.org.report_generator.model.document.Widget;
import com.org.report_generator.render.docx.DocxRenderContext;
import com.org.report_generator.render.docx.DocxWidgetRenderer;
import com.org.report_generator.render.docx.DocxWidgetRendererRegistry;
import com.org.report_generator.model.document.PageSize;
import com.org.report_generator.model.document.WidgetPosition;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTPageMar;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTPageSz;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTSectPr;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.STPageOrientation;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigInteger;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

@Service
public class DocxGeneratorService {

    private static final Logger logger = LoggerFactory.getLogger(DocxGeneratorService.class);
    
    private final DocxWidgetRendererRegistry registry;

    public DocxGeneratorService(DocxWidgetRendererRegistry registry) {
        this.registry = registry;
    }

    public byte[] generateDocx(DocumentModel document) {
        try (XWPFDocument doc = new XWPFDocument();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            // Collect pages
            List<Page> pages = collectPages(document);
            logger.info("Generating DOCX for {} pages", pages.size());

            if (pages.isEmpty()) {
                applyPageSettingsToBody(doc, document, null);
            }

            // Iterate Pages
            for (int i = 0; i < pages.size(); i++) {
                Page page = pages.get(i);
                renderPage(doc, page, document);

                // Apply section/page settings for this page, then insert page break if needed.
                XWPFParagraph sect = doc.createParagraph();
                applyPageSettingsToParagraph(sect, document, page);
                if (i < pages.size() - 1) {
                    sect.setPageBreak(true);
                }
            }

            // Write to output stream
            doc.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new RuntimeException("Failed to generate DOCX", e);
        }
    }

    private void renderPage(XWPFDocument doc, Page page, DocumentModel document) {
        if (page.getWidgets() == null) return;

        DocxRenderContext ctx = new DocxRenderContext(document, page, doc);

        // Sort widgets by (y, x) to approximate reading order for flow-based docx
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
            DocxWidgetRenderer renderer = registry.getRenderer(type);
            if (renderer == null && type.equals("shape")) {
                renderer = registry.getRenderer("object");
            }
            
            if (renderer != null) {
                try {
                    renderer.render(widget, ctx);
                } catch (Exception e) {
                    logger.error("Failed to render widget type={} id={}", type, widget.getId(), e);
                    // Add error placeholder?
                    XWPFParagraph p = doc.createParagraph();
                    p.createRun().setText("[Error rendering widget: " + type + "]");
                }
            } else {
                logger.warn("No DOCX renderer for widget type: {}", type);
            }
        }
    }

    private void applyPageSettingsToBody(XWPFDocument doc, DocumentModel document, Page page) {
        PageSize pageSize = Optional.ofNullable(document.getPageSize()).orElse(new PageSize());
        double baseWidth = Optional.ofNullable(pageSize.getWidthMm()).orElse(254d);
        double baseHeight = Optional.ofNullable(pageSize.getHeightMm()).orElse(190.5d);

        String orientation = page != null ? Optional.ofNullable(page.getOrientation()).orElse("landscape") : "landscape";
        boolean portrait = orientation.equalsIgnoreCase("portrait");
        double widthMm = portrait ? Math.min(baseWidth, baseHeight) : Math.max(baseWidth, baseHeight);
        double heightMm = portrait ? Math.max(baseWidth, baseHeight) : Math.min(baseWidth, baseHeight);

        CTSectPr sectPr = doc.getDocument().getBody().isSetSectPr()
                ? doc.getDocument().getBody().getSectPr()
                : doc.getDocument().getBody().addNewSectPr();

        applyPageSettings(sectPr, widthMm, heightMm, portrait);
    }

    private void applyPageSettingsToParagraph(XWPFParagraph paragraph, DocumentModel document, Page page) {
        if (paragraph == null) return;
        PageSize pageSize = Optional.ofNullable(document.getPageSize()).orElse(new PageSize());
        double baseWidth = Optional.ofNullable(pageSize.getWidthMm()).orElse(254d);
        double baseHeight = Optional.ofNullable(pageSize.getHeightMm()).orElse(190.5d);

        String orientation = page != null ? Optional.ofNullable(page.getOrientation()).orElse("landscape") : "landscape";
        boolean portrait = orientation.equalsIgnoreCase("portrait");
        double widthMm = portrait ? Math.min(baseWidth, baseHeight) : Math.max(baseWidth, baseHeight);
        double heightMm = portrait ? Math.max(baseWidth, baseHeight) : Math.min(baseWidth, baseHeight);

        var ctp = paragraph.getCTP();
        var ppr = ctp.isSetPPr() ? ctp.getPPr() : ctp.addNewPPr();
        CTSectPr sectPr = ppr.isSetSectPr() ? ppr.getSectPr() : ppr.addNewSectPr();

        applyPageSettings(sectPr, widthMm, heightMm, portrait);
    }

    private void applyPageSettings(CTSectPr sectPr, double widthMm, double heightMm, boolean portrait) {
        CTPageSz pageSz = sectPr.isSetPgSz() ? sectPr.getPgSz() : sectPr.addNewPgSz();
        pageSz.setW(BigInteger.valueOf(mmToTwips(widthMm)));
        pageSz.setH(BigInteger.valueOf(mmToTwips(heightMm)));
        if (!portrait) {
            pageSz.setOrient(STPageOrientation.LANDSCAPE);
        }

        CTPageMar mar = sectPr.isSetPgMar() ? sectPr.getPgMar() : sectPr.addNewPgMar();
        mar.setLeft(BigInteger.ZERO);
        mar.setRight(BigInteger.ZERO);
        mar.setTop(BigInteger.ZERO);
        mar.setBottom(BigInteger.ZERO);
        mar.setHeader(BigInteger.ZERO);
        mar.setFooter(BigInteger.ZERO);
        mar.setGutter(BigInteger.ZERO);
    }

    private long mmToTwips(double mm) {
        return Math.round(mm * 1440d / 25.4d);
    }

    private List<Page> collectPages(DocumentModel document) {
        List<Page> flattened = new ArrayList<>();
        if (document.getSections() == null) {
            return flattened;
        }

        int pageNumber = 1;
        for (Section section : document.getSections()) {
            if (section == null || section.getSubsections() == null) {
                continue;
            }
            for (Subsection subsection : section.getSubsections()) {
                if (subsection == null || subsection.getPages() == null) {
                    continue;
                }
                for (Page page : subsection.getPages()) {
                    page.setNumber(pageNumber++);
                    flattened.add(page);
                }
            }
        }
        return flattened;
    }
}

