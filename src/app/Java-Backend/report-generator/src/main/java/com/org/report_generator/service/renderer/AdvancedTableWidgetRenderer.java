package com.org.report_generator.service.renderer;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.HashSet;
import java.util.Set;

/**
 * Modular renderer for advanced table widgets.
 * Handles cell data, styles, and merged cells with proper formatting.
 */
public class AdvancedTableWidgetRenderer {
    
    private static final String ADVANCED_TABLE_CSS = """
        .widget-advanced-table {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: flex-start;
            justify-content: flex-start;
            overflow: auto;
        }
        
        .advanced-table {
            width: 100%;
            height: 100%;
            border-collapse: collapse;
            border-spacing: 0;
            table-layout: auto;
        }
        
        .advanced-table td {
            border: 1px solid #000000;
            padding: 8px;
            min-width: 80px;
            min-height: 30px;
            vertical-align: middle;
            word-wrap: break-word;
        }
        """;

    /**
     * Render an advanced table widget with cell data, styles, and merged cells
     */
    public String render(JsonNode props, String widgetStyle) {
        if (props == null) {
            return "<div class=\"widget widget-advanced-table\" style=\"" + widgetStyle + "\"></div>";
        }

        JsonNode cellData = props.path("cellData");
        JsonNode cellStyles = props.path("cellStyles");
        JsonNode mergedCells = props.path("mergedCells");
        int rows = props.path("rows").asInt(3);
        int columns = props.path("columns").asInt(3);

        StringBuilder html = new StringBuilder();
        html.append("<div class=\"widget widget-advanced-table\" style=\"").append(widgetStyle).append("\">");
        html.append("<table class=\"advanced-table\" style=\"width: 100%; height: 100%; border-collapse: collapse; border-spacing: 0;\">");
        html.append("<tbody>");

        // Track which cells are part of merged cells to skip rendering them
        Set<String> mergedCellKeys = new HashSet<>();
        if (mergedCells != null && !mergedCells.isMissingNode()) {
            mergedCells.fieldNames().forEachRemaining(key -> mergedCellKeys.add(key));
        }

        for (int i = 0; i < rows; i++) {
            html.append("<tr>");
            for (int j = 0; j < columns; j++) {
                String cellKey = i + "-" + j;
                
                // Check if this cell is part of a merged cell (but not the top-left)
                boolean shouldSkip = false;
                if (mergedCells != null && !mergedCells.isMissingNode()) {
                    for (String mergeKey : mergedCellKeys) {
                        String[] parts = mergeKey.split("-");
                        if (parts.length == 2) {
                            try {
                                int mergeRow = Integer.parseInt(parts[0]);
                                int mergeCol = Integer.parseInt(parts[1]);
                                JsonNode mergeInfo = mergedCells.get(mergeKey);
                                if (mergeInfo != null && !mergeInfo.isMissingNode()) {
                                    int rowspan = mergeInfo.path("rowspan").asInt(1);
                                    int colspan = mergeInfo.path("colspan").asInt(1);
                                    
                                    // Check if current cell is within the merged range
                                    if (i >= mergeRow && i < mergeRow + rowspan &&
                                        j >= mergeCol && j < mergeCol + colspan) {
                                        // Only render the top-left cell of the merge
                                        if (i != mergeRow || j != mergeCol) {
                                            shouldSkip = true;
                                            break;
                                        }
                                    }
                                }
                            } catch (NumberFormatException e) {
                                // Ignore invalid keys
                            }
                        }
                    }
                }
                
                if (shouldSkip) {
                    continue;
                }

                // Get cell value
                String cellValue = "";
                if (cellData != null && !cellData.isMissingNode() && cellData.isArray() && 
                    i < cellData.size() && cellData.get(i).isArray() && 
                    j < cellData.get(i).size()) {
                    JsonNode cellNode = cellData.get(i).get(j);
                    if (cellNode != null && !cellNode.isNull()) {
                        cellValue = cellNode.isTextual() ? cellNode.asText("") : cellNode.toString();
                    }
                }

                // Clean cell value
                cellValue = cleanCellValue(cellValue);

                // Get cell style
                StringBuilder cellStyle = new StringBuilder();
                if (cellStyles != null && !cellStyles.isMissingNode()) {
                    JsonNode cellStyleNode = cellStyles.get(cellKey);
                    if (cellStyleNode != null && !cellStyleNode.isMissingNode()) {
                        appendStyleIfPresent(cellStyle, "text-align", cellStyleNode.path("textAlign"));
                        appendStyleIfPresent(cellStyle, "font-weight", cellStyleNode.path("fontWeight"));
                        appendStyleIfPresent(cellStyle, "font-style", cellStyleNode.path("fontStyle"));
                        appendStyleIfPresent(cellStyle, "text-decoration", cellStyleNode.path("textDecoration"));
                        appendNumericStyle(cellStyle, "font-size", cellStyleNode.path("fontSize"), "px");
                        appendStyleIfPresent(cellStyle, "color", cellStyleNode.path("color"));
                        appendStyleIfPresent(cellStyle, "background-color", cellStyleNode.path("backgroundColor"));
                        appendStyleIfPresent(cellStyle, "vertical-align", cellStyleNode.path("verticalAlign"));
                        appendStyleIfPresent(cellStyle, "border-style", cellStyleNode.path("borderStyle"));
                        appendNumericStyle(cellStyle, "border-width", cellStyleNode.path("borderWidth"), "px");
                        appendStyleIfPresent(cellStyle, "border-color", cellStyleNode.path("borderColor"));
                        appendStyleIfPresent(cellStyle, "font-family", cellStyleNode.path("fontFamily"));
                    }
                }

                // Default styles
                if (!cellStyle.toString().contains("border")) {
                    cellStyle.append("border: 1px solid #000000;");
                }
                if (!cellStyle.toString().contains("padding")) {
                    cellStyle.append("padding: 8px;");
                }
                if (!cellStyle.toString().contains("vertical-align")) {
                    cellStyle.append("vertical-align: middle;");
                }

                // Get merge info
                int rowspan = 1;
                int colspan = 1;
                if (mergedCells != null && !mergedCells.isMissingNode()) {
                    JsonNode mergeInfo = mergedCells.get(cellKey);
                    if (mergeInfo != null && !mergeInfo.isMissingNode()) {
                        rowspan = mergeInfo.path("rowspan").asInt(1);
                        colspan = mergeInfo.path("colspan").asInt(1);
                    }
                }

                html.append("<td");
                if (rowspan > 1) {
                    html.append(" rowspan=\"").append(rowspan).append("\"");
                }
                if (colspan > 1) {
                    html.append(" colspan=\"").append(colspan).append("\"");
                }
                html.append(" style=\"").append(cellStyle).append("\">");
                html.append(escapeHtml(cellValue));
                html.append("</td>");
            }
            html.append("</tr>");
        }

        html.append("</tbody></table></div>");
        return html.toString();
    }

    /**
     * Clean cell value by removing &nbsp; and trimming whitespace
     */
    private String cleanCellValue(String value) {
        if (value == null || value.isEmpty()) {
            return "";
        }
        // Remove &nbsp; (case insensitive)
        String cleaned = value.replaceAll("(?i)&nbsp;", "");
        // Remove all whitespace-only content
        cleaned = cleaned.trim();
        // If result is empty or only whitespace, return empty string
        return cleaned.isEmpty() ? "" : cleaned;
    }

    /**
     * Append style if present in JsonNode
     */
    private void appendStyleIfPresent(StringBuilder builder, String property, JsonNode node) {
        if (builder == null || property == null || node == null || node.isMissingNode() || node.isNull()) {
            return;
        }
        if (node.isTextual()) {
            builder.append(property).append(": ").append(node.asText()).append(";");
        } else if (node.isNumber()) {
            builder.append(property).append(": ").append(node.numberValue()).append(";");
        }
    }

    /**
     * Append numeric style with unit
     */
    private void appendNumericStyle(StringBuilder builder, String property, JsonNode node, String unit) {
        if (builder == null || property == null || node == null || node.isMissingNode() || node.isNull()) {
            return;
        }
        if (node.isNumber()) {
            builder.append(property).append(": ").append(node.asDouble()).append(unit).append(";");
        } else if (node.isTextual()) {
            String value = node.asText();
            if (value.matches(".*[a-zA-Z%].*")) {
                builder.append(property).append(": ").append(value).append(";");
            } else {
                builder.append(property).append(": ").append(value).append(unit).append(";");
            }
        }
    }

    /**
     * Escape HTML special characters
     */
    private String escapeHtml(String input) {
        if (input == null || input.isEmpty()) {
            return "";
        }
        return input.replace("&", "&amp;")
                    .replace("<", "&lt;")
                    .replace(">", "&gt;")
                    .replace("\"", "&quot;")
                    .replace("'", "&#39;");
    }

    /**
     * Get CSS styles for advanced table widgets
     */
    public static String getCss() {
        return ADVANCED_TABLE_CSS;
    }
}

