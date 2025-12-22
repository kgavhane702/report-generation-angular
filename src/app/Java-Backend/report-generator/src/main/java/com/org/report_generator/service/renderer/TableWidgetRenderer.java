package com.org.report_generator.service.renderer;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.Locale;

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
            border-spacing: 0;
            table-layout: fixed;
            background: transparent;
        }
        
        .widget-table .table-widget__cell {
            /* Use opaque colors for reliable PDF rendering (some engines ignore rgba borders). */
            border-width: 1px;
            border-style: solid;
            border-color: #cbd5e1;
            padding: 0;
            margin: 0;
            background: transparent;
            vertical-align: top;
            position: relative;
            min-width: 40px;
            min-height: 24px;
        }
        
        /* Matches frontend wrapper: handles background + vertical alignment (top/middle/bottom). */
        .widget-table .table-widget__cell-surface {
            width: 100%;
            height: 100%;
            min-height: 24px;
            box-sizing: border-box;
            display: table;
            background: transparent;
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
            /* Do NOT use flex on content node; inline wrappers like <b>/<span> can become flex items and break lines. */
            display: table-cell;
            vertical-align: top;
        }

        .widget-table .table-widget__cell-surface[data-vertical-align='middle'] .table-widget__cell-content {
            vertical-align: middle;
        }

        .widget-table .table-widget__cell-surface[data-vertical-align='bottom'] .table-widget__cell-content {
            vertical-align: bottom;
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
            border-width: 1px;
            border-style: solid;
            border-color: #e2e8f0;
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
            return "<div class=\"widget widget-table\" style=\"" + escapeHtmlAttribute(widgetStyle) + "\"></div>";
        }

        JsonNode rowsNode = props.path("rows");
        if (rowsNode.isMissingNode() || !rowsNode.isArray() || rowsNode.size() == 0) {
            return "<div class=\"widget widget-table\" style=\"" + escapeHtmlAttribute(widgetStyle) + "\"></div>";
        }

        // Optional persisted sizing (fractions that sum to 1)
        int rowCount = rowsNode.size();
        int colCount = 1;
        JsonNode firstRow = rowsNode.get(0);
        if (firstRow != null && !firstRow.isNull()) {
            JsonNode firstCells = firstRow.path("cells");
            if (firstCells.isArray() && firstCells.size() > 0) {
                colCount = firstCells.size();
            }
        }

        double[] colFractions = parseFractions(props.path("columnFractions"), colCount);
        double[] rowFractions = parseFractions(props.path("rowFractions"), rowCount);

        StringBuilder html = new StringBuilder();
        html.append("<div class=\"widget widget-table\" style=\"").append(escapeHtmlAttribute(widgetStyle)).append("\">");
        html.append("<div class=\"table-widget\"><table class=\"table-widget__table\">");

        // Column sizing via <colgroup> for stable fixed-layout tables (matches frontend)
        html.append("<colgroup>");
        for (double f : colFractions) {
            double pct = f * 100d;
            html.append("<col style=\"width: ")
                .append(String.format(Locale.ROOT, "%.6f", pct))
                .append("%;\" />");
        }
        html.append("</colgroup>");

        html.append("<tbody>");

        int rowIndex = 0;
        for (JsonNode rowNode : rowsNode) {
            if (rowNode == null || rowNode.isNull()) continue;
            JsonNode cellsNode = rowNode.path("cells");

            double rowPct = (rowIndex >= 0 && rowIndex < rowFractions.length) ? (rowFractions[rowIndex] * 100d) : (100d / Math.max(1, rowCount));
            html.append("<tr class=\"table-widget__row\" style=\"height: ")
                .append(String.format(Locale.ROOT, "%.6f", rowPct))
                .append("%;\">");

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

                    String borderStyle = buildBorderStyle(cellNode);

                    html.append("<td class=\"table-widget__cell\"");
                    if (rowSpan > 1) html.append(" rowspan=\"").append(rowSpan).append("\"");
                    if (colSpan > 1) html.append(" colspan=\"").append(colSpan).append("\"");
                    if (!borderStyle.isEmpty()) {
                        html.append(" style=\"").append(escapeHtmlAttribute(borderStyle)).append("\"");
                    }
                    html.append(">");

                    html.append(renderCellInner(cellNode));
                    html.append("</td>");
                }
            }

            html.append("</tr>");
            rowIndex++;
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

            // Optional persisted sizing for split grids (fractions that sum to 1)
            double[] splitColFractions = parseFractions(splitNode.path("columnFractions"), cols);
            double[] splitRowFractions = parseFractions(splitNode.path("rowFractions"), rows);

            StringBuilder sb = new StringBuilder();
            sb.append("<div class=\"table-widget__split-grid\" style=\"")
              .append("grid-template-columns: ");
            for (double f : splitColFractions) {
                double pct = f * 100d;
                sb.append(String.format(Locale.ROOT, "%.6f", pct)).append("% ");
            }
            sb.append(";")
              .append("grid-template-rows: ");
            for (double f : splitRowFractions) {
                double pct = f * 100d;
                sb.append(String.format(Locale.ROOT, "%.6f", pct)).append("% ");
            }
            sb.append(";")
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

                    sb.append("<div class=\"table-widget__sub-cell\" style=\"")
                      .append("grid-row-start: ").append(r + 1).append(";")
                      .append("grid-column-start: ").append(c + 1).append(";")
                      .append("grid-row-end: span ").append(Math.max(1, rowSpan)).append(";")
                      .append("grid-column-end: span ").append(Math.max(1, colSpan)).append(";");

                    String borderStyle = buildBorderStyle(child);
                    if (!borderStyle.isEmpty()) {
                        sb.append(escapeHtmlAttribute(borderStyle));
                    }
                    sb.append("\">");

                    // Recurse so nested split grids render correctly (split-inside-split).
                    sb.append(renderCellInner(child));
                    sb.append("</div>");
                }
            }

            sb.append("</div>");
            return sb.toString();
        }

        return renderCellSurface(cellNode);
    }

    private String renderCellSurface(JsonNode cellNode) {
        String verticalAlign = getVerticalAlign(cellNode);
        String surfaceStyle = buildSurfaceStyle(cellNode);
        String contentStyle = buildContentStyle(cellNode);

        String content = "";
        JsonNode contentNode = cellNode.path("contentHtml");
        if (!contentNode.isMissingNode() && !contentNode.isNull()) {
            content = contentNode.isTextual() ? contentNode.asText("") : contentNode.toString();
        }
        if (content.trim().isEmpty()) {
            content = "&nbsp;";
        }

        StringBuilder sb = new StringBuilder();
        sb.append("<div class=\"table-widget__cell-surface\"");
        if (!verticalAlign.isEmpty()) {
            sb.append(" data-vertical-align=\"").append(escapeHtmlAttribute(verticalAlign)).append("\"");
        }
        if (!surfaceStyle.isEmpty()) {
            sb.append(" style=\"").append(escapeHtmlAttribute(surfaceStyle)).append("\"");
        }
        sb.append(">");

        sb.append("<div class=\"table-widget__cell-content\"");
        if (!contentStyle.isEmpty()) {
            sb.append(" style=\"").append(escapeHtmlAttribute(contentStyle)).append("\"");
        }
        sb.append(">").append(content).append("</div>");

        sb.append("</div>");
        return sb.toString();
    }

    private String getVerticalAlign(JsonNode cellNode) {
        JsonNode styleNode = cellNode.path("style");
        if (styleNode.isMissingNode() || styleNode.isNull() || !styleNode.isObject()) {
            return "top";
        }
        String verticalAlign = styleNode.path("verticalAlign").asText("");
        return verticalAlign.isBlank() ? "top" : verticalAlign;
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

    private String buildSurfaceStyle(JsonNode cellNode) {
        JsonNode styleNode = cellNode.path("style");
        if (styleNode.isMissingNode() || styleNode.isNull() || !styleNode.isObject()) {
            return "";
        }

        StringBuilder style = new StringBuilder();

        String textAlign = styleNode.path("textAlign").asText("");
        if (!textAlign.isBlank()) {
            style.append("text-align: ").append(textAlign).append(";");
        }

        String backgroundColor = styleNode.path("backgroundColor").asText("");
        if (!backgroundColor.isBlank() && !"transparent".equalsIgnoreCase(backgroundColor)) {
            style.append("background-color: ").append(backgroundColor).append(";");
        } else {
            style.append("background-color: transparent;");
        }

        return style.toString();
    }

    private String buildContentStyle(JsonNode cellNode) {
        // Content div should NOT carry background-color (surface handles it).
        JsonNode styleNode = cellNode.path("style");
        if (styleNode.isMissingNode() || styleNode.isNull() || !styleNode.isObject()) {
            return "";
        }

        StringBuilder style = new StringBuilder();

        String fontFamily = styleNode.path("fontFamily").asText("");
        if (!fontFamily.isBlank()) {
            style.append("font-family: ").append(fontFamily).append(";");
        }

        int fontSizePx = styleNode.path("fontSizePx").asInt(0);
        if (fontSizePx > 0) {
            style.append("font-size: ").append(fontSizePx).append("px;");
        }

        String fontWeight = styleNode.path("fontWeight").asText("");
        if (!fontWeight.isBlank()) {
            style.append("font-weight: ").append(fontWeight).append(";");
        }

        String fontStyle = styleNode.path("fontStyle").asText("");
        if (!fontStyle.isBlank()) {
            style.append("font-style: ").append(fontStyle).append(";");
        }

        return style.toString();
    }

    private String buildBorderStyle(JsonNode cellNode) {
        JsonNode styleNode = cellNode.path("style");
        if (styleNode.isMissingNode() || styleNode.isNull() || !styleNode.isObject()) {
            return "";
        }

        String borderStyle = styleNode.path("borderStyle").asText("");
        String borderColor = styleNode.path("borderColor").asText("");
        int borderWidth = styleNode.path("borderWidth").asInt(0);

        StringBuilder style = new StringBuilder();

        if (!borderStyle.isBlank()) {
            // Allow explicit "none" to remove borders
            style.append("border-style: ").append(borderStyle).append(";");
        }
        if (borderWidth > 0) {
            style.append("border-width: ").append(borderWidth).append("px;");
        }
        if (!borderColor.isBlank()) {
            style.append("border-color: ").append(borderColor).append(";");
        }

        return style.toString();
    }

    private double[] parseFractions(JsonNode node, int count) {
        int n = Math.max(1, count);
        double[] out = new double[n];

        if (node != null && node.isArray() && node.size() == n) {
            double sum = 0d;
            for (int i = 0; i < n; i++) {
                double v = node.get(i).asDouble(0d);
                if (!Double.isFinite(v) || v <= 0d) {
                    v = 0d;
                }
                out[i] = v;
                sum += v;
            }
            if (sum > 0d) {
                for (int i = 0; i < n; i++) {
                    out[i] = out[i] / sum;
                }
                return out;
            }
        }

        // Default equal fractions
        double eq = 1d / n;
        for (int i = 0; i < n; i++) {
            out[i] = eq;
        }
        return out;
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


