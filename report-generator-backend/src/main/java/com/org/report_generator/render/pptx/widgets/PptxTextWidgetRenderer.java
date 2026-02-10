package com.org.report_generator.render.pptx.widgets;

import com.fasterxml.jackson.databind.JsonNode;
import com.org.report_generator.model.document.Widget;
import com.org.report_generator.render.pptx.PptxRenderContext;
import com.org.report_generator.render.pptx.PptxWidgetRenderer;
import com.org.report_generator.render.pptx.service.PptxPositioningUtil;
import com.org.report_generator.render.util.ColorUtil;
import com.org.report_generator.render.util.HtmlRichTextParser;
import com.org.report_generator.render.util.HtmlRichTextParser.StyledRun;
import org.apache.poi.xslf.usermodel.XSLFTextBox;
import org.apache.poi.xslf.usermodel.XSLFTextParagraph;
import org.apache.poi.xslf.usermodel.XSLFTextRun;
import org.apache.poi.sl.usermodel.TextParagraph;
import org.apache.poi.sl.usermodel.VerticalAlignment;
import org.springframework.stereotype.Component;

import java.awt.Color;
import java.awt.geom.Rectangle2D;
import java.util.List;

@Component
public class PptxTextWidgetRenderer implements PptxWidgetRenderer {

    @Override
    public String widgetType() {
        return "text";
    }

    @Override
    public void render(Widget widget, PptxRenderContext ctx) {
        if (widget == null || widget.getProps() == null) return;

        JsonNode props = widget.getProps();
        String html = props.path("contentHtml").asText("");
        List<StyledRun> runs = HtmlRichTextParser.parse(html);
        boolean hasContent = runs.stream().anyMatch(r -> !r.lineBreak && r.text != null && !r.text.isBlank());
        if (!hasContent) return;

        // Get position and size (converted from CSS pixels to points)
        Rectangle2D anchor = PptxPositioningUtil.getAnchor(widget);

        // Create text box on slide
        XSLFTextBox textBox = ctx.slide().createTextBox();
        textBox.setAnchor(anchor);

        // Vertical alignment
        String vAlign = props.path("verticalAlign").asText("top");
        tryInvoke(textBox, "setVerticalAlignment", new Class<?>[] { VerticalAlignment.class }, mapVerticalAlign(vAlign));

        // Padding/insets
        int padding = props.path("padding").asInt(0);
        if (padding > 0) {
            double insetPt = PptxPositioningUtil.toPoints((double) padding);
            tryInvoke(textBox, "setLeftInset", new Class<?>[] { double.class }, insetPt);
            tryInvoke(textBox, "setRightInset", new Class<?>[] { double.class }, insetPt);
            tryInvoke(textBox, "setTopInset", new Class<?>[] { double.class }, insetPt);
            tryInvoke(textBox, "setBottomInset", new Class<?>[] { double.class }, insetPt);
        }

        // Fallback defaults from widget props
        double defaultFontSize = props.path("fontSize").asDouble(12);
        String defaultFontFamily = props.path("fontFamily").asText("Arial");
        String fallbackColorStr = props.path("fontColor").asText(null);
        if (fallbackColorStr == null) fallbackColorStr = props.path("color").asText(null);
        if (fallbackColorStr == null) fallbackColorStr = "#000000";
        Color fallbackColor = parseColor(fallbackColorStr);
        boolean defaultBold = props.path("bold").asBoolean(false);
        boolean defaultItalic = props.path("italic").asBoolean(false);

        // Clear default paragraph and add content
        textBox.clearText();
        String textAlign = props.path("textAlign").asText("left");
        XSLFTextParagraph para = textBox.addNewTextParagraph();
        para.setTextAlign(mapTextAlign(textAlign));

        for (StyledRun sr : runs) {
            if (sr.lineBreak) {
                // Start a new paragraph
                para = textBox.addNewTextParagraph();
                para.setTextAlign(mapTextAlign(textAlign));
                continue;
            }
            if (sr.text == null || sr.text.isEmpty()) continue;

            XSLFTextRun run = para.addNewTextRun();
            run.setText(sr.text);

            // Font size
            run.setFontSize(sr.fontSizePt != null ? (double) sr.fontSizePt : defaultFontSize);
            // Font family
            run.setFontFamily(sr.fontFamily != null ? sr.fontFamily : defaultFontFamily);
            // Bold / Italic
            run.setBold(sr.bold || defaultBold);
            run.setItalic(sr.italic || defaultItalic);
            // Underline
            if (sr.underline) run.setUnderlined(true);
            // Strikethrough
            if (sr.strike) run.setStrikethrough(true);
            // Superscript / Subscript
            if (sr.superscript) tryInvoke(run, "setSuperscript", new Class<?>[] { boolean.class }, true);
            else if (sr.subscript) tryInvoke(run, "setSubscript", new Class<?>[] { boolean.class }, true);
            // Font color
            Color runColor = sr.color != null ? hexToColor(sr.color) : fallbackColor;
            if (runColor != null) run.setFontColor(runColor);
        }

        // Background color
        String bgColor = props.path("backgroundColor").asText(null);
        if (bgColor != null && !bgColor.equalsIgnoreCase("transparent")) {
            Color bg = parseColor(bgColor);
            if (bg != null) {
                textBox.setFillColor(bg);
            }
        }
    }

    private VerticalAlignment mapVerticalAlign(String align) {
        if (align == null) return VerticalAlignment.TOP;
        return switch (align.toLowerCase()) {
            case "middle", "center" -> VerticalAlignment.MIDDLE;
            case "bottom" -> VerticalAlignment.BOTTOM;
            default -> VerticalAlignment.TOP;
        };
    }

    private void tryInvoke(Object target, String methodName, Class<?>[] paramTypes, Object arg) {
        if (target == null) return;
        try {
            var m = target.getClass().getMethod(methodName, paramTypes);
            m.invoke(target, arg);
        } catch (Exception ignored) {
        }
    }

    private TextParagraph.TextAlign mapTextAlign(String align) {
        if (align == null) return TextParagraph.TextAlign.LEFT;
        return switch (align.toLowerCase()) {
            case "center" -> TextParagraph.TextAlign.CENTER;
            case "right" -> TextParagraph.TextAlign.RIGHT;
            case "justify" -> TextParagraph.TextAlign.JUSTIFY;
            default -> TextParagraph.TextAlign.LEFT;
        };
    }

    private String extractPlainText(String html) {
        if (html == null || html.isBlank()) return "";
        return html.replaceAll("<[^>]+>", "")
                   .replaceAll("&nbsp;", " ")
                   .replaceAll("&amp;", "&")
                   .replaceAll("&lt;", "<")
                   .replaceAll("&gt;", ">")
                   .replaceAll("&quot;", "\"")
                   .trim();
    }

    private Color hexToColor(String hex) {
        if (hex == null || hex.length() < 6) return null;
        try {
            return new Color(
                Integer.parseInt(hex.substring(0, 2), 16),
                Integer.parseInt(hex.substring(2, 4), 16),
                Integer.parseInt(hex.substring(4, 6), 16)
            );
        } catch (Exception e) { return null; }
    }

    private Color parseColor(String color) {
        if (color == null || color.isBlank() || "transparent".equalsIgnoreCase(color)) return null;
        String hex = ColorUtil.normalizeColor(color);
        return hexToColor(hex);
    }
}
