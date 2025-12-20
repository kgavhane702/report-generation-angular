package com.org.report_generator.service.renderer;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Renderer for table widgets (table-widget) matching the frontend table model:
 * - rows[].cells[] with inline merge/coveredBy and optional split grids
 * - cell.style supports textAlign, verticalAlign, fontWeight, fontStyle, backgroundColor
 * - cell.contentHtml is HTML (supports inline styles for text color/highlight)
 */
public class TableWidgetRenderer {

    private static final String TABLE_WIDGET_CSS = """
        .widget-table {
            width: 100%;
            height: 100%;
            position: relative;
            overflow: hidden;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
            color: #0f172a;
        }
        
        .widget-table .table-widget {
            width: 100%;
            height: 100%;
            overflow: hidden;
            position: relative;
        }
        
        .widget-table .table-widget__table {
            width: 100%;
            height: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            background: transparent;
        }
        
        .widget-table .table-widget__cell {
            border: 1px solid rgba(0, 0, 0, 0.12);
            padding: 0;
            margin: 0;
            background: transparent;
            vertical-align: top;
            position: relative;
            min-width: 40px;
            min-height: 24px;
        }
        
        .widget-table .table-widget__cell-content {
            width: 100%;
            height: 100%;
            min-height: 24px;
            padding: 4px 8px;
            box-sizing: border-box;
            word-wrap: break-word;
            overflow-wrap: break-word;
            white-space: pre-wrap;
            background: transparent;
            color: inherit;
            font-family: inherit;
            font-size: inherit;
            line-height: 1.5;
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
        }
        
        /* Embedded bold/italic */
        .widget-table .table-widget__cell-content b,
        .widget-table .table-widget__cell-content strong { font-weight: 700; }
        .widget-table .table-widget__cell-content i,
        .widget-table .table-widget__cell-content em { font-style: italic; }
        
        /* Split grid inside a cell */
        .widget-table .table-widget__split-grid {
            display: grid;
            width: 100%;
            height: 100%;
            min-height: 24px;
        }
        
        .widget-table .table-widget__sub-cell {
            border: 1px solid rgba(0, 0, 0, 0.08);
            box-sizing: border-box;
            overflow: hidden;
            background: transparent;
        }
        
        @media print {
            .widget-table table {
                page-break-inside: avoid;
            }
        }
        """;

    public String render(JsonNode props, String widgetStyle) {
        if (props == null || props.isNull()) {
            return "<div class=\"widget widget-table\" style=\"" + widgetStyle + "\"></div>";
        }

        JsonNode rowsNode = props.path("rows");
        if (rowsNode.isMissingNode() || !rowsNode.isArray() || rowsNode.size() == 0) {
            return "<div class=\"widget widget-table\" style=\"" + widgetStyle + "\"></div>";
        }

        StringBuilder html = new StringBuilder();
        html.append("<div class=\"widget widget-table\" style=\"").append(widgetStyle).append("\">");
        html.append("<div class=\"table-widget\"><table class=\"table-widget__table\"><tbody>");

        for (JsonNode rowNode : rowsNode) {
            if (rowNode == null || rowNode.isNull()) continue;
            JsonNode cellsNode = rowNode.path("cells");
            html.append("<tr class=\"table-widget__row\">");

            if (cellsNode.isArray()) {
                for (JsonNode cellNode : cellsNode) {
                    if (cellNode == null || cellNode.isNull()) continue;

                    // Skip covered cells; anchor cell carries rowspan/colspan.
                    if (!cellNode.path("coveredBy").isMissingNode() && !cellNode.path("coveredBy").isNull()) {
                        continue;
                    }

                    JsonNode mergeNode = cellNode.path("merge");
                    int rowSpan = mergeNode.path("rowSpan").asInt(1);
                    int colSpan = mergeNode.path("colSpan").asInt(1);

                    String tdStyle = buildCellStyle(cellNode, true, true);
                    html.append("<td class=\"table-widget__cell\"");
                    if (rowSpan > 1) html.append(" rowspan=\"").append(rowSpan).append("\"");
                    if (colSpan > 1) html.append(" colspan=\"").append(colSpan).append("\"");
                    if (!tdStyle.isEmpty()) html.append(" style=\"").append(escapeHtmlAttribute(tdStyle)).append("\"");
                    html.append(">");

                    html.append(renderCellInner(cellNode));
                    html.append("</td>");
                }
            }

            html.append("</tr>");
        }

        html.append("</tbody></table></div>");
        html.append("</div>");
        return html.toString();
    }

    private String renderCellInner(JsonNode cellNode) {
        JsonNode splitNode = cellNode.path("split");
        if (!splitNode.isMissingNode() && splitNode.isObject()) {
            int rows = Math.max(1, splitNode.path("rows").asInt(1));
            int cols = Math.max(1, splitNode.path("cols").asInt(1));
            JsonNode splitCells = splitNode.path("cells");

            StringBuilder sb = new StringBuilder();
            sb.append("<div class=\"table-widget__split-grid\" style=\"")
              .append("grid-template-columns: repeat(").append(cols).append(", 1fr);")
              .append("grid-template-rows: repeat(").append(rows).append(", 1fr);")
              .append("\">");

            if (splitCells.isArray()) {
                for (int i = 0; i < splitCells.size(); i++) {
                    JsonNode child = splitCells.get(i);
                    if (child == null || child.isNull()) continue;

                    // Skip covered children
                    if (!child.path("coveredBy").isMissingNode() && !child.path("coveredBy").isNull()) {
                        continue;
                    }

                    int r = i / cols;
                    int c = i % cols;

                    JsonNode mergeNode = child.path("merge");
                    int rowSpan = mergeNode.path("rowSpan").asInt(1);
                    int colSpan = mergeNode.path("colSpan").asInt(1);

                    // Sub-cell container should receive background fill (if any).
                    String subCellStyle = buildCellStyle(child, false, true);

                    sb.append("<div class=\"table-widget__sub-cell\" style=\"")
                      .append("grid-row-start: ").append(r + 1).append(";")
                      .append("grid-column-start: ").append(c + 1).append(";")
                      .append("grid-row-end: span ").append(Math.max(1, rowSpan)).append(";")
                      .append("grid-column-end: span ").append(Math.max(1, colSpan)).append(";");

                    if (!subCellStyle.isEmpty()) {
                        sb.append(escapeHtmlAttribute(subCellStyle));
                    }
                    sb.append("\">");

                    sb.append(renderContentDiv(child));
                    sb.append("</div>");
                }
            }

            sb.append("</div>");
            return sb.toString();
        }

        return renderContentDiv(cellNode);
    }

    private String renderContentDiv(JsonNode cellNode) {
        // Content div should NOT carry background-color; backgrounds are applied on td/sub-cell container.
        String divStyle = buildCellStyle(cellNode, false, false);
        String verticalFlex = buildVerticalAlignFlex(cellNode);
        if (!verticalFlex.isEmpty()) {
            divStyle = divStyle + verticalFlex;
        }

        String content = "";
        JsonNode contentNode = cellNode.path("contentHtml");
        if (!contentNode.isMissingNode() && !contentNode.isNull()) {
            content = contentNode.isTextual() ? contentNode.asText("") : contentNode.toString();
        }
        if (content.trim().isEmpty()) {
            content = "&nbsp;";
        }

        // For PDF we don't need contenteditable / data attributes; apply styles directly.
        StringBuilder sb = new StringBuilder();
        sb.append("<div class=\"table-widget__cell-content\"");
        if (!divStyle.isEmpty()) sb.append(" style=\"").append(escapeHtmlAttribute(divStyle)).append("\"");
        sb.append(">").append(content).append("</div>");
        return sb.toString();
    }

    /**
     * Map TableCellStyle.verticalAlign to a flexbox justify-content rule for the content container,
     * matching the frontend behavior (top/middle/bottom).
     */
    private String buildVerticalAlignFlex(JsonNode cellNode) {
        JsonNode styleNode = cellNode.path("style");
        if (styleNode.isMissingNode() || styleNode.isNull() || !styleNode.isObject()) {
            return "";
        }
        String verticalAlign = styleNode.path("verticalAlign").asText("");
        if (verticalAlign.isBlank()) {
            return "";
        }
        return switch (verticalAlign) {
            case "middle" -> "justify-content: center;";
            case "bottom" -> "justify-content: flex-end;";
            default -> "justify-content: flex-start;";
        };
    }

    /**
     * Build CSS style string from cell.style and (optionally) apply table-cell specifics.
     * @param cellNode cell json
     * @param forTableCell if true, prefer using td properties (vertical-align, text-align, background-color)
     * @param includeBackground if true, include background-color from style
     */
    private String buildCellStyle(JsonNode cellNode, boolean forTableCell, boolean includeBackground) {
        JsonNode styleNode = cellNode.path("style");
        if (styleNode.isMissingNode() || styleNode.isNull() || !styleNode.isObject()) {
            return "";
        }

        StringBuilder style = new StringBuilder();

        String textAlign = styleNode.path("textAlign").asText("");
        if (!textAlign.isBlank()) {
            style.append("text-align: ").append(textAlign).append(";");
        }

        String verticalAlign = styleNode.path("verticalAlign").asText("");
        if (!verticalAlign.isBlank()) {
            style.append("vertical-align: ").append(verticalAlign).append(";");
        }

        String fontWeight = styleNode.path("fontWeight").asText("");
        if (!fontWeight.isBlank()) {
            style.append("font-weight: ").append(fontWeight).append(";");
        }

        String fontStyle = styleNode.path("fontStyle").asText("");
        if (!fontStyle.isBlank()) {
            style.append("font-style: ").append(fontStyle).append(";");
        }

        if (includeBackground) {
            String backgroundColor = styleNode.path("backgroundColor").asText("");
            if (!backgroundColor.isBlank() && !"transparent".equalsIgnoreCase(backgroundColor)) {
                style.append("background-color: ").append(backgroundColor).append(";");
            } else if (forTableCell) {
                // Ensure table cells default to transparent rather than inheriting unexpected backgrounds.
                style.append("background-color: transparent;");
            }
        }

        return style.toString();
    }

    private String escapeHtmlAttribute(String input) {
        if (input == null || input.isEmpty()) {
            return "";
        }
        return input.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }

    public static String getCss() {
        return TABLE_WIDGET_CSS;
    }
}


