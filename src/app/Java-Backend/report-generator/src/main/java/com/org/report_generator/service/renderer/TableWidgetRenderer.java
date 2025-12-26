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
            /* Avoid clipping when UI auto-grows rows/widget during typing. */
            overflow: visible;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
            color: #0f172a;
            /* Defaults that can be overridden per-widget (e.g. showBorders=false) */
            --table-border-style: solid;
            --table-border-width: 1px;
            --table-border-color: #cbd5e1;
            --subcell-border-color: #e2e8f0;
            /* Runtime-only scaling to prevent clipped text for dense (URL-based) tables in fixed frames. */
            --tw-auto-fit-scale: 1;
        }
        
        .widget-table .table-widget {
            width: 100%;
            height: 100%;
            overflow: visible;
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
            border-width: var(--table-border-width);
            border-style: var(--table-border-style);
            border-color: var(--table-border-color);
            padding: 0;
            margin: 0;
            background: transparent;
            vertical-align: top;
            position: relative;
            min-width: 40px;
            min-height: 24px;
            overflow: hidden; /* Match frontend: prevent content from spilling outside fixed row heights */
        }
        
        /* Matches frontend wrapper: handles background + vertical alignment (top/middle/bottom). */
        .widget-table .table-widget__cell-surface {
            width: 100%;
            height: 100%;
            min-height: 24px;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            background: transparent;
        }

        .widget-table .table-widget__cell-surface[data-vertical-align='top'] {
            justify-content: flex-start;
        }

        .widget-table .table-widget__cell-surface[data-vertical-align='middle'] {
            justify-content: center;
        }

        .widget-table .table-widget__cell-surface[data-vertical-align='bottom'] {
            justify-content: flex-end;
        }

        .widget-table .table-widget__cell-content {
            width: 100%;
            min-height: 24px;
            padding:
                clamp(0px, calc(4px * var(--tw-auto-fit-scale, 1)), 4px)
                clamp(0px, calc(8px * var(--tw-auto-fit-scale, 1)), 8px);
            box-sizing: border-box;
            word-wrap: break-word;
            overflow-wrap: break-word;
            word-break: break-word;
            background: transparent;
            color: inherit;
            font-family: inherit;
            font-size: clamp(8px, calc(1em * var(--tw-auto-fit-scale, 1)), 1em);
            line-height: clamp(1.0, calc(1.5 * var(--tw-auto-fit-scale, 1)), 1.5);
            display: block;
        }

        /* Legacy vertical align support */
        .widget-table .table-widget__cell-surface[data-vertical-align='middle'] .table-widget__cell-content {
            /* handled by flex */
        }

        .widget-table .table-widget__cell-surface[data-vertical-align='bottom'] .table-widget__cell-content {
            /* handled by flex */
        }
        
        /* Embedded bold/italic */
        .widget-table .table-widget__cell-content b,
        .widget-table .table-widget__cell-content strong { font-weight: 700; }
        .widget-table .table-widget__cell-content i,
        .widget-table .table-widget__cell-content em { font-style: italic; }
        .widget-table .table-widget__cell-content u { text-decoration: underline; }
        .widget-table .table-widget__cell-content s,
        .widget-table .table-widget__cell-content strike,
        .widget-table .table-widget__cell-content del { text-decoration: line-through; }

        /* Superscript/Subscript */
        .widget-table .table-widget__cell-content sup {
            vertical-align: super;
            font-size: 0.75em;
            line-height: 0;
            position: relative;
            top: -0.4em;
        }
        .widget-table .table-widget__cell-content sub {
            vertical-align: sub;
            font-size: 0.75em;
            line-height: 0;
            position: relative;
            bottom: -0.2em;
        }

        /* Indent typically produces blockquote or inline margins; keep it readable. */
        .widget-table .table-widget__cell-content blockquote {
            margin: 0.25em 0 0.25em 1em;
            padding-left: 0.75em;
            border-left: 3px solid #e2e8f0;
        }

        /* Lists inside table cells - proper display with inherited font size */
        .widget-table .table-widget__cell-content ul,
        .widget-table .table-widget__cell-content ol {
            display: block !important;
            margin: 0 !important;
            padding: 0 !important;
            list-style-position: inside !important;
        }

        .widget-table .table-widget__cell-content ul {
            list-style-type: disc !important;
        }

        .widget-table .table-widget__cell-content ol {
            list-style-type: decimal !important;
        }

        .widget-table .table-widget__cell-content li {
            display: list-item !important;
            margin: 0 !important;
            padding: 0 !important;
            text-indent: 0 !important;
        }
        
        /* Custom marker lists - use ::before for automatic marker on new items */
        .widget-table .table-widget__cell-content .custom-marker-list {
            list-style-type: none !important;
        }
        
        .widget-table .table-widget__cell-content .custom-marker-list li {
            display: block !important;
        }
        
        .widget-table .table-widget__cell-content .custom-marker-list li::before {
            display: inline;
            margin-right: 0.3em;
        }
        
        .widget-table .table-widget__cell-content .custom-marker-arrow li::before {
            content: '➤';
        }
        
        .widget-table .table-widget__cell-content .custom-marker-chevron li::before {
            content: '›';
        }
        
        .widget-table .table-widget__cell-content .custom-marker-dash li::before {
            content: '–';
        }
        
        .widget-table .table-widget__cell-content .custom-marker-check li::before {
            content: '✓';
        }
        
        /* Split grid inside a cell */
        .widget-table .table-widget__split-grid {
            display: grid;
            width: 100%;
            height: 100%;
            min-height: 24px;
        }
        
        .widget-table .table-widget__sub-cell {
            border-width: var(--table-border-width);
            border-style: var(--table-border-style);
            border-color: var(--subcell-border-color);
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

        boolean showBorders = true;
        JsonNode showBordersNode = props.path("showBorders");
        if (!showBordersNode.isMissingNode() && !showBordersNode.isNull()) {
            showBorders = showBordersNode.asBoolean(true);
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

        // Read section options (headerRow, firstColumn, totalRow, lastColumn)
        boolean headerRow = props.path("headerRow").asBoolean(false);
        boolean firstColumn = props.path("firstColumn").asBoolean(false);
        boolean totalRow = props.path("totalRow").asBoolean(false);
        boolean lastColumn = props.path("lastColumn").asBoolean(false);

        // Mark URL-based tables so the PDF pipeline can apply runtime auto-fit scaling before rendering.
        boolean isUrlTable = "http".equalsIgnoreCase(props.path("dataSource").path("kind").asText(""));

        double[] colFractions = parseFractions(props.path("columnFractions"), colCount);
        double[] rowFractions = parseFractions(props.path("rowFractions"), rowCount);

        StringBuilder html = new StringBuilder();
        StringBuilder outerStyle = new StringBuilder(widgetStyle);
        if (!showBorders) {
            // Hide default grid borders (explicit per-cell borders can still override via inline style)
            outerStyle.append("--table-border-style: none; --table-border-width: 0px;");
        }

        html.append("<div class=\"widget widget-table\"");
        if (isUrlTable) {
            html.append(" data-url-table=\"true\"");
        }
        html.append(" style=\"").append(escapeHtmlAttribute(outerStyle.toString())).append("\">");
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
                int colIndex = 0;
                for (JsonNode cellNode : cellsNode) {
                    if (cellNode == null || cellNode.isNull()) continue;

                    // Skip covered cells; anchor cell carries rowspan/colspan.
                    if (!cellNode.path("coveredBy").isMissingNode() && !cellNode.path("coveredBy").isNull()) {
                        continue;
                    }

                    JsonNode mergeNode = cellNode.path("merge");
                    int rowSpan = mergeNode.path("rowSpan").asInt(1);
                    int colSpan = mergeNode.path("colSpan").asInt(1);

                    // Determine if this cell is in a special section
                    boolean isHeaderRow = headerRow && rowIndex == 0;
                    boolean isTotalRow = totalRow && rowIndex == rowCount - 1 && rowCount > 1;
                    // For merged cells: first column if starts at 0, last column if ends at colCount-1
                    boolean isFirstCol = firstColumn && colIndex == 0;
                    boolean isLastCol = lastColumn && (colIndex + colSpan - 1) >= (colCount - 1) && colCount > 1;

                    String borderStyle = buildBorderStyle(cellNode, isTotalRow);

                    html.append("<td class=\"table-widget__cell\"");
                    if (rowSpan > 1) html.append(" rowspan=\"").append(rowSpan).append("\"");
                    if (colSpan > 1) html.append(" colspan=\"").append(colSpan).append("\"");
                    if (!borderStyle.isEmpty()) {
                        html.append(" style=\"").append(escapeHtmlAttribute(borderStyle)).append("\"");
                    }
                    html.append(">");

                    // Apply section styling based on position
                    html.append(renderCellInner(cellNode, isHeaderRow, isFirstCol, isTotalRow, isLastCol));
                    html.append("</td>");
                    
                    colIndex += colSpan;
                }
            }

            html.append("</tr>");
            rowIndex++;
        }

        html.append("</tbody></table></div>");
        html.append("</div>");
        return html.toString();
    }

    private String renderCellInner(JsonNode cellNode, boolean isHeaderRow, boolean isFirstCol, boolean isTotalRow, boolean isLastCol) {
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

                    // Split cells are nested, so they don't get section styling (only top-level cells do)
                    String borderStyle = buildBorderStyle(child, false);
                    if (!borderStyle.isEmpty()) {
                        sb.append(escapeHtmlAttribute(borderStyle));
                    }
                    sb.append("\">");

                    // Recurse so nested split grids render correctly (split-inside-split).
                    // For split cells, they're nested so they don't get section styling (pass false for all)
                    sb.append(renderCellInner(child, false, false, false, false));
                    sb.append("</div>");
                }
            }

            sb.append("</div>");
            return sb.toString();
        }

        return renderCellSurface(cellNode, isHeaderRow, isFirstCol, isTotalRow, isLastCol);
    }

    private String renderCellSurface(JsonNode cellNode, boolean isHeaderRow, boolean isFirstCol, boolean isTotalRow, boolean isLastCol) {
        String verticalAlign = getVerticalAlign(cellNode, isHeaderRow);
        String surfaceStyle = buildSurfaceStyle(cellNode, isHeaderRow, isFirstCol, isTotalRow, isLastCol);
        String contentStyle = buildContentStyle(cellNode, isHeaderRow, isFirstCol, isTotalRow, isLastCol);

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

    private String getVerticalAlign(JsonNode cellNode, boolean isHeaderRow) {
        JsonNode styleNode = cellNode.path("style");
        if (styleNode.isMissingNode() || styleNode.isNull() || !styleNode.isObject()) {
            // Header row defaults to middle
            return isHeaderRow ? "middle" : "top";
        }
        String verticalAlign = styleNode.path("verticalAlign").asText("");
        if (verticalAlign.isBlank()) {
            return isHeaderRow ? "middle" : "top";
        }
        return verticalAlign;
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

    private String buildSurfaceStyle(JsonNode cellNode, boolean isHeaderRow, boolean isFirstCol, boolean isTotalRow, boolean isLastCol) {
        JsonNode styleNode = cellNode.path("style");
        boolean hasStyleNode = !styleNode.isMissingNode() && !styleNode.isNull() && styleNode.isObject();

        StringBuilder style = new StringBuilder();

        String textAlign = hasStyleNode ? styleNode.path("textAlign").asText("") : "";
        if (!textAlign.isBlank()) {
            style.append("text-align: ").append(textAlign).append(";");
        }

        // Apply section background colors (header row wins over column, total row wins over column)
        String backgroundColor = hasStyleNode ? styleNode.path("backgroundColor").asText("") : "";
        if (isHeaderRow) {
            // Header row: #e5e7eb (overrides user background unless explicitly set)
            if (backgroundColor.isBlank() || "transparent".equalsIgnoreCase(backgroundColor)) {
                style.append("background-color: #e5e7eb;");
            } else {
                style.append("background-color: ").append(backgroundColor).append(";");
            }
        } else if (isTotalRow) {
            // Total row: #eef2f7 (only if no user background)
            if (backgroundColor.isBlank() || "transparent".equalsIgnoreCase(backgroundColor)) {
                style.append("background-color: #eef2f7;");
            } else {
                style.append("background-color: ").append(backgroundColor).append(";");
            }
        } else if (isFirstCol || isLastCol) {
            // First/Last column: #f1f5f9 (only if no user background and not in header/total row)
            if (backgroundColor.isBlank() || "transparent".equalsIgnoreCase(backgroundColor)) {
                style.append("background-color: #f1f5f9;");
            } else {
                style.append("background-color: ").append(backgroundColor).append(";");
            }
        } else {
            // Regular cell
            if (!backgroundColor.isBlank() && !"transparent".equalsIgnoreCase(backgroundColor)) {
                style.append("background-color: ").append(backgroundColor).append(";");
            } else {
                style.append("background-color: transparent;");
            }
        }

        return style.toString();
    }

    private String buildContentStyle(JsonNode cellNode, boolean isHeaderRow, boolean isFirstCol, boolean isTotalRow, boolean isLastCol) {
        // Content div should NOT carry background-color (surface handles it).
        JsonNode styleNode = cellNode.path("style");
        boolean hasStyleNode = !styleNode.isMissingNode() && !styleNode.isNull() && styleNode.isObject();

        StringBuilder style = new StringBuilder();

        String fontFamily = hasStyleNode ? styleNode.path("fontFamily").asText("") : "";
        if (!fontFamily.isBlank()) {
            style.append("font-family: ").append(fontFamily).append(";");
        }

        int fontSizePx = hasStyleNode ? styleNode.path("fontSizePx").asInt(0) : 0;
        if (fontSizePx > 0) {
            style.append("font-size: ").append(fontSizePx).append("px;");
        }

        String lineHeight = hasStyleNode ? styleNode.path("lineHeight").asText("") : "";
        if (!lineHeight.isBlank()) {
            style.append("line-height: ").append(lineHeight).append(";");
        }

        // Apply section font-weight (bold for header row, total row, first/last column)
        String fontWeight = hasStyleNode ? styleNode.path("fontWeight").asText("") : "";
        if (isHeaderRow || isTotalRow || isFirstCol || isLastCol) {
            // Section styling: bold unless user explicitly set a different weight
            if (fontWeight.isBlank()) {
                style.append("font-weight: bold;");
            } else {
                style.append("font-weight: ").append(fontWeight).append(";");
            }
        } else if (!fontWeight.isBlank()) {
            style.append("font-weight: ").append(fontWeight).append(";");
        }

        String fontStyle = hasStyleNode ? styleNode.path("fontStyle").asText("") : "";
        if (!fontStyle.isBlank()) {
            style.append("font-style: ").append(fontStyle).append(";");
        }

        String textDecoration = hasStyleNode ? styleNode.path("textDecoration").asText("") : "";
        if (!textDecoration.isBlank()) {
            style.append("text-decoration: ").append(textDecoration).append(";");
        }

        String textColor = hasStyleNode ? styleNode.path("color").asText("") : "";
        if (!textColor.isBlank()) {
            style.append("color: ").append(textColor).append(";");
        }

        String textHighlight = hasStyleNode ? styleNode.path("textHighlightColor").asText("") : "";
        if (!textHighlight.isBlank() && !"transparent".equalsIgnoreCase(textHighlight)) {
            style.append("background-color: ").append(textHighlight).append(";");
        }

        return style.toString();
    }

    private String buildBorderStyle(JsonNode cellNode, boolean isTotalRow) {
        JsonNode styleNode = cellNode.path("style");
        if (styleNode.isMissingNode() || styleNode.isNull() || !styleNode.isObject()) {
            // Total row gets a thicker top border by default
            if (isTotalRow) {
                return "border-top-width: 2px; border-top-style: solid;";
            }
            return "";
        }

        String borderStyle = styleNode.path("borderStyle").asText("");
        String borderColor = styleNode.path("borderColor").asText("");
        int borderWidth = styleNode.path("borderWidth").asInt(0);
        
        // Total row: emphasize with thicker top border (minimum 2px)
        if (isTotalRow && borderWidth < 2) {
            borderWidth = 2;
            if (borderStyle.isBlank()) {
                borderStyle = "solid";
            }
        }

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


