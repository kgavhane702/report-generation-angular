package com.org.report_generator.render.docx.widgets;

import com.org.report_generator.model.document.Widget;
import com.org.report_generator.render.docx.DocxRenderContext;
import com.org.report_generator.render.docx.DocxWidgetRenderer;
import com.org.report_generator.render.docx.service.DocxObjectGenerationService;
import com.org.report_generator.render.docx.service.HtmlToDocxConverter;
import com.org.report_generator.render.docx.service.DocxPositioningUtil;
import org.springframework.stereotype.Component;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableCell;
import org.apache.poi.xwpf.usermodel.XWPFTableRow;
import org.apache.poi.xwpf.usermodel.XWPFTableCell.XWPFVertAlign;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTBorder;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTTcBorders;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTTcPr;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTTcMar;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.STBorder;

/**
 * Renderer for object/shape widgets in DOCX.
 * Uses native Word DrawingML shapes (wps:wsp) for all shape types.
 * Falls back to table-based rendering only for simple rectangles without special shapes.
 */
@Component
public class DocxObjectWidgetRenderer implements DocxWidgetRenderer {

    private final DocxObjectGenerationService objectService;
    private final HtmlToDocxConverter htmlConverter;

    public DocxObjectWidgetRenderer(DocxObjectGenerationService objectService, HtmlToDocxConverter htmlConverter) {
        this.objectService = objectService;
        this.htmlConverter = htmlConverter;
    }

    @Override
    public String widgetType() {
        return "object";
    }

    @Override
    public void render(Widget widget, DocxRenderContext ctx) {
        if (widget.getProps() == null) return;
        
        String shapeType = widget.getProps().path("shapeType").asText("rectangle");
        
        // Always try VML first for all shape types
        boolean success = objectService.generateShapeWithText(ctx.docx(), widget);
        if (success) {
            return; // Successfully rendered as VML shape
        }
        
        // Only fall back to table for basic rectangle shapes
        // For complex shapes, if VML failed, we still don't want a table
        if ("rectangle".equals(shapeType) || "square".equals(shapeType)) {
            System.out.println("VML failed for rectangle, using table fallback");
            renderAsTable(widget, ctx);
        } else {
            // Log that we couldn't render the shape
            System.err.println("Failed to render shape as VML: " + shapeType);
        }
    }

    /**
     * Fallback renderer using a positioned table (works well for rectangles).
     */
    private void renderAsTable(Widget widget, DocxRenderContext ctx) {
        String html = widget.getProps().path("contentHtml").asText("");

        XWPFTable table = ctx.docx().createTable(1, 1);
        DocxPositioningUtil.applyTablePosition(table, widget);

        XWPFTableRow row = table.getRow(0);
        XWPFTableCell cell = row.getCell(0);
        
        // Clear default paragraphs
        if (cell.getParagraphs() != null && !cell.getParagraphs().isEmpty()) {
            int count = cell.getParagraphs().size();
            for (int i = count - 1; i >= 0; i--) {
                cell.removeParagraph(i);
            }
        }

        // Set dimensions
        if (widget.getSize() != null) {
            long wTwips = DocxPositioningUtil.toTwips(widget.getSize().getWidth());
            long hTwips = DocxPositioningUtil.toTwips(widget.getSize().getHeight());
            if (wTwips > 0) {
                table.setWidth(String.valueOf(wTwips));
            }
            if (hTwips > 0) {
                row.setHeight((int) Math.min(Integer.MAX_VALUE, hTwips));
            }
        }

        // Apply fill color
        String fill = normalizeColor(widget.getProps().path("fillColor").asText(null));
        if (fill != null) {
            cell.setColor(fill);
        }

        // Remove default margins
        setCellMargins(cell, 0, 0, 0, 0);

        // Apply borders
        String strokeColor = null;
        int strokeWidth = 0;
        if (widget.getProps().has("stroke")) {
            var stroke = widget.getProps().get("stroke");
            strokeColor = normalizeColor(stroke.path("color").asText(null));
            strokeWidth = stroke.path("width").asInt(0);
        }
        if (strokeWidth <= 0 && widget.getProps().has("borderWidth")) {
            strokeWidth = widget.getProps().path("borderWidth").asInt(0);
            strokeColor = normalizeColor(widget.getProps().path("borderColor").asText(null));
        }
        if (strokeWidth > 0) {
            applyCellBorders(cell, strokeWidth, strokeColor != null ? strokeColor : "000000");
        }

        // Vertical alignment
        String vAlign = widget.getProps().path("verticalAlign").asText("top").toLowerCase();
        switch (vAlign) {
            case "middle" -> cell.setVerticalAlignment(XWPFVertAlign.CENTER);
            case "bottom" -> cell.setVerticalAlignment(XWPFVertAlign.BOTTOM);
            default -> cell.setVerticalAlignment(XWPFVertAlign.TOP);
        }

        // Padding
        int padding = widget.getProps().path("padding").asInt(0);
        if (padding > 0) {
            setCellMargins(cell, padding * 15, padding * 15, padding * 15, padding * 15);
        }

        // Add text content
        if (html != null && !html.isBlank()) {
            String align = widget.getProps().path("textAlign").asText("");
            String wrapped = html;
            if (align != null && !align.isBlank()) {
                wrapped = "<div style=\"text-align: " + align + ";\">" + html + "</div>";
            }
            htmlConverter.appendHtmlToCell(cell, wrapped);
        }
    }

    private void applyCellBorders(XWPFTableCell cell, int widthPx, String colorHex) {
        CTTcPr tcPr = cell.getCTTc().isSetTcPr() ? cell.getCTTc().getTcPr() : cell.getCTTc().addNewTcPr();
        CTTcBorders borders = tcPr.isSetTcBorders() ? tcPr.getTcBorders() : tcPr.addNewTcBorders();
        int sz = Math.max(2, widthPx * 6);
        setBorder(borders.addNewTop(), sz, colorHex);
        setBorder(borders.addNewBottom(), sz, colorHex);
        setBorder(borders.addNewLeft(), sz, colorHex);
        setBorder(borders.addNewRight(), sz, colorHex);
    }

    private void setCellMargins(XWPFTableCell cell, int top, int left, int bottom, int right) {
        CTTcPr tcPr = cell.getCTTc().isSetTcPr() ? cell.getCTTc().getTcPr() : cell.getCTTc().addNewTcPr();
        CTTcMar mar = tcPr.isSetTcMar() ? tcPr.getTcMar() : tcPr.addNewTcMar();
        mar.addNewTop().setW(java.math.BigInteger.valueOf(top));
        mar.addNewLeft().setW(java.math.BigInteger.valueOf(left));
        mar.addNewBottom().setW(java.math.BigInteger.valueOf(bottom));
        mar.addNewRight().setW(java.math.BigInteger.valueOf(right));
    }

    private void setBorder(CTBorder border, int size, String colorHex) {
        border.setVal(STBorder.SINGLE);
        border.setSz(java.math.BigInteger.valueOf(size));
        border.setColor(colorHex);
    }

    private String normalizeColor(String value) {
        if (value == null) return null;
        String v = value.trim().toLowerCase();
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
            } catch (Exception ignored) {
            }
        }
        return null;
    }
}
