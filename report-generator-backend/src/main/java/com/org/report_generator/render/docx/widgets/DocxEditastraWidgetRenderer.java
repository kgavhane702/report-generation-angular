package com.org.report_generator.render.docx.widgets;

import com.org.report_generator.model.document.Widget;
import com.org.report_generator.render.docx.DocxRenderContext;
import com.org.report_generator.render.docx.DocxWidgetRenderer;
import com.org.report_generator.render.docx.service.HtmlToDocxConverter;
import com.org.report_generator.render.docx.service.DocxPositioningUtil;
import org.springframework.stereotype.Component;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableCell;
import org.apache.poi.xwpf.usermodel.XWPFTableRow;
import org.apache.poi.xwpf.usermodel.XWPFTableCell.XWPFVertAlign;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTTcMar;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTTcPr;

@Component
public class DocxEditastraWidgetRenderer implements DocxWidgetRenderer {

    private final HtmlToDocxConverter htmlConverter;

    public DocxEditastraWidgetRenderer(HtmlToDocxConverter htmlConverter) {
        this.htmlConverter = htmlConverter;
    }

    @Override
    public String widgetType() {
        return "editastra";
    }

    @Override
    public void render(Widget widget, DocxRenderContext ctx) {
        if (widget.getProps() == null) return;
        String html = widget.getProps().path("contentHtml").asText("");
        if (html == null || html.isBlank()) return;
        XWPFTable table = ctx.docx().createTable(1, 1);
        DocxPositioningUtil.applyTablePosition(table, widget);

        XWPFTableRow row = table.getRow(0);
        XWPFTableCell cell = row.getCell(0);
        if (cell.getParagraphs() != null && !cell.getParagraphs().isEmpty()) {
            int count = cell.getParagraphs().size();
            for (int i = count - 1; i >= 0; i--) {
                cell.removeParagraph(i);
            }
        }

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

        String fill = normalizeColor(widget.getProps().path("backgroundColor").asText(null));
        if (fill != null) {
            cell.setColor(fill);
        }

        setCellMargins(cell, 0, 0, 0, 0);

        String vAlign = widget.getProps().path("verticalAlign").asText("top").toLowerCase();
        switch (vAlign) {
            case "middle" -> cell.setVerticalAlignment(XWPFVertAlign.CENTER);
            case "bottom" -> cell.setVerticalAlignment(XWPFVertAlign.BOTTOM);
            default -> cell.setVerticalAlignment(XWPFVertAlign.TOP);
        }

        String align = widget.getProps().path("textAlign").asText("");
        String wrapped = html;
        if (align != null && !align.isBlank()) {
            wrapped = "<div style=\"text-align: " + align + ";\">" + html + "</div>";
        }
        htmlConverter.appendHtmlToCell(cell, wrapped);
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

    private void setCellMargins(XWPFTableCell cell, int top, int left, int bottom, int right) {
        CTTcPr tcPr = cell.getCTTc().isSetTcPr() ? cell.getCTTc().getTcPr() : cell.getCTTc().addNewTcPr();
        CTTcMar mar = tcPr.isSetTcMar() ? tcPr.getTcMar() : tcPr.addNewTcMar();
        mar.addNewTop().setW(java.math.BigInteger.valueOf(top));
        mar.addNewLeft().setW(java.math.BigInteger.valueOf(left));
        mar.addNewBottom().setW(java.math.BigInteger.valueOf(bottom));
        mar.addNewRight().setW(java.math.BigInteger.valueOf(right));
    }
}
