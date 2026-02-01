package com.org.report_generator.render.docx.widgets;

import com.org.report_generator.model.document.Widget;
import com.org.report_generator.render.docx.DocxRenderContext;
import com.org.report_generator.render.docx.DocxWidgetRenderer;
import com.org.report_generator.render.docx.service.HtmlToDocxConverter;
import com.org.report_generator.render.docx.service.DocxPositioningUtil;
import org.springframework.stereotype.Component;
import org.apache.poi.xwpf.usermodel.ParagraphAlignment;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTP;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTPPr;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTShd;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.STShd;

@Component
public class DocxTextWidgetRenderer implements DocxWidgetRenderer {

    private final HtmlToDocxConverter htmlConverter;

    public DocxTextWidgetRenderer(HtmlToDocxConverter htmlConverter) {
        this.htmlConverter = htmlConverter;
    }

    @Override
    public String widgetType() {
        return "text";
    }

    @Override
    public void render(Widget widget, DocxRenderContext ctx) {
        if (widget.getProps() == null) return;
        String html = widget.getProps().path("contentHtml").asText("");
        if (html == null || html.isBlank()) return;
        var p = ctx.docx().createParagraph();
        DocxPositioningUtil.applyParagraphFrame(p, widget);
        applyBackground(p, widget.getProps().path("backgroundColor").asText(null));
        applyAlignment(p, widget.getProps().path("textAlign").asText(null));
        htmlConverter.appendHtml(p, html);
    }

    private void applyBackground(org.apache.poi.xwpf.usermodel.XWPFParagraph p, String color) {
        String fill = normalizeColor(color);
        if (fill == null) return;
        CTP ctp = p.getCTP();
        CTPPr ppr = ctp.isSetPPr() ? ctp.getPPr() : ctp.addNewPPr();
        CTShd shd = ppr.isSetShd() ? ppr.getShd() : ppr.addNewShd();
        shd.setVal(STShd.CLEAR);
        shd.setFill(fill);
    }

    private void applyAlignment(org.apache.poi.xwpf.usermodel.XWPFParagraph p, String align) {
        if (align == null) return;
        switch (align.toLowerCase()) {
            case "center" -> p.setAlignment(ParagraphAlignment.CENTER);
            case "right" -> p.setAlignment(ParagraphAlignment.RIGHT);
            case "justify" -> p.setAlignment(ParagraphAlignment.BOTH);
            default -> p.setAlignment(ParagraphAlignment.LEFT);
        }
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
