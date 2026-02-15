package com.org.report_generator.service.renderer;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.web.util.HtmlUtils;

import java.time.*;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.Locale;
import java.util.regex.Pattern;

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
            /* Allow other widgets to overlap visually (table cell content is still clipped by cell overflow rules). */
            overflow: visible;
            font-family: var(--slide-editor-font-family, 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif);
            color: var(--slide-editor-color, #0f172a);
            /* Match frontend default typography (tables default to 14px, not browser 16px). */
            font-size: var(--slide-table-font-size, 14px);
            line-height: 1.5;
            /* Defaults that can be overridden per-widget (e.g. showBorders=false) */
            --table-border-style: solid;
            --table-border-width: 1px;
            --table-border-color: var(--slide-table-border, #cbd5e1);
            --subcell-border-color: var(--slide-table-sub-border, #e2e8f0);
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
            border-left: 3px solid var(--slide-table-sub-border, #e2e8f0);
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

        /* Resizable inline images (matches frontend behavior) */
        .widget-table .tw-resizable-image {
            display: inline-block;
            vertical-align: middle;
            max-width: 100%;
            background: transparent;
            padding: 0;
            margin: 0 0.25em 0 0;
            position: relative;
        }

        .widget-table .tw-resizable-image img,
        .widget-table .tw-resizable-image svg {
            display: block;
            width: 100%;
        }

        .widget-table .tw-resizable-image img {
            height: auto;
            object-fit: contain;
        }

        .widget-table .tw-resizable-image svg {
            height: 100%;
        }

        .widget-table .tw-resizable-image--inline { float: none; }
        .widget-table .tw-resizable-image--left { float: left; margin: 0.1em 0.5em 0.1em 0; }
        .widget-table .tw-resizable-image--right { float: right; margin: 0.1em 0 0.1em 0.5em; }
        .widget-table .tw-resizable-image--block { display: block; float: none; clear: both; margin: 0.35em auto; }

        /* Clear floated images so container height includes them (prevents clipped content) */
        .widget-table .table-widget__cell-content::after {
            content: '';
            display: block;
            clear: both;
            height: 0;
        }

        /* Hide resize handle in exported output */
        .widget-table .tw-resizable-image__handle { display: none !important; }
        
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
        int headerRowCount = 0;
        if (headerRow) {
            int raw = props.path("headerRowCount").asInt(1);
            headerRowCount = Math.max(1, raw);
        }
        boolean firstColumn = props.path("firstColumn").asBoolean(false);
        boolean totalRow = props.path("totalRow").asBoolean(false);
        boolean lastColumn = props.path("lastColumn").asBoolean(false);

        // Column conditional formatting rules (persisted in props.columnRules)
        ConditionalFormattingEngine cond = new ConditionalFormattingEngine(props.path("columnRules"));

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
                    boolean isHeaderRow = headerRow && rowIndex < headerRowCount;
                    boolean allowConditional = rowIndex >= headerRowCount;
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
                    html.append(renderCellInner(
                        cellNode,
                        isHeaderRow,
                        isFirstCol,
                        isTotalRow,
                        isLastCol,
                        allowConditional,
                        rowIndex,
                        colIndex,
                        cond,
                        null
                    ));
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

    private String renderCellInner(
        JsonNode cellNode,
        boolean isHeaderRow,
        boolean isFirstCol,
        boolean isTotalRow,
        boolean isLastCol,
        boolean allowConditional,
        int rowIndex,
        int topColIndex,
        ConditionalFormattingEngine cond,
        int[] leafPath
    ) {
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
                    int[] childLeafPath = leafPath;
                    if (cols > 1) {
                        childLeafPath = appendLeafPath(leafPath, c);
                    }

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
                    sb.append(renderCellInner(
                        child,
                        isHeaderRow,
                        isFirstCol,
                        isTotalRow,
                        isLastCol,
                        allowConditional,
                        rowIndex,
                        topColIndex,
                        cond,
                        childLeafPath
                    ));
                    sb.append("</div>");
                }
            }

            sb.append("</div>");
            return sb.toString();
        }

        return renderCellSurface(cellNode, isHeaderRow, isFirstCol, isTotalRow, isLastCol, allowConditional, rowIndex, topColIndex, cond, leafPath);
    }

    private String renderCellSurface(
        JsonNode cellNode,
        boolean isHeaderRow,
        boolean isFirstCol,
        boolean isTotalRow,
        boolean isLastCol,
        boolean allowConditional,
        int rowIndex,
        int topColIndex,
        ConditionalFormattingEngine cond,
        int[] leafPath
    ) {
        ConditionalThen then = allowConditional ? cond.getConditionalThenForCell(rowIndex, topColIndex, leafPath, cellNode) : null;
        String verticalAlign = getVerticalAlign(cellNode, isHeaderRow);
        String surfaceStyle = buildSurfaceStyle(cellNode, isHeaderRow, isFirstCol, isTotalRow, isLastCol, then);
        String contentStyle = buildContentStyle(cellNode, isHeaderRow, isFirstCol, isTotalRow, isLastCol, then);

        String content = "";
        JsonNode contentNode = cellNode.path("contentHtml");
        if (!contentNode.isMissingNode() && !contentNode.isNull()) {
            content = contentNode.isTextual() ? contentNode.asText("") : contentNode.toString();
        }
        if (content.trim().isEmpty()) {
            content = "&nbsp;";
        }

        StringBuilder sb = new StringBuilder();
        sb.append("<div class=\"table-widget__cell-surface");
        if (then != null && then.cellClass != null && !then.cellClass.isBlank()) {
            sb.append(" ").append(escapeHtmlAttribute(then.cellClass.trim()));
        }
        sb.append("\"");
        if (then != null && then.tooltip != null && !then.tooltip.isBlank()) {
            sb.append(" title=\"").append(escapeHtmlAttribute(then.tooltip)).append("\"");
        }
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

    private String buildSurfaceStyle(JsonNode cellNode, boolean isHeaderRow, boolean isFirstCol, boolean isTotalRow, boolean isLastCol, ConditionalThen then) {
        JsonNode styleNode = cellNode.path("style");
        boolean hasStyleNode = !styleNode.isMissingNode() && !styleNode.isNull() && styleNode.isObject();

        StringBuilder style = new StringBuilder();

        String textAlign = hasStyleNode ? styleNode.path("textAlign").asText("") : "";
        if (!textAlign.isBlank()) {
            style.append("text-align: ").append(textAlign).append(";");
        }

        // Apply section background colors (header row wins over column, total row wins over column)
        String backgroundColor = hasStyleNode ? styleNode.path("backgroundColor").asText("") : "";
        backgroundColor = normalizeCssColor(backgroundColor);
        String condBackground = then != null ? normalizeCssColor(then.backgroundColor) : "";

        if (backgroundColor.isBlank() && !condBackground.isBlank()) {
            style.append("background-color: ").append(condBackground).append(";");
            return style.toString();
        }

        if (isHeaderRow) {
            // Header row (overrides user background unless explicitly set)
            if (backgroundColor.isBlank()) {
                style.append("background-color: var(--slide-table-header-bg, #dbeafe);");
            } else {
                style.append("background-color: ").append(backgroundColor).append(";");
            }
        } else if (isTotalRow) {
            // Total row (only if no user background)
            if (backgroundColor.isBlank()) {
                style.append("background-color: var(--slide-table-total-bg, #eef2f7);");
            } else {
                style.append("background-color: ").append(backgroundColor).append(";");
            }
        } else if (isFirstCol || isLastCol) {
            // First/Last column (only if no user background and not in header/total row)
            if (backgroundColor.isBlank()) {
                style.append("background-color: var(--slide-table-edge-bg, #f1f5f9);");
            } else {
                style.append("background-color: ").append(backgroundColor).append(";");
            }
        } else {
            // Regular cell
            if (!backgroundColor.isBlank()) {
                style.append("background-color: ").append(backgroundColor).append(";");
            } else {
                style.append("background-color: transparent;");
            }
        }

        return style.toString();
    }

    private String buildContentStyle(JsonNode cellNode, boolean isHeaderRow, boolean isFirstCol, boolean isTotalRow, boolean isLastCol, ConditionalThen then) {
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
        String condFontWeight = then != null ? (then.fontWeight == null ? "" : then.fontWeight) : "";
        if (!fontWeight.isBlank()) {
            style.append("font-weight: ").append(fontWeight).append(";");
        } else if (!condFontWeight.isBlank()) {
            style.append("font-weight: ").append(condFontWeight).append(";");
        } else if (isHeaderRow || isTotalRow || isFirstCol || isLastCol) {
            style.append("font-weight: bold;");
        }

        String fontStyle = hasStyleNode ? styleNode.path("fontStyle").asText("") : "";
        String condFontStyle = then != null ? (then.fontStyle == null ? "" : then.fontStyle) : "";
        if (!fontStyle.isBlank()) {
            style.append("font-style: ").append(fontStyle).append(";");
        } else if (!condFontStyle.isBlank()) {
            style.append("font-style: ").append(condFontStyle).append(";");
        }

        String textDecoration = hasStyleNode ? styleNode.path("textDecoration").asText("") : "";
        String condTextDecoration = then != null ? (then.textDecoration == null ? "" : then.textDecoration) : "";
        if (!textDecoration.isBlank()) {
            style.append("text-decoration: ").append(textDecoration).append(";");
        } else if (!condTextDecoration.isBlank()) {
            style.append("text-decoration: ").append(condTextDecoration).append(";");
        }

        String textColor = hasStyleNode ? styleNode.path("color").asText("") : "";
        String condTextColor = then != null ? normalizeCssColor(then.textColor) : "";
        if (!textColor.isBlank()) {
            style.append("color: ").append(textColor).append(";");
        } else if (!condTextColor.isBlank()) {
            style.append("color: ").append(condTextColor).append(";");
        }

        String textHighlight = hasStyleNode ? styleNode.path("textHighlightColor").asText("") : "";
        if (!textHighlight.isBlank() && !"transparent".equalsIgnoreCase(textHighlight)) {
            style.append("background-color: ").append(textHighlight).append(";");
        }

        return style.toString();
    }

    private static String normalizeCssColor(String c) {
        if (c == null) return "";
        String s = c.trim();
        if (s.isEmpty()) return "";
        if ("transparent".equalsIgnoreCase(s)) return "";
        return s;
    }

    private static int[] appendLeafPath(int[] base, int nextColIndex) {
        if (base == null || base.length == 0) {
            return new int[]{nextColIndex};
        }
        int[] out = Arrays.copyOf(base, base.length + 1);
        out[base.length] = nextColIndex;
        return out;
    }

    /**
     * Minimal backend implementation of the frontend table conditional formatting rules.
     * Applied at render-time for exports (PDF) so backend output matches editor behavior.
     */
    private static final class ConditionalFormattingEngine {
        private static final Pattern TAGS = Pattern.compile("<[^>]+>");
        private static final Pattern WS = Pattern.compile("\\s+");

        private final Map<String, String> htmlTextCache = new HashMap<>();
        private final Map<Integer, List<RuleSet>> ruleSetsByTopCol = new HashMap<>();

        ConditionalFormattingEngine(JsonNode columnRulesNode) {
            if (columnRulesNode == null || columnRulesNode.isMissingNode() || columnRulesNode.isNull() || !columnRulesNode.isArray()) {
                return;
            }
            for (JsonNode rsNode : columnRulesNode) {
                if (rsNode == null || rsNode.isNull() || !rsNode.isObject()) continue;
                boolean enabled = rsNode.path("enabled").asBoolean(true);
                if (!enabled) continue;
                JsonNode rulesNode = rsNode.path("rules");
                if (!rulesNode.isArray() || rulesNode.size() == 0) continue;

                Target target = Target.from(rsNode.path("target"));
                if (target == null) continue;

                List<Rule> rules = new ArrayList<>();
                for (JsonNode rNode : rulesNode) {
                    if (rNode == null || rNode.isNull() || !rNode.isObject()) continue;
                    boolean ruleEnabled = rNode.path("enabled").asBoolean(true);
                    if (!ruleEnabled) continue;
                    int priority = rNode.path("priority").asInt(0);
                    boolean stopIfTrue = rNode.path("stopIfTrue").asBoolean(false);

                    WhenExpr when = WhenGroup.from(rNode.path("when"));
                    if (when == null) continue;

                    Then then = Then.from(rNode.path("then"));
                    if (then == null) then = new Then(null, null, null, null, null, null, null);

                    rules.add(new Rule(priority, when, then, stopIfTrue));
                }
                if (rules.isEmpty()) continue;
                rules.sort(Comparator.comparingInt(a -> a.priority));

                RuleSet rs = new RuleSet(target, rules);
                ruleSetsByTopCol.computeIfAbsent(target.topColIndex, _k -> new ArrayList<>()).add(rs);
            }
        }

        ConditionalThen getConditionalThenForCell(int rowIndex, int topColIndex, int[] leafPath, JsonNode cellNode) {
            List<RuleSet> candidates = ruleSetsByTopCol.get(topColIndex);
            if (candidates == null || candidates.isEmpty()) return null;

            String cellText = htmlToText(cellNode.path("contentHtml").asText(""));
            ConditionalThen out = new ConditionalThen();

            // Whole-column targets first, then leaf targets (leaf can override).
            applyMatchingRuleSets(out, candidates, "whole", leafPath, cellText);
            applyMatchingRuleSets(out, candidates, "leaf", leafPath, cellText);

            return out.isEmpty() ? null : out;
        }

        private void applyMatchingRuleSets(ConditionalThen out, List<RuleSet> candidates, String kind, int[] leafPath, String cellText) {
            for (RuleSet rs : candidates) {
                if (!kind.equals(rs.target.kind)) continue;
                if ("leaf".equals(rs.target.kind)) {
                    // If the rendered cell is a split leaf, it must match the configured leafPath.
                    // If it's unsplit (leafPath == null), allow leaf rules to apply (apply_whole behavior).
                    if (leafPath != null && !Arrays.equals(leafPath, rs.target.leafPath)) continue;
                }

                for (Rule rule : rs.rules) {
                    if (evaluateRule(rule.when, cellText)) {
                        out.merge(rule.then);
                        if (rule.stopIfTrue) break;
                    }
                }
            }
        }

        private boolean evaluateRule(WhenExpr when, String cellText) {
            if (when == null) return false;

            if (when instanceof WhenGroup wg) {
                List<WhenSingle> conds = wg.conditions;
                if (conds == null || conds.isEmpty()) return false;
                if ("or".equals(wg.logic)) {
                    for (WhenSingle c : conds) {
                        if (evaluateRule(c, cellText)) return true;
                    }
                    return false;
                }
                // default AND
                for (WhenSingle c : conds) {
                    if (!evaluateRule(c, cellText)) return false;
                }
                return true;
            }

            return evaluateRule((WhenSingle) when, cellText);
        }

        private boolean evaluateRule(WhenSingle when, String cellText) {
            if (when == null || when.op == null) return false;

            String text = cellText == null ? "" : cellText;
            String valueRaw = when.value == null ? "" : when.value;
            boolean ignoreCase = when.ignoreCase;

            String textLower = text.toLowerCase(Locale.ROOT);
            String valueLower = valueRaw.toLowerCase(Locale.ROOT);

            return switch (when.op) {
                case "isEmpty" -> text.trim().isEmpty();
                case "isNotEmpty" -> !text.trim().isEmpty();
                case "equals" -> ignoreCase ? textLower.equals(valueLower) : text.equals(valueRaw);
                case "notEquals" -> ignoreCase ? !textLower.equals(valueLower) : !text.equals(valueRaw);
                case "equalsIgnoreCase" -> textLower.equals(valueLower);
                case "contains" -> ignoreCase ? textLower.contains(valueLower) : text.contains(valueRaw);
                case "notContains" -> ignoreCase ? !textLower.contains(valueLower) : !text.contains(valueRaw);
                case "startsWith" -> ignoreCase ? textLower.startsWith(valueLower) : text.startsWith(valueRaw);
                case "endsWith" -> ignoreCase ? textLower.endsWith(valueLower) : text.endsWith(valueRaw);
                case "inList" -> {
                    String[] list = when.values != null && when.values.length > 0 ? when.values : splitList(valueRaw);
                    String cur = ignoreCase ? textLower : text;
                    boolean ok = false;
                    for (String x : list) {
                        if (x == null) continue;
                        String t = x.trim();
                        if (t.isEmpty()) continue;
                        if (ignoreCase) t = t.toLowerCase(Locale.ROOT);
                        if (cur.equals(t)) {
                            ok = true;
                            break;
                        }
                    }
                    yield ok;
                }
                case "notInList" -> {
                    String[] list = when.values != null && when.values.length > 0 ? when.values : splitList(valueRaw);
                    String cur = ignoreCase ? textLower : text;
                    boolean ok = true;
                    for (String x : list) {
                        if (x == null) continue;
                        String t = x.trim();
                        if (t.isEmpty()) continue;
                        if (ignoreCase) t = t.toLowerCase(Locale.ROOT);
                        if (cur.equals(t)) {
                            ok = false;
                            break;
                        }
                    }
                    yield ok;
                }
                case "greaterThan", "greaterThanOrEqual", "lessThan", "lessThanOrEqual", "between", "notBetween" -> {
                    Double n = parseNumber(text);
                    if (n == null) yield false;
                    if ("between".equals(when.op) || "notBetween".equals(when.op)) {
                        Double a = parseNumber(when.min);
                        Double b = parseNumber(when.max);
                        if (a == null || b == null) yield false;
                        double lo = Math.min(a, b);
                        double hi = Math.max(a, b);
                        boolean in = n >= lo && n <= hi;
                        yield "between".equals(when.op) ? in : !in;
                    } else {
                        Double cmp = parseNumber(valueRaw);
                        if (cmp == null) yield false;
                        yield switch (when.op) {
                            case "greaterThan" -> n > cmp;
                            case "greaterThanOrEqual" -> n >= cmp;
                            case "lessThan" -> n < cmp;
                            case "lessThanOrEqual" -> n <= cmp;
                            default -> false;
                        };
                    }
                }
                case "before", "after", "on", "betweenDates" -> {
                    Long d = parseDateMs(text);
                    if (d == null) yield false;
                    if ("betweenDates".equals(when.op)) {
                        Long a = parseDateMs(when.min);
                        Long b = parseDateMs(when.max);
                        if (a == null || b == null) yield false;
                        long lo = Math.min(a, b);
                        long hi = Math.max(a, b);
                        yield d >= lo && d <= hi;
                    } else {
                        Long cmp = parseDateMs(valueRaw);
                        if (cmp == null) yield false;
                        if ("before".equals(when.op)) yield d < cmp;
                        if ("after".equals(when.op)) yield d > cmp;
                        // "on": same local date
                        LocalDate da = Instant.ofEpochMilli(d).atZone(ZoneId.systemDefault()).toLocalDate();
                        LocalDate db = Instant.ofEpochMilli(cmp).atZone(ZoneId.systemDefault()).toLocalDate();
                        yield da.equals(db);
                    }
                }
                default -> false;
            };
        }

        private String htmlToText(String html) {
            String key = html == null ? "" : html;
            String cached = htmlTextCache.get(key);
            if (cached != null) return cached;
            String s = HtmlUtils.htmlUnescape(key);
            // Very small, dependency-free approximation (good enough for rule comparisons).
            s = TAGS.matcher(s).replaceAll(" ");
            s = WS.matcher(s).replaceAll(" ").trim();
            htmlTextCache.put(key, s);
            return s;
        }

        private static String[] splitList(String raw) {
            if (raw == null) return new String[0];
            String[] parts = raw.split(",");
            List<String> out = new ArrayList<>();
            for (String p : parts) {
                if (p == null) continue;
                String t = p.trim();
                if (!t.isEmpty()) out.add(t);
            }
            return out.toArray(new String[0]);
        }

        private static Double parseNumber(String text) {
            if (text == null) return null;
            String t = text.trim();
            if (t.isEmpty()) return null;
            String normalized = t
                .replaceAll("[$€£¥₹,%]", "")
                .replaceAll("\\s+", "")
                .replace(",", "");
            try {
                double n = Double.parseDouble(normalized);
                return Double.isFinite(n) ? n : null;
            } catch (NumberFormatException e) {
                return null;
            }
        }

        private static Long parseDateMs(String text) {
            if (text == null) return null;
            String t = text.trim();
            if (t.isEmpty()) return null;

            // Try a few common formats (similar to JS Date.parse permissiveness).
            List<DateTimeFormatter> fmts = List.of(
                DateTimeFormatter.ISO_INSTANT,
                DateTimeFormatter.ISO_OFFSET_DATE_TIME,
                DateTimeFormatter.ISO_ZONED_DATE_TIME,
                DateTimeFormatter.ISO_LOCAL_DATE_TIME,
                DateTimeFormatter.ISO_LOCAL_DATE,
                DateTimeFormatter.ofPattern("M/d/uuuu"),
                DateTimeFormatter.ofPattern("M/d/uu"),
                DateTimeFormatter.ofPattern("d/M/uuuu"),
                DateTimeFormatter.ofPattern("d/M/uu"),
                DateTimeFormatter.ofPattern("uuuu-M-d"),
                DateTimeFormatter.ofPattern("uuuu/M/d")
            );

            for (DateTimeFormatter f : fmts) {
                try {
                    if (f == DateTimeFormatter.ISO_INSTANT) {
                        return Instant.parse(t).toEpochMilli();
                    }
                    if (f == DateTimeFormatter.ISO_OFFSET_DATE_TIME) {
                        return OffsetDateTime.parse(t, f).toInstant().toEpochMilli();
                    }
                    if (f == DateTimeFormatter.ISO_ZONED_DATE_TIME) {
                        return ZonedDateTime.parse(t, f).toInstant().toEpochMilli();
                    }

                    // Local date/time patterns: interpret in system default zone.
                    try {
                        LocalDateTime ldt = LocalDateTime.parse(t, f);
                        return ldt.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
                    } catch (DateTimeParseException ignore) {
                        LocalDate ld = LocalDate.parse(t, f);
                        return ld.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli();
                    }
                } catch (DateTimeParseException ignored) {
                    // continue
                }
            }
            return null;
        }

        private record RuleSet(Target target, List<Rule> rules) {}

        private record Rule(int priority, WhenExpr when, Then then, boolean stopIfTrue) {}

        private record Target(String kind, int topColIndex, int[] leafPath) {
            static Target from(JsonNode node) {
                if (node == null || node.isMissingNode() || node.isNull() || !node.isObject()) return null;
                String kind = node.path("kind").asText("");
                int top = node.path("topColIndex").asInt(-1);
                if (top < 0) return null;
                if ("leaf".equals(kind)) {
                    JsonNode lp = node.path("leafPath");
                    if (lp.isArray() && lp.size() > 0) {
                        int[] arr = new int[lp.size()];
                        for (int i = 0; i < lp.size(); i++) arr[i] = lp.get(i).asInt(0);
                        return new Target("leaf", top, arr);
                    }
                    // If leafPath is missing/empty, treat as whole (matches frontend behavior).
                    return new Target("whole", top, null);
                }
                return new Target("whole", top, null);
            }
        }

        private sealed interface WhenExpr permits WhenSingle, WhenGroup {}

        private record WhenSingle(String op, String value, String min, String max, String[] values, boolean ignoreCase) implements WhenExpr {
            static WhenSingle from(JsonNode node) {
                if (node == null || node.isMissingNode() || node.isNull() || !node.isObject()) return null;
                String op = node.path("op").asText("");
                String value = node.path("value").asText("");
                String min = node.path("min").asText("");
                String max = node.path("max").asText("");
                boolean ignoreCase = node.path("ignoreCase").asBoolean(true);
                String[] valuesArr = null;
                JsonNode valuesNode = node.path("values");
                if (valuesNode.isArray() && valuesNode.size() > 0) {
                    valuesArr = new String[valuesNode.size()];
                    for (int i = 0; i < valuesNode.size(); i++) {
                        valuesArr[i] = valuesNode.get(i).asText("");
                    }
                }
                return new WhenSingle(op, value, min, max, valuesArr, ignoreCase);
            }
        }

        private record WhenGroup(String logic, List<WhenSingle> conditions) implements WhenExpr {
            static WhenExpr from(JsonNode node) {
                if (node == null || node.isMissingNode() || node.isNull() || !node.isObject()) return null;
                JsonNode conds = node.path("conditions");
                if (conds.isArray()) {
                    List<WhenSingle> out = new ArrayList<>();
                    for (JsonNode c : conds) {
                        WhenSingle w = WhenSingle.from(c);
                        if (w != null && w.op != null && !w.op.isBlank()) out.add(w);
                    }
                    if (out.isEmpty()) return null;
                    String logic = node.path("logic").asText("and");
                    logic = "or".equalsIgnoreCase(logic) ? "or" : "and";
                    return new WhenGroup(logic, out);
                }
                return WhenSingle.from(node);
            }
        }

        private record Then(String cellClass, String backgroundColor, String textColor, String fontWeight, String fontStyle, String textDecoration, String tooltip) {
            static Then from(JsonNode node) {
                if (node == null || node.isMissingNode() || node.isNull() || !node.isObject()) return null;
                return new Then(
                    node.path("cellClass").asText(""),
                    node.path("backgroundColor").asText(""),
                    node.path("textColor").asText(""),
                    node.path("fontWeight").asText(""),
                    node.path("fontStyle").asText(""),
                    node.path("textDecoration").asText(""),
                    node.path("tooltip").asText("")
                );
            }
        }
    }

    private static final class ConditionalThen {
        String cellClass;
        String tooltip;
        String backgroundColor;
        String textColor;
        String fontWeight;
        String fontStyle;
        String textDecoration;

        boolean isEmpty() {
            return (cellClass == null || cellClass.isBlank())
                && (tooltip == null || tooltip.isBlank())
                && (backgroundColor == null || backgroundColor.isBlank())
                && (textColor == null || textColor.isBlank())
                && (fontWeight == null || fontWeight.isBlank())
                && (fontStyle == null || fontStyle.isBlank())
                && (textDecoration == null || textDecoration.isBlank());
        }

        void merge(ConditionalFormattingEngine.Then then) {
            if (then == null) return;
            if (then.cellClass() != null && !then.cellClass().isBlank()) this.cellClass = then.cellClass();
            if (then.tooltip() != null && !then.tooltip().isBlank()) this.tooltip = then.tooltip();
            if (then.backgroundColor() != null && !then.backgroundColor().isBlank()) this.backgroundColor = then.backgroundColor();
            if (then.textColor() != null && !then.textColor().isBlank()) this.textColor = then.textColor();
            if (then.fontWeight() != null && !then.fontWeight().isBlank()) this.fontWeight = then.fontWeight();
            if (then.fontStyle() != null && !then.fontStyle().isBlank()) this.fontStyle = then.fontStyle();
            if (then.textDecoration() != null && !then.textDecoration().isBlank()) this.textDecoration = then.textDecoration();
        }
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


