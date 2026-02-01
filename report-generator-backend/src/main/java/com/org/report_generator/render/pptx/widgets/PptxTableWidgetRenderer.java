package com.org.report_generator.render.pptx.widgets;

import com.fasterxml.jackson.databind.JsonNode;
import com.org.report_generator.model.document.Widget;
import com.org.report_generator.render.pptx.PptxRenderContext;
import com.org.report_generator.render.pptx.PptxWidgetRenderer;
import com.org.report_generator.render.pptx.service.PptxPositioningUtil;
import org.apache.poi.xslf.usermodel.XSLFTable;
import org.apache.poi.xslf.usermodel.XSLFTableCell;
import org.apache.poi.xslf.usermodel.XSLFTableRow;
import org.apache.poi.xslf.usermodel.XSLFTextParagraph;
import org.apache.poi.xslf.usermodel.XSLFTextRun;
import org.apache.poi.sl.usermodel.TableCell;
import org.apache.poi.sl.usermodel.TextParagraph;
import org.springframework.stereotype.Component;

import java.awt.Color;
import java.awt.geom.Rectangle2D;

@Component
public class PptxTableWidgetRenderer implements PptxWidgetRenderer {

    @Override
    public String widgetType() {
        return "table";
    }

    @Override
    public void render(Widget widget, PptxRenderContext ctx) {
        if (widget == null || widget.getProps() == null) return;

        JsonNode props = widget.getProps();
        JsonNode rows = props.get("rows");
        if (rows == null || !rows.isArray() || rows.isEmpty()) return;

        // Count rows and max columns
        int numRows = rows.size();
        int numCols = 1;
        for (JsonNode row : rows) {
            JsonNode cells = row.get("cells");
            if (cells != null && cells.isArray()) {
                numCols = Math.max(numCols, cells.size());
            }
        }

        // Get position and size (converted from CSS pixels to points)
        Rectangle2D anchor = PptxPositioningUtil.getAnchor(widget);

        // Create table
        XSLFTable table = ctx.slide().createTable(numRows, numCols);
        table.setAnchor(anchor);

        // Calculate column width
        double colWidth = anchor.getWidth() / numCols;

        // Populate table
        int rowIndex = 0;
        for (JsonNode rowNode : rows) {
            XSLFTableRow tableRow = table.getRows().get(rowIndex);
            
            JsonNode cells = rowNode.get("cells");
            if (cells != null && cells.isArray()) {
                int cellIndex = 0;
                for (JsonNode cellNode : cells) {
                    if (cellIndex >= numCols) break;
                    
                    XSLFTableCell cell = tableRow.getCells().get(cellIndex);
                    
                    // Set column width
                    table.setColumnWidth(cellIndex, colWidth);
                    
                    // Apply cell background color
                    String bgColor = cellNode.path("backgroundColor").asText(null);
                    if (bgColor == null) {
                        bgColor = cellNode.path("background").asText(null);
                    }
                    if (bgColor != null && !bgColor.equalsIgnoreCase("transparent")) {
                        Color bg = parseColor(bgColor);
                        if (bg != null) {
                            cell.setFillColor(bg);
                        }
                    }

                    // Apply cell borders
                    if (cellNode.has("border") || props.has("border")) {
                        JsonNode border = cellNode.has("border") ? cellNode.get("border") : props.get("border");
                        String borderColor = border.path("color").asText("#000000");
                        double borderWidth = border.path("width").asDouble(1);
                        
                        Color lineColor = parseColor(borderColor);
                        if (lineColor != null) {
                            cell.setBorderColor(TableCell.BorderEdge.top, lineColor);
                            cell.setBorderColor(TableCell.BorderEdge.bottom, lineColor);
                            cell.setBorderColor(TableCell.BorderEdge.left, lineColor);
                            cell.setBorderColor(TableCell.BorderEdge.right, lineColor);
                            cell.setBorderWidth(TableCell.BorderEdge.top, borderWidth);
                            cell.setBorderWidth(TableCell.BorderEdge.bottom, borderWidth);
                            cell.setBorderWidth(TableCell.BorderEdge.left, borderWidth);
                            cell.setBorderWidth(TableCell.BorderEdge.right, borderWidth);
                        }
                    }

                    // Set cell text
                    String contentHtml = cellNode.path("contentHtml").asText("");
                    String text = cellNode.path("text").asText("");
                    String plainText = contentHtml.isBlank() ? text : extractPlainText(contentHtml);
                    
                    if (!plainText.isBlank()) {
                        cell.clearText();
                        XSLFTextParagraph para = cell.addNewTextParagraph();
                        
                        String textAlign = cellNode.path("textAlign").asText("left");
                        para.setTextAlign(mapTextAlign(textAlign));
                        
                        XSLFTextRun run = para.addNewTextRun();
                        run.setText(plainText);
                        run.setFontSize(11.0);
                        
                        // Font color
                        String fontColor = cellNode.path("fontColor").asText(null);
                        if (fontColor != null) {
                            Color fc = parseColor(fontColor);
                            if (fc != null) {
                                run.setFontColor(fc);
                            }
                        }
                    }
                    
                    cellIndex++;
                }
            }
            rowIndex++;
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
