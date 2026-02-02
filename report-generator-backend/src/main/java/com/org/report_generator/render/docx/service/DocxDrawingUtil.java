package com.org.report_generator.render.docx.service;

import com.org.report_generator.model.document.Widget;
import com.org.report_generator.model.document.WidgetPosition;
import com.org.report_generator.model.document.WidgetSize;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.apache.xmlbeans.XmlCursor;
import org.openxmlformats.schemas.drawingml.x2006.main.*;
import org.openxmlformats.schemas.drawingml.x2006.wordprocessingDrawing.CTAnchor;
import org.openxmlformats.schemas.drawingml.x2006.wordprocessingDrawing.CTEffectExtent;
import org.openxmlformats.schemas.drawingml.x2006.wordprocessingDrawing.CTPosH;
import org.openxmlformats.schemas.drawingml.x2006.wordprocessingDrawing.CTPosV;
import org.openxmlformats.schemas.drawingml.x2006.wordprocessingDrawing.STRelFromH;
import org.openxmlformats.schemas.drawingml.x2006.wordprocessingDrawing.STRelFromV;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTDrawing;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTR;

import javax.xml.namespace.QName;

/**
 * Utility for creating absolutely positioned text boxes and shapes in DOCX
 * using Word's Drawing layer (DrawingML) instead of paragraph frames.
 * 
 * This approach is more reliable for absolute positioning as it uses
 * the same mechanism as PowerPoint (anchored drawing objects).
 */
public final class DocxDrawingUtil {

    private DocxDrawingUtil() {}

    // EMU (English Metric Units) conversion: 1 inch = 914400 EMU, 1 px at 96 dpi = 9525 EMU
    private static final long EMU_PER_PX = 9525L;

    // Namespace URIs
    private static final String WP_NS = "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing";
    private static final String A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main";
    private static final String WPS_NS = "http://schemas.microsoft.com/office/word/2010/wordprocessingShape";
    private static final String WP14_NS = "http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing";
    private static final String PIC_NS = "http://schemas.openxmlformats.org/drawingml/2006/picture";
    private static final String R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

    /**
     * Create an absolutely positioned text box with rich text content.
     */
    public static void createTextBox(
            XWPFDocument doc,
            Widget widget,
            String textContent,
            String backgroundColor,
            String textAlign
    ) {
        if (widget == null) return;
        
        WidgetPosition pos = widget.getPosition();
        WidgetSize size = widget.getSize();
        if (pos == null || size == null) return;

        long xEmu = toEmu(pos.getX());
        long yEmu = toEmu(pos.getY());
        long wEmu = toEmu(size.getWidth());
        long hEmu = toEmu(size.getHeight());

        XWPFParagraph para = doc.createParagraph();
        XWPFRun run = para.createRun();
        CTR ctr = run.getCTR();

        // Create the drawing element
        CTDrawing drawing = ctr.addNewDrawing();
        
        // Create anchor for absolute positioning
        CTAnchor anchor = drawing.addNewAnchor();
        anchor.setDistT(0L);
        anchor.setDistB(0L);
        anchor.setDistL(0L);
        anchor.setDistR(0L);
        anchor.setSimplePos2(false);
        anchor.setBehindDoc(false);
        anchor.setLocked(false);
        anchor.setLayoutInCell(true);
        anchor.setAllowOverlap(true);
        anchor.setRelativeHeight(0);

        // Simple position (not used but required)
        var simplePos = anchor.addNewSimplePos();
        simplePos.setX(0);
        simplePos.setY(0);

        // Horizontal position - absolute from page
        CTPosH posH = anchor.addNewPositionH();
        posH.setRelativeFrom(STRelFromH.PAGE);
        posH.setPosOffset((int) xEmu);

        // Vertical position - absolute from page
        CTPosV posV = anchor.addNewPositionV();
        posV.setRelativeFrom(STRelFromV.PAGE);
        posV.setPosOffset((int) yEmu);

        // Extent (size)
        var extent = anchor.addNewExtent();
        extent.setCx(wEmu);
        extent.setCy(hEmu);

        // Effect extent (no effects)
        CTEffectExtent effectExtent = anchor.addNewEffectExtent();
        effectExtent.setL(0);
        effectExtent.setT(0);
        effectExtent.setR(0);
        effectExtent.setB(0);

        // Wrap none (no text wrapping)
        anchor.addNewWrapNone();

        // Document properties
        var docPr = anchor.addNewDocPr();
        docPr.setId(getNextId());
        docPr.setName("TextBox " + docPr.getId());

        // Non-visual graphic frame properties
        anchor.addNewCNvGraphicFramePr();

        // Create graphic with text box shape
        CTGraphicalObject graphic = anchor.addNewGraphic();
        CTGraphicalObjectData graphicData = graphic.addNewGraphicData();
        graphicData.setUri(WPS_NS);

        // Build the wsp:wsp element using XmlCursor
        XmlCursor cursor = graphicData.newCursor();
        cursor.toEndToken();
        cursor.beginElement(new QName(WPS_NS, "wsp", "wps"));

        // Add cNvSpPr (non-visual shape properties)
        cursor.beginElement(new QName(WPS_NS, "cNvSpPr", "wps"));
        cursor.insertAttributeWithValue("txBox", "1");
        cursor.toEndToken();
        cursor.toNextToken();

        // Add spPr (shape properties)
        cursor.beginElement(new QName(WPS_NS, "spPr", "wps"));
        
        // xfrm (transform)
        cursor.beginElement(new QName(A_NS, "xfrm", "a"));
        cursor.beginElement(new QName(A_NS, "off", "a"));
        cursor.insertAttributeWithValue("x", "0");
        cursor.insertAttributeWithValue("y", "0");
        cursor.toEndToken();
        cursor.toNextToken();
        cursor.beginElement(new QName(A_NS, "ext", "a"));
        cursor.insertAttributeWithValue("cx", String.valueOf(wEmu));
        cursor.insertAttributeWithValue("cy", String.valueOf(hEmu));
        cursor.toEndToken();
        cursor.toNextToken();
        cursor.toEndToken();
        cursor.toNextToken();

        // prstGeom (preset geometry - rectangle)
        cursor.beginElement(new QName(A_NS, "prstGeom", "a"));
        cursor.insertAttributeWithValue("prst", "rect");
        cursor.beginElement(new QName(A_NS, "avLst", "a"));
        cursor.toEndToken();
        cursor.toNextToken();
        cursor.toEndToken();
        cursor.toNextToken();

        // Fill
        String bgColor = normalizeColor(backgroundColor);
        if (bgColor != null && !bgColor.isEmpty()) {
            cursor.beginElement(new QName(A_NS, "solidFill", "a"));
            cursor.beginElement(new QName(A_NS, "srgbClr", "a"));
            cursor.insertAttributeWithValue("val", bgColor);
            cursor.toEndToken();
            cursor.toNextToken();
            cursor.toEndToken();
            cursor.toNextToken();
        } else {
            cursor.beginElement(new QName(A_NS, "noFill", "a"));
            cursor.toEndToken();
            cursor.toNextToken();
        }

        // No line (border)
        cursor.beginElement(new QName(A_NS, "ln", "a"));
        cursor.beginElement(new QName(A_NS, "noFill", "a"));
        cursor.toEndToken();
        cursor.toNextToken();
        cursor.toEndToken();
        cursor.toNextToken();

        cursor.toEndToken(); // end spPr
        cursor.toNextToken();

        // Add txbx (text box content)
        cursor.beginElement(new QName(WPS_NS, "txbx", "wps"));
        cursor.beginElement(new QName("http://schemas.openxmlformats.org/wordprocessingml/2006/main", "txbxContent", "w"));
        
        // Add paragraph with text
        cursor.beginElement(new QName("http://schemas.openxmlformats.org/wordprocessingml/2006/main", "p", "w"));
        
        // Paragraph properties for alignment
        if (textAlign != null && !textAlign.isEmpty()) {
            cursor.beginElement(new QName("http://schemas.openxmlformats.org/wordprocessingml/2006/main", "pPr", "w"));
            cursor.beginElement(new QName("http://schemas.openxmlformats.org/wordprocessingml/2006/main", "jc", "w"));
            String jcVal = switch (textAlign.toLowerCase()) {
                case "center" -> "center";
                case "right" -> "right";
                case "justify" -> "both";
                default -> "left";
            };
            cursor.insertAttributeWithValue("val", jcVal);
            cursor.toEndToken();
            cursor.toNextToken();
            cursor.toEndToken();
            cursor.toNextToken();
        }

        // Run with text
        cursor.beginElement(new QName("http://schemas.openxmlformats.org/wordprocessingml/2006/main", "r", "w"));
        cursor.beginElement(new QName("http://schemas.openxmlformats.org/wordprocessingml/2006/main", "t", "w"));
        cursor.insertChars(stripHtml(textContent));
        cursor.toEndToken();
        cursor.toNextToken();
        cursor.toEndToken();
        cursor.toNextToken();

        cursor.toEndToken(); // end p
        cursor.toNextToken();
        cursor.toEndToken(); // end txbxContent
        cursor.toNextToken();
        cursor.toEndToken(); // end txbx
        cursor.toNextToken();

        // Add bodyPr (body properties)
        cursor.beginElement(new QName(WPS_NS, "bodyPr", "wps"));
        cursor.insertAttributeWithValue("rot", "0");
        cursor.insertAttributeWithValue("vert", "horz");
        cursor.insertAttributeWithValue("wrap", "square");
        cursor.insertAttributeWithValue("lIns", "91440");
        cursor.insertAttributeWithValue("tIns", "45720");
        cursor.insertAttributeWithValue("rIns", "91440");
        cursor.insertAttributeWithValue("bIns", "45720");
        cursor.insertAttributeWithValue("anchor", "t");
        cursor.insertAttributeWithValue("anchorCtr", "0");
        cursor.toEndToken();
        cursor.toNextToken();

        cursor.dispose();
    }

    private static long toEmu(Double px) {
        if (px == null) return 0;
        return Math.round(px * EMU_PER_PX);
    }

    private static long nextId = 1;
    private static synchronized long getNextId() {
        return nextId++;
    }

    public static void createAnchoredImage(XWPFDocument doc, Widget widget, byte[] bytes, int pictureType, String name) {
        if (doc == null || widget == null || bytes == null || bytes.length == 0) return;
        WidgetPosition pos = widget.getPosition();
        WidgetSize size = widget.getSize();
        if (pos == null || size == null) return;

        long xEmu = toEmu(pos.getX());
        long yEmu = toEmu(pos.getY());
        long wEmu = toEmu(size.getWidth());
        long hEmu = toEmu(size.getHeight());

        try {
            String relationId = doc.addPictureData(bytes, pictureType);

            XWPFParagraph para = doc.createParagraph();
            XWPFRun run = para.createRun();
            CTR ctr = run.getCTR();

            CTDrawing drawing = ctr.addNewDrawing();
            CTAnchor anchor = drawing.addNewAnchor();
            anchor.setDistT(0L);
            anchor.setDistB(0L);
            anchor.setDistL(0L);
            anchor.setDistR(0L);
            anchor.setSimplePos2(false);
            anchor.setBehindDoc(false);
            anchor.setLocked(false);
            anchor.setLayoutInCell(true);
            anchor.setAllowOverlap(true);
            anchor.setRelativeHeight(0);

            var simplePos = anchor.addNewSimplePos();
            simplePos.setX(0);
            simplePos.setY(0);

            CTPosH posH = anchor.addNewPositionH();
            posH.setRelativeFrom(STRelFromH.PAGE);
            posH.setPosOffset((int) xEmu);

            CTPosV posV = anchor.addNewPositionV();
            posV.setRelativeFrom(STRelFromV.PAGE);
            posV.setPosOffset((int) yEmu);

            var extent = anchor.addNewExtent();
            extent.setCx(wEmu);
            extent.setCy(hEmu);

            CTEffectExtent effectExtent = anchor.addNewEffectExtent();
            effectExtent.setL(0);
            effectExtent.setT(0);
            effectExtent.setR(0);
            effectExtent.setB(0);

            anchor.addNewWrapNone();

            var docPr = anchor.addNewDocPr();
            long id = getNextId();
            docPr.setId(id);
            docPr.setName(name != null ? name : "Image " + id);

            anchor.addNewCNvGraphicFramePr();

            CTGraphicalObject graphic = anchor.addNewGraphic();
            CTGraphicalObjectData graphicData = graphic.addNewGraphicData();
            graphicData.setUri(PIC_NS);

            XmlCursor cursor = graphicData.newCursor();
            cursor.toEndToken();
            cursor.beginElement(new QName(PIC_NS, "pic", "pic"));

            cursor.beginElement(new QName(PIC_NS, "nvPicPr", "pic"));
            cursor.beginElement(new QName(PIC_NS, "cNvPr", "pic"));
            cursor.insertAttributeWithValue("id", String.valueOf(id));
            cursor.insertAttributeWithValue("name", name != null ? name : "Image " + id);
            cursor.toEndToken();
            cursor.toNextToken();
            cursor.beginElement(new QName(PIC_NS, "cNvPicPr", "pic"));
            cursor.toEndToken();
            cursor.toNextToken();
            cursor.toEndToken();
            cursor.toNextToken();

            cursor.beginElement(new QName(PIC_NS, "blipFill", "pic"));
            cursor.beginElement(new QName(A_NS, "blip", "a"));
            cursor.insertAttributeWithValue(new QName(R_NS, "embed", "r"), relationId);
            cursor.toEndToken();
            cursor.toNextToken();
            cursor.beginElement(new QName(A_NS, "stretch", "a"));
            cursor.beginElement(new QName(A_NS, "fillRect", "a"));
            cursor.toEndToken();
            cursor.toNextToken();
            cursor.toEndToken();
            cursor.toNextToken();
            cursor.toEndToken();
            cursor.toNextToken();

            cursor.beginElement(new QName(PIC_NS, "spPr", "pic"));
            cursor.beginElement(new QName(A_NS, "xfrm", "a"));
            cursor.beginElement(new QName(A_NS, "off", "a"));
            cursor.insertAttributeWithValue("x", "0");
            cursor.insertAttributeWithValue("y", "0");
            cursor.toEndToken();
            cursor.toNextToken();
            cursor.beginElement(new QName(A_NS, "ext", "a"));
            cursor.insertAttributeWithValue("cx", String.valueOf(wEmu));
            cursor.insertAttributeWithValue("cy", String.valueOf(hEmu));
            cursor.toEndToken();
            cursor.toNextToken();
            cursor.toEndToken();
            cursor.toNextToken();
            cursor.beginElement(new QName(A_NS, "prstGeom", "a"));
            cursor.insertAttributeWithValue("prst", "rect");
            cursor.beginElement(new QName(A_NS, "avLst", "a"));
            cursor.toEndToken();
            cursor.toNextToken();
            cursor.toEndToken();
            cursor.toNextToken();
            cursor.toEndToken();
            cursor.toNextToken();

            cursor.dispose();
        } catch (Exception ignored) {
        }
    }

    private static String stripHtml(String html) {
        if (html == null) return "";
        return html.replaceAll("<[^>]+>", "")
                   .replaceAll("&nbsp;", " ")
                   .replaceAll("&amp;", "&")
                   .replaceAll("&lt;", "<")
                   .replaceAll("&gt;", ">")
                   .replaceAll("&quot;", "\"")
                   .trim();
    }

    private static String normalizeColor(String value) {
        if (value == null || value.isBlank()) return null;
        String v = value.trim().toLowerCase();
        if ("transparent".equals(v)) return null;
        if (v.startsWith("#")) {
            String hex = v.substring(1);
            if (hex.length() == 3) {
                return ("" + hex.charAt(0) + hex.charAt(0)
                        + hex.charAt(1) + hex.charAt(1)
                        + hex.charAt(2) + hex.charAt(2)).toUpperCase();
            }
            if (hex.length() == 6) return hex.toUpperCase();
        }
        if (v.startsWith("rgb")) {
            try {
                String inside = v.substring(v.indexOf('(') + 1, v.indexOf(')'));
                String[] parts = inside.split(",");
                int r = Integer.parseInt(parts[0].trim());
                int g = Integer.parseInt(parts[1].trim());
                int b = Integer.parseInt(parts[2].trim());
                return String.format("%02X%02X%02X", r, g, b);
            } catch (Exception ignored) {}
        }
        return null;
    }
}
