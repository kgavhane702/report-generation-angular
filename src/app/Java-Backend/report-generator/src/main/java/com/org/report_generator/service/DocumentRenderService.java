package com.org.report_generator.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.MissingNode;
import com.org.report_generator.model.document.DocumentModel;
import com.org.report_generator.model.document.FooterConfig;
import com.org.report_generator.model.document.LogoConfig;
import com.org.report_generator.model.document.Page;
import com.org.report_generator.model.document.PageSize;
import com.org.report_generator.model.document.Section;
import com.org.report_generator.model.document.Subsection;
import com.org.report_generator.model.document.Widget;
import com.org.report_generator.model.document.WidgetPosition;
import com.org.report_generator.model.document.WidgetSize;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

@Service
public class DocumentRenderService {

    private static final double DEFAULT_WIDTH_MM = 254d;
    private static final double DEFAULT_HEIGHT_MM = 190.5d;
    private static final int DEFAULT_DPI = 96;

    public String render(DocumentModel document) {
        List<Page> pages = collectPages(document);
        StringBuilder html = new StringBuilder();

        html.append("<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">");
        html.append("<title>").append(Optional.ofNullable(document.getTitle()).orElse("Document")).append("</title>");
        html.append("<style>")
                .append(getGlobalStyles())
                .append(getPageStyles(pages, document))
                .append("</style></head><body><div class=\"document-container\">");

        for (Page page : pages) {
            html.append(renderPage(page, document));
        }

        html.append("</div></body></html>");
        return html.toString();
    }

    private List<Page> collectPages(DocumentModel document) {
        List<Page> flattened = new ArrayList<>();
        if (document.getSections() == null) {
            return flattened;
        }

        for (Section section : document.getSections()) {
            if (section == null || section.getSubsections() == null) {
                continue;
            }
            for (Subsection subsection : section.getSubsections()) {
                if (subsection == null || subsection.getPages() == null) {
                    continue;
                }
                flattened.addAll(subsection.getPages());
            }
        }
        return flattened;
    }

    private String renderPage(Page page, DocumentModel document) {
        PageSize pageSize = Optional.ofNullable(document.getPageSize()).orElse(new PageSize());
        double baseWidth = Optional.ofNullable(pageSize.getWidthMm()).orElse(DEFAULT_WIDTH_MM);
        double baseHeight = Optional.ofNullable(pageSize.getHeightMm()).orElse(DEFAULT_HEIGHT_MM);
        int dpi = Optional.ofNullable(pageSize.getDpi()).orElse(DEFAULT_DPI);

        String orientation = Optional.ofNullable(page.getOrientation()).orElse("landscape").toLowerCase(Locale.ROOT);
        double pageWidth = orientation.equals("portrait") ? Math.min(baseWidth, baseHeight) : Math.max(baseWidth, baseHeight);
        double pageHeight = orientation.equals("portrait") ? Math.max(baseWidth, baseHeight) : Math.min(baseWidth, baseHeight);

        double widthPx = mmToPx(pageWidth, dpi);
        double heightPx = mmToPx(pageHeight, dpi);

        String pageName = "page-" + Optional.ofNullable(page.getId()).orElse(UUID.randomUUID().toString());

        StringBuilder builder = new StringBuilder();
        builder.append("<div class=\"page\" style=\"width: ")
                .append(widthPx)
                .append("px; height: ")
                .append(heightPx)
                .append("px; page-break-after: always; page: ")
                .append(pageName)
                .append(";\"><div class=\"page-surface\">");

        // Render logo if configured
        builder.append(renderLogo(document, widthPx, heightPx));

        // Render widgets
        if (page.getWidgets() != null) {
            for (Widget widget : page.getWidgets()) {
                builder.append(renderWidget(widget));
            }
        }

        // Render footer if configured
        builder.append(renderFooter(document, page, widthPx, heightPx));

        builder.append("</div></div>");
        return builder.toString();
    }

    private String renderWidget(Widget widget) {
        if (widget == null) {
            return "";
        }
        String type = Optional.ofNullable(widget.getType()).orElse("").toLowerCase(Locale.ROOT);
        String style = buildWidgetStyle(widget);
        JsonNode props = widget.getProps();

        return switch (type) {
            case "text" -> renderTextWidget(props, style);
            case "table" -> renderTableWidget(props, style);
            case "image" -> renderImageWidget(props, style);
            case "chart" -> renderChartWidget(props, style);
            default -> "<div class=\"widget\" style=\"" + style + "\"></div>";
        };
    }

    private String buildWidgetStyle(Widget widget) {
        StringBuilder style = new StringBuilder("position: absolute;");

        WidgetPosition position = Optional.ofNullable(widget.getPosition()).orElse(new WidgetPosition());
        WidgetSize size = Optional.ofNullable(widget.getSize()).orElse(new WidgetSize());

        style.append("left: ").append(Optional.ofNullable(position.getX()).orElse(0d)).append("px;");
        style.append("top: ").append(Optional.ofNullable(position.getY()).orElse(0d)).append("px;");
        style.append("width: ").append(Optional.ofNullable(size.getWidth()).orElse(0d)).append("px;");
        style.append("height: ").append(Optional.ofNullable(size.getHeight()).orElse(0d)).append("px;");

        JsonNode styleNode = widget.getStyle();
        if (styleNode != null && styleNode.isObject()) {
            Iterator<String> fields = styleNode.fieldNames();
            while (fields.hasNext()) {
                String key = fields.next();
                JsonNode value = styleNode.get(key);
                if (value != null && !value.isNull()) {
                    style.append(camelToKebab(key)).append(": ").append(value.asText()).append(";");
                }
            }
        }
        return style.toString();
    }

    private String renderTextWidget(JsonNode props, String style) {
        if (props == null) {
            return "<div class=\"widget widget-text\" style=\"" + style + "\"></div>";
        }
        
        JsonNode contentHtmlNode = props.path("contentHtml");
        String content = "";
        
        if (!contentHtmlNode.isMissingNode() && !contentHtmlNode.isNull()) {
            if (contentHtmlNode.isTextual()) {
                // Get HTML content directly - should already be properly formatted HTML
                content = contentHtmlNode.asText("");
            } else {
                // Fallback: convert to string if not text node
                content = contentHtmlNode.toString();
            }
        }
        
        // Ensure content is not empty or just whitespace - render empty paragraph
        if (content.trim().isEmpty()) {
            content = "<p></p>";
        }
        
        // Extract backgroundColor from props and add to style
        StringBuilder finalStyle = new StringBuilder(style);
        JsonNode backgroundColorNode = props.path("backgroundColor");
        if (!backgroundColorNode.isMissingNode() && !backgroundColorNode.isNull() && backgroundColorNode.isTextual()) {
            String backgroundColor = backgroundColorNode.asText("");
            if (!backgroundColor.isBlank() && !backgroundColor.equals("transparent")) {
                finalStyle.append("background-color: ").append(backgroundColor).append(";");
            }
        }
        
        return "<div class=\"widget widget-text\" style=\"" + finalStyle.toString() + "\">" + content + "</div>";
    }

    private String renderImageWidget(JsonNode props, String style) {
        if (props == null) {
            return "<div class=\"widget widget-image\" style=\"" + style + "\"></div>";
        }
        String url = props.path("url").asText("");
        String alt = props.path("alt").asText("");
        if (url.isBlank()) {
            return "<div class=\"widget widget-image\" style=\"" + style + "\"></div>";
        }
        return "<div class=\"widget widget-image\" style=\"" + style + "\"><img src=\"" + url + "\" alt=\"" + alt + "\" style=\"width: 100%; height: 100%; object-fit: contain;\" /></div>";
    }

    private String renderChartWidget(JsonNode props, String style) {
        if (props == null) {
            return "<div class=\"widget widget-chart\" style=\"" + style + "\"></div>";
        }
        String image = props.path("exportedImage").asText("");
        if (!image.isBlank()) {
            String chartType = props.path("chartType").asText("N/A");
            return "<div class=\"widget widget-chart\" style=\"" + style + "\"><img src=\"" + image + "\" alt=\"Chart: " + chartType + "\" style=\"width: 100%; height: 100%; object-fit: contain;\" /></div>";
        }
        String chartType = props.path("chartType").asText("N/A");
        return "<div class=\"widget widget-chart\" style=\"" + style + "\"><div class=\"chart-placeholder\">Chart: " + chartType + "</div></div>";
    }

    private String renderTableWidget(JsonNode props, String style) {
        if (props == null) {
            return "<div class=\"widget widget-table\" style=\"" + style + "\"></div>";
        }

        JsonNode columns = props.path("columns");
        JsonNode rows = props.path("rows");
        JsonNode styleSettings = props.path("styleSettings");

        StringBuilder html = new StringBuilder();
        html.append("<div class=\"widget widget-table\" style=\"").append(style).append("\">");
        html.append("<table class=\"table-adapter\" style=\"").append(getTableStyles(styleSettings)).append("\">");

        // Header is always created from column titles (not from first row)
        html.append("<thead><tr>");
        for (int i = 0; i < columns.size(); i++) {
            JsonNode column = columns.has(i) ? columns.get(i) : MissingNode.getInstance();
            html.append("<th style=\"")
                    .append(getHeaderCellStyles(column, styleSettings))
                    .append("\">")
                    .append(renderHeaderContent(column))
                    .append("</th>");
        }
        html.append("</tr></thead>");

        // All rows are data rows (first row is NOT the header)
        html.append("<tbody>");
        for (int rowIndex = 0; rowIndex < rows.size(); rowIndex++) {
            JsonNode row = rows.has(rowIndex) ? rows.get(rowIndex) : MissingNode.getInstance();
            JsonNode rowCells = row.path("cells");
            html.append("<tr>");
            for (int cellIndex = 0; cellIndex < rowCells.size(); cellIndex++) {
                JsonNode column = columns.size() > cellIndex && columns.has(cellIndex)
                        ? columns.get(cellIndex)
                        : MissingNode.getInstance();
                JsonNode cell = rowCells.has(cellIndex) ? rowCells.get(cellIndex) : MissingNode.getInstance();
                // All body cells are td (header is in thead)
                html.append("<td style=\"")
                        .append(getCellStyles(column, row, cellIndex, rowIndex, styleSettings))
                        .append("\">")
                        .append(renderCellContent(cell, column))
                        .append("</td>");
            }
            html.append("</tr>");
        }
        html.append("</tbody></table></div>");
        return html.toString();
    }

    private String getTableStyles(JsonNode styleSettings) {
        if (styleSettings == null || styleSettings.isMissingNode()) {
            return "";
        }
        StringBuilder styles = new StringBuilder();
        appendStyleIfPresent(styles, "background-color", styleSettings.path("backgroundColor"));
        appendStyleIfPresent(styles, "border-color", styleSettings.path("borderColor"));
        appendNumericStyle(styles, "border-width", styleSettings.path("borderWidth"), "px");
        appendStyleIfPresent(styles, "border-style", styleSettings.path("borderStyle"));
        appendStyleIfPresent(styles, "font-family", styleSettings.path("fontFamily"));
        appendNumericStyle(styles, "font-size", styleSettings.path("fontSize"), "px");
        appendStyleIfPresent(styles, "color", styleSettings.path("textColor"));
        return styles.toString();
    }

    private String getHeaderCellStyles(JsonNode column, JsonNode styleSettings) {
        StringBuilder styles = new StringBuilder();
        JsonNode headerStyle = styleSettings.path("headerStyle");
        
        // Background - Header border should NOT use column border settings
        // Priority: headerStyle.backgroundColor > headerBackgroundColor > default
        String background = coalesce(
                headerStyle.path("backgroundColor").asText(null),
                styleSettings.path("headerBackgroundColor").asText(null),
                "#f3f4f6"
        );
        styles.append("background-color: ").append(background).append(";");

        // Text color - Header should NOT use column textColor
        String textColor = coalesce(
                headerStyle.path("textColor").asText(null),
                styleSettings.path("headerTextColor").asText(null),
                "#111827"
        );
        styles.append("color: ").append(textColor).append(";");

        // Font - Header should NOT use column font settings
        appendStyleIfPresent(styles, "font-family", headerStyle.path("fontFamily"));
        appendNumericStyle(styles, "font-size", headerStyle.path("fontSize"), "px");
        appendStyleIfPresent(styles, "font-weight", headerStyle.path("fontWeight"));
        appendStyleIfPresent(styles, "font-style", headerStyle.path("fontStyle"));
        appendStyleIfPresent(styles, "text-align", headerStyle.path("textAlign"));
        appendStyleIfPresent(styles, "vertical-align", headerStyle.path("verticalAlign"));

        // Padding - Header padding should NOT use column padding
        int padding = (int) coalesceNode(headerStyle.path("padding"), styleSettings.path("cellPadding")).asInt(8);
        styles.append("padding: ").append(padding).append("px;");

        // Border - Header border should use headerBorderColor/headerBorderWidth, NOT column border
        // Priority: headerBorderColor/headerBorderWidth > headerStyle.borderColor/borderWidth > default
        String borderColor = coalesce(
                styleSettings.path("headerBorderColor").asText(null),
                headerStyle.path("borderColor").asText(null),
                "#e5e7eb"
        );
        styles.append("border-color: ").append(borderColor).append(";");
        
        int borderWidth = (int) coalesceNode(
                styleSettings.path("headerBorderWidth"),
                headerStyle.path("borderWidth")
        ).asInt(1);
        styles.append("border-width: ").append(borderWidth).append("px;");
        
        String borderStyle = coalesce(
                headerStyle.path("borderStyle").asText(null),
                styleSettings.path("borderStyle").asText(null),
                "solid"
        );
        styles.append("border-style: ").append(borderStyle).append(";");

        return styles.toString();
    }

    private String getCellStyles(JsonNode column, JsonNode row, int cellIndex, int rowIndex, JsonNode styleSettings) {
        StringBuilder styles = new StringBuilder();
        boolean alternateRow = styleSettings.path("alternateRowColor").isTextual() && rowIndex % 2 == 0;
        boolean alternateCol = styleSettings.path("alternateColumnColor").isTextual() && cellIndex % 2 == 1;

        String bgColor = coalesce(
                column.path("backgroundColor").asText(null),
                row.path("backgroundColor").asText(null)
        );
        if (bgColor == null && alternateRow) {
            bgColor = styleSettings.path("alternateRowColor").asText();
        }
        if (bgColor == null && alternateCol) {
            bgColor = styleSettings.path("alternateColumnColor").asText();
        }
        if (bgColor != null) {
            styles.append("background-color: ").append(bgColor).append(";");
        }

        appendStyleIfPresent(styles, "color", coalesceNode(column.path("textColor"), row.path("textColor"), styleSettings.path("bodyStyle").path("textColor"), styleSettings.path("textColor")));
        appendStyleIfPresent(styles, "font-family", coalesceNode(column.path("fontFamily"), row.path("fontFamily"), styleSettings.path("bodyStyle").path("fontFamily"), styleSettings.path("fontFamily")));
        appendNumericStyle(styles, "font-size", coalesceNode(column.path("fontSize"), row.path("fontSize"), styleSettings.path("bodyStyle").path("fontSize"), styleSettings.path("fontSize")), "px");
        appendStyleIfPresent(styles, "font-weight", coalesceNode(column.path("fontWeight"), row.path("fontWeight"), styleSettings.path("bodyStyle").path("fontWeight")));
        appendStyleIfPresent(styles, "text-align", column.path("align"));
        appendStyleIfPresent(styles, "vertical-align", coalesceNode(column.path("verticalAlign"), row.path("verticalAlign")));

        int padding = (int) coalesceNode(column.path("padding"), row.path("padding"), styleSettings.path("cellPadding")).asInt(8);
        styles.append("padding: ").append(padding).append("px;");

        appendStyleIfPresent(styles, "border-color", coalesceNode(column.path("borderColor"), row.path("borderColor")));
        appendNumericStyle(styles, "border-width", coalesceNode(column.path("borderWidth"), row.path("borderWidth")), "px");
        appendStyleIfPresent(styles, "border-style", coalesceNode(column.path("borderStyle"), row.path("borderStyle"), styleSettings.path("borderStyle")));

        return styles.toString();
    }

    private String renderHeaderContent(JsonNode column) {
        String title = column.path("title").asText("");
        JsonNode icon = column.path("icon");
        if (icon.isMissingNode() || icon.isNull()) {
            return title;
        }
        
        String position = icon.path("position").asText("before");
        int margin = icon.path("margin").asInt(6);
        String svg = icon.path("svg").asText("");
        String iconUrl = icon.path("url").asText("");
        int iconSize = icon.path("size").asInt(18);
        String iconColor = icon.path("color").asText("");
        String iconBgColor = icon.path("backgroundColor").asText("");
        int borderRadius = icon.path("borderRadius").asInt(0);
        int iconPadding = icon.path("padding").asInt(0);

        // Build icon HTML with proper styling
        StringBuilder iconHtml = new StringBuilder();
        boolean hasIcon = !svg.isEmpty() || !iconUrl.isEmpty();
        
        if (hasIcon) {
            iconHtml.append("<span style=\"display: inline-flex; align-items: center; justify-content: center;");
            iconHtml.append(" width: ").append(iconSize).append("px;");
            iconHtml.append(" height: ").append(iconSize).append("px;");
            if (!iconBgColor.isEmpty()) {
                iconHtml.append(" background-color: ").append(iconBgColor).append(";");
            }
            if (borderRadius > 0) {
                iconHtml.append(" border-radius: ").append(borderRadius).append("px;");
            }
            if (iconPadding > 0) {
                iconHtml.append(" padding: ").append(iconPadding).append("px;");
            }
            iconHtml.append("\">");
            
            if (!svg.isEmpty()) {
                // Apply color to SVG if specified
                String processedSvg = svg;
                if (!iconColor.isEmpty()) {
                    processedSvg = processedSvg.replaceAll("fill=\"[^\"]*\"", "fill=\"" + iconColor + "\"");
                    processedSvg = processedSvg.replaceAll("stroke=\"[^\"]*\"", "stroke=\"" + iconColor + "\"");
                    // Add fill/stroke if not present
                    if (!processedSvg.contains("fill=")) {
                        processedSvg = processedSvg.replaceFirst("<svg", "<svg fill=\"" + iconColor + "\"");
                    }
                }
                // Ensure SVG has proper size
                if (!processedSvg.contains("width=") && !processedSvg.contains("width=\"")) {
                    processedSvg = processedSvg.replaceFirst("<svg", "<svg width=\"" + iconSize + "\" height=\"" + iconSize + "\"");
                }
                iconHtml.append(processedSvg);
            } else if (!iconUrl.isEmpty()) {
                iconHtml.append("<img src=\"").append(iconUrl).append("\" style=\"width: 100%; height: 100%; object-fit: contain;\" />");
            }
            iconHtml.append("</span>");
        }

        if (!hasIcon || "only".equals(position)) {
            return hasIcon ? iconHtml.toString() : title;
        }

        // Build container with icon and text
        StringBuilder html = new StringBuilder();
        boolean isVertical = "above".equals(position) || "below".equals(position);
        html.append("<div style=\"display: flex; align-items: center;");
        if (isVertical) {
            html.append(" flex-direction: column;");
        } else {
            html.append(" flex-direction: row;");
        }
        html.append(" gap: ").append(margin).append("px;\">");
        
        if ("before".equals(position) || "above".equals(position)) {
            html.append(iconHtml);
            html.append("<span style=\"flex: 1;\">").append(title).append("</span>");
        } else {
            html.append("<span style=\"flex: 1;\">").append(title).append("</span>");
            html.append(iconHtml);
        }
        
        html.append("</div>");
        return html.toString();
    }

    private String renderCellContent(JsonNode cell, JsonNode column) {
        String cellType = column.path("cellType").asText("text");
        
        // Handle icon cell type
        if ("icon".equals(cellType)) {
            JsonNode icon = column.path("icon");
            if (!icon.isMissingNode() && !icon.isNull()) {
                String svg = icon.path("svg").asText("");
                String iconUrl = icon.path("url").asText("");
                int iconSize = icon.path("size").asInt(20);
                
                if (!svg.isEmpty()) {
                    // Apply icon color if specified
                    String iconColor = icon.path("color").asText("");
                    String processedSvg = svg;
                    if (!iconColor.isEmpty()) {
                        processedSvg = processedSvg.replaceAll("fill=\"[^\"]*\"", "fill=\"" + iconColor + "\"");
                        processedSvg = processedSvg.replaceAll("stroke=\"[^\"]*\"", "stroke=\"" + iconColor + "\"");
                        if (!processedSvg.contains("fill=")) {
                            processedSvg = processedSvg.replaceFirst("<svg", "<svg fill=\"" + iconColor + "\"");
                        }
                    }
                    // Ensure SVG has proper size
                    if (!processedSvg.contains("width=") && !processedSvg.contains("width=\"")) {
                        processedSvg = processedSvg.replaceFirst("<svg", "<svg width=\"" + iconSize + "\" height=\"" + iconSize + "\"");
                    }
                    return "<span style=\"display: inline-flex; align-items: center; justify-content: center; width: " + iconSize + "px; height: " + iconSize + "px;\">" + processedSvg + "</span>";
                } else if (!iconUrl.isEmpty()) {
                    return "<img src=\"" + iconUrl + "\" style=\"max-width: 100%; max-height: 100%; object-fit: contain; width: " + iconSize + "px; height: " + iconSize + "px;\" />";
                }
            }
            // Fallback to cell value if icon not available
        }
        
        // Handle currency cell type
        if ("currency".equals(cellType)) {
            if (cell != null && !cell.isNull() && cell.isNumber()) {
                double value = cell.asDouble();
                return String.format("$%.2f", value);
            }
        }
        
        // Handle number cell type
        if ("number".equals(cellType)) {
            if (cell != null && !cell.isNull() && cell.isNumber()) {
                return String.format("%,.0f", cell.asDouble());
            }
        }
        
        // Default: text cell
        if (cell == null || cell.isNull()) {
            return "";
        }
        if (cell.isTextual()) {
            return cell.asText("");
        }
        if (cell.isNumber()) {
            return cell.numberValue().toString();
        }
        return cell.toString();
    }

    private String getGlobalStyles() {
        return """
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: #f5f5f5; padding: 20px; }
                .document-container { background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin: 0 auto; }
                .page { background: white; margin: 0 auto 20px; position: relative; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
                .page-surface { width: 100%; height: 100%; position: relative; }
                .widget { position: absolute; overflow: hidden; }
                .widget-text { word-wrap: break-word; overflow-wrap: break-word; }
                
                /* Rich text formatting styles */
                .widget-text h1, .widget-text h2, .widget-text h3, .widget-text h4, .widget-text h5, .widget-text h6 {
                    margin: 0.5em 0; font-weight: 600; line-height: 1.2;
                }
                .widget-text h1 { font-size: 2em; }
                .widget-text h2 { font-size: 1.75em; }
                .widget-text h3 { font-size: 1.5em; }
                .widget-text h4 { font-size: 1.25em; }
                .widget-text h5 { font-size: 1.1em; }
                .widget-text h6 { font-size: 1em; }
                
                .widget-text p { margin: 0.5em 0; line-height: 1.5; }
                .widget-text p:first-child { margin-top: 0; }
                .widget-text p:last-child { margin-bottom: 0; }
                
                /* List styles - Bulleted lists */
                .widget-text ul, .widget-text ol {
                    margin: 0.5em 0; padding-left: 2em; line-height: 1.5;
                }
                .widget-text ul { list-style-type: disc; }
                .widget-text ul ul { list-style-type: circle; margin-top: 0.25em; }
                .widget-text ul ul ul { list-style-type: square; }
                
                /* Numbered lists */
                .widget-text ol { list-style-type: decimal; }
                .widget-text ol ol { list-style-type: lower-alpha; margin-top: 0.25em; }
                .widget-text ol ol ol { list-style-type: lower-roman; }
                
                .widget-text li {
                    margin: 0.25em 0; padding-left: 0.25em;
                }
                .widget-text li::marker { color: inherit; }
                
                /* Nested lists */
                .widget-text li ul, .widget-text li ol {
                    margin-top: 0.25em; margin-bottom: 0.25em;
                }
                
                /* Text formatting */
                .widget-text strong, .widget-text b { font-weight: 700; }
                .widget-text em, .widget-text i { font-style: italic; }
                .widget-text u { text-decoration: underline; }
                .widget-text s, .widget-text strike { text-decoration: line-through; }
                
                /* Links */
                .widget-text a {
                    color: #2563eb; text-decoration: underline; cursor: pointer;
                }
                .widget-text a:hover { color: #1d4ed8; }
                
                /* Alignment */
                .widget-text [style*="text-align: left"] { text-align: left; }
                .widget-text [style*="text-align: center"] { text-align: center; }
                .widget-text [style*="text-align: right"] { text-align: right; }
                .widget-text [style*="text-align: justify"] { text-align: justify; }
                
                /* Embedded tables in text widgets */
                /* Default styles - inline styles will override these */
                .widget-text table {
                    width: 100%; border-collapse: collapse; margin: 0.5em 0;
                    border: 1px solid #e5e7eb; font-size: inherit;
                }
                .widget-text table th,
                .widget-text table td {
                    padding: 8px 12px; border: 1px solid #e5e7eb;
                    vertical-align: top; text-align: left;
                }
                .widget-text table th {
                    background-color: #f3f4f6; font-weight: 600;
                }
                .widget-text table tbody tr:nth-child(even) {
                    background-color: #f9fafb;
                }
                .widget-text table tbody tr:hover {
                    background-color: #f3f4f6;
                }
                /* Ensure inline styles from pasted content (e.g., PowerPoint) take precedence */
                .widget-text table[style] {
                    /* Inline styles will override defaults */
                }
                .widget-text table th[style],
                .widget-text table td[style] {
                    /* Inline styles will override defaults */
                }
                
                /* Table alignment within text */
                .widget-text table[style*="margin-left"] { margin-left: auto; }
                .widget-text table[style*="margin-right"] { margin-right: auto; }
                .widget-text table[style*="margin: 0 auto"] { margin-left: auto; margin-right: auto; }
                
                /* Blockquote */
                .widget-text blockquote {
                    margin: 0.5em 0; padding-left: 1em; border-left: 4px solid #e5e7eb;
                    font-style: italic; color: #6b7280;
                }
                
                /* Code blocks */
                .widget-text code {
                    background-color: #f3f4f6; padding: 2px 4px; border-radius: 3px;
                    font-family: 'Courier New', Courier, monospace; font-size: 0.9em;
                }
                .widget-text pre {
                    background-color: #f3f4f6; padding: 0.75em; border-radius: 4px;
                    overflow-x: auto; margin: 0.5em 0;
                }
                .widget-text pre code {
                    background-color: transparent; padding: 0;
                }
                
                /* Horizontal rule */
                .widget-text hr {
                    border: none; border-top: 1px solid #e5e7eb; margin: 1em 0;
                }
                
                /* Table widget styles */
                .table-adapter { width: 100%; height: 100%; border-collapse: collapse; font-size: 14px; }
                .table-adapter th, .table-adapter td { padding: 8px; border: 1px solid #e5e7eb; vertical-align: middle; }
                .table-adapter th { background-color: #f3f4f6; font-weight: 600; text-align: left; }
                .table-adapter tbody tr:nth-child(even) { background-color: #f9fafb; }
                
                /* Icon rendering in tables */
                .table-adapter th svg, .table-adapter td svg {
                    display: inline-block;
                    vertical-align: middle;
                    max-width: 100%;
                    max-height: 100%;
                }
                .table-adapter th img, .table-adapter td img {
                    display: inline-block;
                    vertical-align: middle;
                    max-width: 100%;
                    max-height: 100%;
                    object-fit: contain;
                }
                .table-adapter th span[style*="display: flex"], .table-adapter td span[style*="display: flex"] {
                    display: flex !important;
                }
                
                .chart-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #f3f4f6; color: #6b7280; font-size: 14px; }
                
                @media print {
                    body { background: white; padding: 0; }
                    .page { margin: 0; box-shadow: none; page-break-after: always; }
                    .page:last-child { page-break-after: auto; }
                    .widget-text ul, .widget-text ol { page-break-inside: avoid; }
                    .widget-text table { page-break-inside: avoid; }
                }
                """;
    }

    private String getPageStyles(List<Page> pages, DocumentModel document) {
        PageSize pageSize = Optional.ofNullable(document.getPageSize()).orElse(new PageSize());
        double baseWidth = Optional.ofNullable(pageSize.getWidthMm()).orElse(DEFAULT_WIDTH_MM);
        double baseHeight = Optional.ofNullable(pageSize.getHeightMm()).orElse(DEFAULT_HEIGHT_MM);

        StringBuilder css = new StringBuilder();
        for (Page page : pages) {
            String orientation = Optional.ofNullable(page.getOrientation()).orElse("landscape").toLowerCase(Locale.ROOT);
            double pageWidth = orientation.equals("portrait") ? Math.min(baseWidth, baseHeight) : Math.max(baseWidth, baseHeight);
            double pageHeight = orientation.equals("portrait") ? Math.max(baseWidth, baseHeight) : Math.min(baseWidth, baseHeight);
            String pageName = "page-" + Optional.ofNullable(page.getId()).orElse(UUID.randomUUID().toString());

            css.append("@page ").append(pageName).append(" { size: ")
                    .append(pageWidth).append("mm ")
                    .append(pageHeight).append("mm; margin: 0; }\n");
        }
        return css.toString();
    }

    private double mmToPx(double mm, int dpi) {
        return (mm / 25.4d) * dpi;
    }

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

    private void appendStyleIfPresent(StringBuilder builder, String property, String value) {
        if (builder != null && property != null && value != null && !value.isBlank()) {
            builder.append(property).append(": ").append(value).append(";");
        }
    }

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

    private JsonNode chooseFirst(JsonNode... nodes) {
        for (JsonNode node : nodes) {
            if (node != null && !node.isMissingNode() && !node.isNull()) {
                return node;
            }
        }
        return MissingNode.getInstance();
    }

    private String coalesce(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private JsonNode coalesceNode(JsonNode... nodes) {
        for (JsonNode node : nodes) {
            if (node != null && !node.isMissingNode() && !node.isNull()) {
                return node;
            }
        }
        return MissingNode.getInstance();
    }

    private String camelToKebab(String input) {
        if (input == null) {
            return "";
        }
        return input.replaceAll("([a-z])([A-Z]+)", "$1-$2").toLowerCase(Locale.ROOT);
    }

    private String renderLogo(DocumentModel document, double pageWidth, double pageHeight) {
        LogoConfig logo = document.getLogo();
        if (logo == null || logo.getUrl() == null || logo.getUrl().isBlank()) {
            return "";
        }

        String position = Optional.ofNullable(logo.getPosition()).orElse("top-right").toLowerCase(Locale.ROOT);
        String style = "position: absolute; z-index: 1000; padding: 12px 16px; pointer-events: none;";

        switch (position) {
            case "top-left":
                style += "top: 0; left: 0;";
                break;
            case "top-right":
                style += "top: 0; right: 0; display: flex; align-items: center; justify-content: flex-end;";
                break;
            case "bottom-left":
                style += "bottom: 0; left: 0;";
                break;
            case "bottom-right":
                style += "bottom: 0; right: 0; display: flex; align-items: center; justify-content: flex-end;";
                break;
            default:
                style += "top: 0; right: 0; display: flex; align-items: center; justify-content: flex-end;";
        }

        return "<div class=\"page-logo\" style=\"" + style + "\">" +
                "<img src=\"" + logo.getUrl() + "\" alt=\"Logo\" style=\"max-height: 40px; max-width: 120px; object-fit: contain; display: block;\" />" +
                "</div>";
    }

    private String renderFooter(DocumentModel document, Page page, double pageWidth, double pageHeight) {
        FooterConfig footer = document.getFooter();
        if (footer == null) {
            return "";
        }

        boolean hasContent = (footer.getLeftText() != null && !footer.getLeftText().isBlank()) ||
                            (footer.getCenterText() != null && !footer.getCenterText().isBlank()) ||
                            (footer.getCenterSubText() != null && !footer.getCenterSubText().isBlank()) ||
                            (footer.getShowPageNumber() != null && footer.getShowPageNumber());

        if (!hasContent) {
            return "";
        }

        StringBuilder footerHtml = new StringBuilder();
        footerHtml.append("<div class=\"page-footer\" style=\"position: absolute; bottom: 0; left: 0; right: 0; z-index: 1000; display: flex; justify-content: space-between; align-items: flex-end; padding: 4px 20px; pointer-events: none; background: rgba(255, 255, 255, 0.95);\">");

        // Left text
        footerHtml.append("<div class=\"page-footer-left\" style=\"font-size: 12px; color: #1e40af; font-weight: 500; flex: 1; text-align: left; line-height: 1.2; padding-bottom: 2px;\">");
        if (footer.getLeftText() != null && !footer.getLeftText().isBlank()) {
            footerHtml.append(footer.getLeftText());
        }
        footerHtml.append("</div>");

        // Center text
        footerHtml.append("<div class=\"page-footer-center\" style=\"font-size: 12px; color: #374151; font-weight: 500; flex: 1; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 1px; padding-bottom: 2px;\">");
        if (footer.getCenterText() != null && !footer.getCenterText().isBlank()) {
            footerHtml.append("<div style=\"line-height: 1.2;\">").append(footer.getCenterText()).append("</div>");
        }
        if (footer.getCenterSubText() != null && !footer.getCenterSubText().isBlank()) {
            footerHtml.append("<div style=\"line-height: 1.2;\">").append(footer.getCenterSubText()).append("</div>");
        }
        footerHtml.append("</div>");

        // Right - Page number
        footerHtml.append("<div class=\"page-footer-right\" style=\"font-size: 12px; color: #374151; font-weight: 500; flex: 1; text-align: right; line-height: 1.2; padding-bottom: 2px;\">");
        if (footer.getShowPageNumber() != null && footer.getShowPageNumber() && page.getNumber() != null) {
            footerHtml.append(page.getNumber());
        }
        footerHtml.append("</div>");

        footerHtml.append("</div>");
        return footerHtml.toString();
    }
}

