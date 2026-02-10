package com.org.report_generator.render.docx.service;

import com.org.report_generator.model.document.Widget;
import com.org.report_generator.model.document.WidgetPosition;
import com.org.report_generator.model.document.WidgetSize;
import com.org.report_generator.render.util.ShapeKeyUtil;
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
    private static final String W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    private static final String WPS_NS = "http://schemas.microsoft.com/office/word/2010/wordprocessingShape";
    private static final String WP14_NS = "http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing";
    private static final String PIC_NS = "http://schemas.openxmlformats.org/drawingml/2006/picture";
    private static final String R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

    /**
     * Create an absolutely positioned DrawingML shape (wps:wsp) with optional text.
     * This renders as a real Word shape (not a table/image), similar to PowerPoint shapes.
     */
    public static void createShapeWithText(
            XWPFDocument doc,
            Widget widget,
            String shapeType,
            String contentHtml,
            String fillColor,
            String strokeColor,
            Integer strokeWidthPx,
            String textAlign,
            String verticalAlign,
            Integer paddingPx
    ) {
        if (doc == null || widget == null) return;

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
        docPr.setId(getNextId());
        docPr.setName("Shape " + docPr.getId());

        anchor.addNewCNvGraphicFramePr();

        CTGraphicalObject graphic = anchor.addNewGraphic();
        CTGraphicalObjectData graphicData = graphic.addNewGraphicData();
        graphicData.setUri(WPS_NS);

        String geom = mapPresetGeometry(shapeType);
        String bg = normalizeColor(fillColor);
        String ln = normalizeColor(strokeColor);
        int strokePx = strokeWidthPx != null ? strokeWidthPx : 0;
        long strokeW = strokePx > 0 ? strokePx * EMU_PER_PX : 0;
        int padding = paddingPx != null ? Math.max(0, paddingPx) : 0;
        long padEmu = padding * EMU_PER_PX;

        String jcVal = mapJc(textAlign);
        String anchorVal = mapBodyAnchor(verticalAlign);
        String plainText = stripHtml(contentHtml);

        // Build the wsp:wsp element using XmlCursor.
        XmlCursor cursor = graphicData.newCursor();
        cursor.toEndToken();
        cursor.beginElement(new QName(WPS_NS, "wsp", "wps"));

        // Ensure prefixes used below are declared on this element.
        cursor.insertNamespace("wps", WPS_NS);
        cursor.insertNamespace("a", A_NS);
        cursor.insertNamespace("w", W_NS);

        // cNvSpPr
        cursor.beginElement(new QName(WPS_NS, "cNvSpPr", "wps"));
        cursor.insertAttributeWithValue("txBox", "1");
        cursor.toEndToken();
        cursor.toNextToken();

        // spPr
        cursor.beginElement(new QName(WPS_NS, "spPr", "wps"));

        // xfrm
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

        // prstGeom
        cursor.beginElement(new QName(A_NS, "prstGeom", "a"));
        cursor.insertAttributeWithValue("prst", geom);
        cursor.beginElement(new QName(A_NS, "avLst", "a"));
        cursor.toEndToken();
        cursor.toNextToken();
        cursor.toEndToken();
        cursor.toNextToken();

        // Fill
        if (bg != null && !bg.isBlank()) {
            cursor.beginElement(new QName(A_NS, "solidFill", "a"));
            cursor.beginElement(new QName(A_NS, "srgbClr", "a"));
            cursor.insertAttributeWithValue("val", bg);
            cursor.toEndToken();
            cursor.toNextToken();
            cursor.toEndToken();
            cursor.toNextToken();
        } else {
            cursor.beginElement(new QName(A_NS, "noFill", "a"));
            cursor.toEndToken();
            cursor.toNextToken();
        }

        // Line
        cursor.beginElement(new QName(A_NS, "ln", "a"));
        if (strokeW > 0) {
            cursor.insertAttributeWithValue("w", String.valueOf(strokeW));
            cursor.beginElement(new QName(A_NS, "solidFill", "a"));
            cursor.beginElement(new QName(A_NS, "srgbClr", "a"));
            cursor.insertAttributeWithValue("val", ln != null ? ln : "000000");
            cursor.toEndToken();
            cursor.toNextToken();
            cursor.toEndToken();
            cursor.toNextToken();
        } else {
            cursor.beginElement(new QName(A_NS, "noFill", "a"));
            cursor.toEndToken();
            cursor.toNextToken();
        }
        cursor.toEndToken();
        cursor.toNextToken();

        cursor.toEndToken(); // end spPr
        cursor.toNextToken();

        // txbx
        cursor.beginElement(new QName(WPS_NS, "txbx", "wps"));
        cursor.beginElement(new QName(W_NS, "txbxContent", "w"));
        cursor.beginElement(new QName(W_NS, "p", "w"));
        cursor.beginElement(new QName(W_NS, "pPr", "w"));

        // Remove default Word paragraph spacing that can cause apparent misalignment.
        cursor.beginElement(new QName(W_NS, "spacing", "w"));
        cursor.insertAttributeWithValue(new QName(W_NS, "before", "w"), "0");
        cursor.insertAttributeWithValue(new QName(W_NS, "after", "w"), "0");
        cursor.toEndToken();
        cursor.toNextToken();

        cursor.beginElement(new QName(W_NS, "jc", "w"));
        cursor.insertAttributeWithValue(new QName(W_NS, "val", "w"), jcVal);
        cursor.toEndToken();
        cursor.toNextToken();
        cursor.toEndToken();
        cursor.toNextToken();
        cursor.beginElement(new QName(W_NS, "r", "w"));
        cursor.beginElement(new QName(W_NS, "t", "w"));
        cursor.insertChars(plainText);
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

        // bodyPr (text box body properties)
        cursor.beginElement(new QName(WPS_NS, "bodyPr", "wps"));
        cursor.insertAttributeWithValue("rot", "0");
        cursor.insertAttributeWithValue("vert", "horz");
        cursor.insertAttributeWithValue("wrap", "square");
        cursor.insertAttributeWithValue("lIns", String.valueOf(padEmu));
        cursor.insertAttributeWithValue("tIns", String.valueOf(padEmu));
        cursor.insertAttributeWithValue("rIns", String.valueOf(padEmu));
        cursor.insertAttributeWithValue("bIns", String.valueOf(padEmu));
        cursor.insertAttributeWithValue("anchor", anchorVal);
        cursor.insertAttributeWithValue("anchorCtr", "ctr".equals(anchorVal) ? "1" : "0");
        cursor.toEndToken();
        cursor.toNextToken();

        cursor.dispose();
    }

    /**
     * Create an absolutely positioned text box with rich text content.
     */
    public static void createTextBox(
            XWPFDocument doc,
            Widget widget,
            String textContent,
            String backgroundColor,
            String textAlign,
            String verticalAlign,
            Integer paddingPx
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

        // Ensure prefixes used below are declared on this element.
        cursor.insertNamespace("wps", WPS_NS);
        cursor.insertNamespace("a", A_NS);
        cursor.insertNamespace("w", W_NS);

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
        cursor.beginElement(new QName(W_NS, "txbxContent", "w"));
        
        // Add paragraph with text
        cursor.beginElement(new QName(W_NS, "p", "w"));

        // Paragraph properties: alignment + remove default spacing.
        cursor.beginElement(new QName(W_NS, "pPr", "w"));
        cursor.beginElement(new QName(W_NS, "spacing", "w"));
        cursor.insertAttributeWithValue(new QName(W_NS, "before", "w"), "0");
        cursor.insertAttributeWithValue(new QName(W_NS, "after", "w"), "0");
        cursor.toEndToken();
        cursor.toNextToken();

        String jcVal = mapJc(textAlign);
        cursor.beginElement(new QName(W_NS, "jc", "w"));
        cursor.insertAttributeWithValue(new QName(W_NS, "val", "w"), jcVal);
        cursor.toEndToken();
        cursor.toNextToken();
        cursor.toEndToken();
        cursor.toNextToken();

        // Run with text
        cursor.beginElement(new QName(W_NS, "r", "w"));
        cursor.beginElement(new QName(W_NS, "t", "w"));
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
        int padding = paddingPx != null ? Math.max(0, paddingPx) : 0;
        long padEmu = padding * EMU_PER_PX;
        String anchorVal = mapBodyAnchor(verticalAlign);

        cursor.beginElement(new QName(WPS_NS, "bodyPr", "wps"));
        cursor.insertAttributeWithValue("rot", "0");
        cursor.insertAttributeWithValue("vert", "horz");
        cursor.insertAttributeWithValue("wrap", "square");
        cursor.insertAttributeWithValue("lIns", String.valueOf(padEmu));
        cursor.insertAttributeWithValue("tIns", String.valueOf(padEmu));
        cursor.insertAttributeWithValue("rIns", String.valueOf(padEmu));
        cursor.insertAttributeWithValue("bIns", String.valueOf(padEmu));
        cursor.insertAttributeWithValue("anchor", anchorVal);
        cursor.insertAttributeWithValue("anchorCtr", "ctr".equals(anchorVal) ? "1" : "0");
        cursor.toEndToken();
        cursor.toNextToken();

        cursor.dispose();
    }

    private static long toEmu(Double px) {
        if (px == null) return 0;
        return Math.round(px * EMU_PER_PX);
    }

    private static String mapPresetGeometry(String shapeType) {
        String key = ShapeKeyUtil.canonicalize(shapeType);
        if (key == null) return "rect";
        return switch (key) {
            case "rectangle", "square" -> "rect";
            case "rounded-rectangle" -> "roundRect";
            case "circle", "ellipse" -> "ellipse";
            case "triangle" -> "triangle";
            case "diamond" -> "diamond";
            case "pentagon" -> "pentagon";
            case "hexagon" -> "hexagon";
            case "octagon" -> "octagon";
            case "parallelogram" -> "parallelogram";
            case "trapezoid" -> "trapezoid";

            case "arrow-right" -> "rightArrow";
            case "arrow-left" -> "leftArrow";
            case "arrow-up" -> "upArrow";
            case "arrow-down" -> "downArrow";
            case "arrow-double" -> "leftRightArrow";

            case "callout-rectangle" -> "wedgeRectCallout";
            case "callout-rounded" -> "wedgeRoundRectCallout";
            case "callout-cloud" -> "cloudCallout";

            case "star-4" -> "star4";
            case "star-5" -> "star5";
            case "star-6" -> "star6";
            case "star-8" -> "star8";

            case "cross" -> "plus";
            case "heart" -> "heart";
            case "lightning" -> "lightningBolt";
            case "moon" -> "moon";
            case "cloud" -> "cloud";
            case "wave" -> "wave";

            default -> "rect";
        };
    }

    private static String mapJc(String textAlign) {
        if (textAlign == null || textAlign.isBlank()) return "left";
        return switch (textAlign.toLowerCase()) {
            case "center" -> "center";
            case "right" -> "right";
            case "justify" -> "both";
            default -> "left";
        };
    }

    private static String mapBodyAnchor(String verticalAlign) {
        if (verticalAlign == null || verticalAlign.isBlank()) return "t";
        return switch (verticalAlign.toLowerCase()) {
            case "middle", "center" -> "ctr";
            case "bottom" -> "b";
            default -> "t";
        };
    }

    private static String escapeXml(String text) {
        if (text == null) return "";
        return text.replace("&", "&amp;")
                   .replace("<", "&lt;")
                   .replace(">", "&gt;")
                   .replace("\"", "&quot;")
                   .replace("'", "&apos;");
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
