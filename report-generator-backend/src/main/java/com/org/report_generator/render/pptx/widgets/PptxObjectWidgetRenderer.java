package com.org.report_generator.render.pptx.widgets;

import com.fasterxml.jackson.databind.JsonNode;
import com.org.report_generator.model.document.Widget;
import com.org.report_generator.render.pptx.PptxRenderContext;
import com.org.report_generator.render.pptx.PptxWidgetRenderer;
import com.org.report_generator.render.pptx.service.PptxPositioningUtil;
import com.org.report_generator.render.util.ShapeKeyUtil;
import org.apache.poi.xslf.usermodel.XSLFAutoShape;
import org.apache.poi.xslf.usermodel.XSLFTextParagraph;
import org.apache.poi.xslf.usermodel.XSLFTextRun;
import org.apache.poi.sl.usermodel.ShapeType;
import org.apache.poi.sl.usermodel.TextParagraph;
import org.apache.poi.sl.usermodel.VerticalAlignment;
import org.springframework.stereotype.Component;

import java.awt.Color;
import java.awt.geom.Rectangle2D;
import java.util.Map;

@Component
public class PptxObjectWidgetRenderer implements PptxWidgetRenderer {

    private static final Map<String, ShapeType> SHAPE_MAP = Map.ofEntries(
        // Basic shapes
        Map.entry("rectangle", ShapeType.RECT),
        Map.entry("square", ShapeType.RECT),
        Map.entry("rounded-rectangle", ShapeType.ROUND_RECT),
        Map.entry("circle", ShapeType.ELLIPSE),
        Map.entry("ellipse", ShapeType.ELLIPSE),
        Map.entry("triangle", ShapeType.TRIANGLE),
        Map.entry("diamond", ShapeType.DIAMOND),
        Map.entry("pentagon", ShapeType.PENTAGON),
        Map.entry("hexagon", ShapeType.HEXAGON),
        Map.entry("octagon", ShapeType.OCTAGON),
        Map.entry("parallelogram", ShapeType.PARALLELOGRAM),
        Map.entry("trapezoid", ShapeType.TRAPEZOID),
        
        // Arrows
        Map.entry("arrow-right", ShapeType.RIGHT_ARROW),
        Map.entry("arrow-left", ShapeType.LEFT_ARROW),
        Map.entry("arrow-up", ShapeType.UP_ARROW),
        Map.entry("arrow-down", ShapeType.DOWN_ARROW),
        Map.entry("arrow-double", ShapeType.LEFT_RIGHT_ARROW),
        
        // Flowchart shapes - use closest available shapes
        Map.entry("flowchart-process", ShapeType.RECT),
        Map.entry("flowchart-decision", ShapeType.DIAMOND),
        Map.entry("flowchart-data", ShapeType.PARALLELOGRAM),
        Map.entry("flowchart-terminator", ShapeType.ROUND_RECT),
        
        // Callouts
        Map.entry("callout-rectangle", ShapeType.WEDGE_RECT_CALLOUT),
        Map.entry("callout-rounded", ShapeType.WEDGE_ROUND_RECT_CALLOUT),
        Map.entry("callout-cloud", ShapeType.CLOUD_CALLOUT),
        
        // Stars
        Map.entry("star-4", ShapeType.STAR_4),
        Map.entry("star-5", ShapeType.STAR_5),
        Map.entry("star-6", ShapeType.STAR_6),
        Map.entry("star-8", ShapeType.STAR_8),
        
        // Other shapes
        Map.entry("cross", ShapeType.PLUS),
        Map.entry("heart", ShapeType.HEART),
        Map.entry("lightning", ShapeType.LIGHTNING_BOLT),
        Map.entry("moon", ShapeType.MOON),
        Map.entry("cloud", ShapeType.CLOUD),
        Map.entry("wave", ShapeType.WAVE),
        Map.entry("banner", ShapeType.WAVE),
        
        // Lines
        Map.entry("line", ShapeType.LINE),
        Map.entry("line-arrow", ShapeType.LINE)
    );

    @Override
    public String widgetType() {
        return "object";
    }

    @Override
    public void render(Widget widget, PptxRenderContext ctx) {
        if (widget == null || widget.getProps() == null) return;

        JsonNode props = widget.getProps();
        String shapeType = props.path("shapeType").asText("rectangle");
        String shapeKey = ShapeKeyUtil.canonicalize(shapeType);

        // Map to PowerPoint shape type
        ShapeType poiShapeType = SHAPE_MAP.getOrDefault(shapeKey != null ? shapeKey : shapeType, ShapeType.RECT);

        // Get position and size (converted from CSS pixels to points)
        Rectangle2D anchor = PptxPositioningUtil.getAnchor(widget);

        // Create shape on slide
        XSLFAutoShape shape = ctx.slide().createAutoShape();
        shape.setShapeType(poiShapeType);
        shape.setAnchor(anchor);

        // Apply fill color
        String fillColor = props.path("fillColor").asText(null);
        if (fillColor != null && !fillColor.equalsIgnoreCase("transparent")) {
            Color fill = parseColor(fillColor);
            if (fill != null) {
                shape.setFillColor(fill);
            }
        } else {
            // No fill for transparent
            shape.setFillColor(null);
        }

        // Apply stroke/border
        if (props.has("stroke")) {
            JsonNode stroke = props.get("stroke");
            String strokeColor = stroke.path("color").asText("#000000");
            int strokeWidth = stroke.path("width").asInt(1);
            
            Color lineColor = parseColor(strokeColor);
            if (lineColor != null && strokeWidth > 0) {
                shape.setLineColor(lineColor);
                shape.setLineWidth(strokeWidth);
            }
        }

        // Add text if present
        String contentHtml = props.path("contentHtml").asText("");
        String plainText = extractPlainText(contentHtml);
        if (!plainText.isBlank()) {
            shape.clearText();

            // Vertical alignment
            String vAlign = props.path("verticalAlign").asText("top");
            tryInvoke(shape, "setVerticalAlignment", new Class<?>[] { VerticalAlignment.class },
                    mapVerticalAlign(vAlign));

            // Padding/insets
            int padding = props.path("padding").asInt(0);
            if (padding > 0) {
                double insetPt = PptxPositioningUtil.toPoints((double) padding);
                tryInvoke(shape, "setLeftInset", new Class<?>[] { double.class }, insetPt);
                tryInvoke(shape, "setRightInset", new Class<?>[] { double.class }, insetPt);
                tryInvoke(shape, "setTopInset", new Class<?>[] { double.class }, insetPt);
                tryInvoke(shape, "setBottomInset", new Class<?>[] { double.class }, insetPt);
            }

            XSLFTextParagraph para = shape.addNewTextParagraph();
            
            String textAlign = props.path("textAlign").asText("center");
            para.setTextAlign(mapTextAlign(textAlign));
            
            XSLFTextRun run = para.addNewTextRun();
            run.setText(plainText);
            run.setFontSize(12.0);
            run.setFontColor(Color.BLACK);
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
        if (align == null) return TextParagraph.TextAlign.CENTER;
        return switch (align.toLowerCase()) {
            case "left" -> TextParagraph.TextAlign.LEFT;
            case "right" -> TextParagraph.TextAlign.RIGHT;
            case "justify" -> TextParagraph.TextAlign.JUSTIFY;
            default -> TextParagraph.TextAlign.CENTER;
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
            String c = color.trim().toLowerCase();
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
                            Math.min(255, Math.max(0, Integer.parseInt(parts[0].trim()))),
                            Math.min(255, Math.max(0, Integer.parseInt(parts[1].trim()))),
                            Math.min(255, Math.max(0, Integer.parseInt(parts[2].trim())))
                        );
                    }
                }
            }
        } catch (Exception ignored) {}
        return null;
    }
}
