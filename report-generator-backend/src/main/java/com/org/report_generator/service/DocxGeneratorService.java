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
import com.org.report_generator.render.util.PageSizeUtil;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTPageMar;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTPageSz;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTSectPr;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTSectType;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.STPageOrientation;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.STSectionMark;
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

            // Ensure first page settings are applied before any content is added.
            if (!pages.isEmpty()) {
                applyPageSettingsToBody(doc, document, pages.get(0));
            }

            // Iterate Pages.
            // IMPORTANT: In OOXML, section properties on the section-break paragraph apply to the *next* section.
            // So we set body sectPr for page 1, and after each page we insert a NEXT_PAGE section break with
            // the settings for the upcoming page.
            for (int i = 0; i < pages.size(); i++) {
                Page page = pages.get(i);
                renderPage(doc, page, document);

                if (i < pages.size() - 1) {
                    Page nextPage = pages.get(i + 1);
                    XWPFParagraph sectionBreak = doc.createParagraph();
                    applySectionBreakWithNextPageSettings(sectionBreak, document, nextPage);
                }
            }

            // Write to output stream
            doc.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new RuntimeException("Failed to generate DOCX", e);
        }
    }

    private void applySectionBreakWithNextPageSettings(XWPFParagraph paragraph, DocumentModel document, Page nextPage) {
        if (paragraph == null) return;

        PageSize pageSize = document != null ? document.getPageSize() : null;
        String orientation = nextPage != null ? Optional.ofNullable(nextPage.getOrientation()).orElse("landscape") : "landscape";
        PageSizeUtil.OrientedSizeMm oriented = PageSizeUtil.orientedMm(pageSize, orientation);

        var ctp = paragraph.getCTP();
        var ppr = ctp.isSetPPr() ? ctp.getPPr() : ctp.addNewPPr();
        CTSectPr sectPr = ppr.isSetSectPr() ? ppr.getSectPr() : ppr.addNewSectPr();

        // Ensure this paragraph is a "Next Page" section break.
        CTSectType type = sectPr.isSetType() ? sectPr.getType() : sectPr.addNewType();
        type.setVal(STSectionMark.NEXT_PAGE);

        applyPageSettings(sectPr, oriented.widthMm(), oriented.heightMm(), oriented.portrait());
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
        PageSize pageSize = document != null ? document.getPageSize() : null;
        String orientation = page != null ? Optional.ofNullable(page.getOrientation()).orElse("landscape") : "landscape";
        PageSizeUtil.OrientedSizeMm oriented = PageSizeUtil.orientedMm(pageSize, orientation);

        CTSectPr sectPr = doc.getDocument().getBody().isSetSectPr()
                ? doc.getDocument().getBody().getSectPr()
                : doc.getDocument().getBody().addNewSectPr();

        applyPageSettings(sectPr, oriented.widthMm(), oriented.heightMm(), oriented.portrait());
    }

    private void applyPageSettings(CTSectPr sectPr, double widthMm, double heightMm, boolean portrait) {
        CTPageSz pageSz = sectPr.isSetPgSz() ? sectPr.getPgSz() : sectPr.addNewPgSz();
        pageSz.setW(BigInteger.valueOf(PageSizeUtil.mmToTwips(widthMm)));
        pageSz.setH(BigInteger.valueOf(PageSizeUtil.mmToTwips(heightMm)));
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

