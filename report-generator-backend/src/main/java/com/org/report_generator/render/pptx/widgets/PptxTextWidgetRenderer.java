package com.org.report_generator.render.pptx.widgets;

import com.fasterxml.jackson.databind.JsonNode;
import com.org.report_generator.model.document.Widget;
import com.org.report_generator.render.pptx.PptxRenderContext;
import com.org.report_generator.render.pptx.PptxWidgetRenderer;
import com.org.report_generator.render.pptx.service.PptxPositioningUtil;
import org.apache.poi.xslf.usermodel.XSLFTextBox;
import org.apache.poi.xslf.usermodel.XSLFTextParagraph;
import org.apache.poi.xslf.usermodel.XSLFTextRun;
import org.apache.poi.sl.usermodel.TextParagraph;
import org.apache.poi.sl.usermodel.VerticalAlignment;
import org.springframework.stereotype.Component;

import java.awt.Color;
import java.awt.geom.Rectangle2D;

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
        String plainText = extractPlainText(html);
        if (plainText.isBlank()) return;

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

        // Clear default paragraph and add content
        textBox.clearText();
        XSLFTextParagraph para = textBox.addNewTextParagraph();
        
        // Apply text alignment
        String textAlign = props.path("textAlign").asText("left");
        para.setTextAlign(mapTextAlign(textAlign));

        XSLFTextRun run = para.addNewTextRun();
        run.setText(plainText);

        // Apply font styling from props or parse from HTML
        double fontSize = props.path("fontSize").asDouble(12);
        run.setFontSize(fontSize);

        String fontFamily = props.path("fontFamily").asText("Arial");
        run.setFontFamily(fontFamily);

        // Font color
        String colorStr = props.path("fontColor").asText(null);
        if (colorStr == null) {
            colorStr = props.path("color").asText("#000000");
        }
        Color fontColor = parseColor(colorStr);
        if (fontColor != null) {
            run.setFontColor(fontColor);
        }

        // Bold/italic
        run.setBold(props.path("bold").asBoolean(false));
        run.setItalic(props.path("italic").asBoolean(false));

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

    private Color parseColor(String color) {
        if (color == null || color.isBlank() || "transparent".equalsIgnoreCase(color)) return null;
        try {
            String c = color.trim();
            if (c.startsWith("#")) {
                c = c.substring(1);
                if (c.length() == 3) {
                    c = "" + c.charAt(0) + c.charAt(0) + c.charAt(1) + c.charAt(1) + c.charAt(2) + c.charAt(2);
                }
                if (c.length() >= 6) {
                    return new Color(
                        Integer.parseInt(c.substring(0, 2), 16),
                        Integer.parseInt(c.substring(2, 4), 16),
                        Integer.parseInt(c.substring(4, 6), 16)
                    );
                }
            } else if (c.startsWith("rgb")) {
                int start = c.indexOf('(');
                int end = c.indexOf(')');
                if (start >= 0 && end > start) {
                    String[] parts = c.substring(start + 1, end).split(",");
                    if (parts.length >= 3) {
                        return new Color(
                            Integer.parseInt(parts[0].trim()),
                            Integer.parseInt(parts[1].trim()),
                            Integer.parseInt(parts[2].trim())
                        );
                    }
                }
            }
        } catch (Exception ignored) {}
        return null;
    }
}
