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
import com.org.report_generator.service.renderer.GlobalStylesRenderer;
import com.org.report_generator.service.renderer.PageStylesRenderer;
import com.org.report_generator.service.renderer.TextWidgetRenderer;
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
    
    private final TextWidgetRenderer textWidgetRenderer = new TextWidgetRenderer();

    public String render(DocumentModel document) {
        List<Page> pages = collectPages(document);
        StringBuilder html = new StringBuilder();

        html.append("<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">");
        html.append("<title>").append(Optional.ofNullable(document.getTitle()).orElse("Document")).append("</title>");
        html.append("<style>")
                .append(GlobalStylesRenderer.getCss())
                .append(TextWidgetRenderer.getCss())
                .append(PageStylesRenderer.getCss(pages, document))
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

        int pageNumber = 1;
        for (Section section : document.getSections()) {
            if (section == null || section.getSubsections() == null) {
                continue;
            }
            for (Subsection subsection : section.getSubsections()) {
                if (subsection == null || subsection.getPages() == null) {
                    continue;
                }
                for (Page page : subsection.getPages()) {
                    page.setNumber(pageNumber++);
                    flattened.add(page);
                }
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
                .append(";\"><div class=\"page__surface\">");

        builder.append(renderLogo(document, widthPx, heightPx));

        if (page.getWidgets() != null) {
            for (Widget widget : page.getWidgets()) {
                builder.append(renderWidget(widget));
            }
        }

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
            case "text" -> textWidgetRenderer.render(props, style);
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


    private String renderImageWidget(JsonNode props, String style) {
        if (props == null) {
            return "<div class=\"widget widget-image\" style=\"" + style + "\"></div>";
        }
        String url = props.path("src").asText("");
        if (url.isBlank()) {
            url = props.path("url").asText("");
        }
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

        String background = coalesce(
                headerStyle.path("backgroundColor").asText(null),
                styleSettings.path("headerBackgroundColor").asText(null),
                "#f3f4f6"
        );
        styles.append("background-color: ").append(background).append(";");

        String textColor = coalesce(
                headerStyle.path("textColor").asText(null),
                styleSettings.path("headerTextColor").asText(null),
                "#111827"
        );
        styles.append("color: ").append(textColor).append(";");

        appendStyleIfPresent(styles, "font-family", headerStyle.path("fontFamily"));
        appendNumericStyle(styles, "font-size", headerStyle.path("fontSize"), "px");
        appendStyleIfPresent(styles, "font-weight", headerStyle.path("fontWeight"));
        appendStyleIfPresent(styles, "font-style", headerStyle.path("fontStyle"));
        appendStyleIfPresent(styles, "text-align", headerStyle.path("textAlign"));
        appendStyleIfPresent(styles, "vertical-align", headerStyle.path("verticalAlign"));

        int padding = (int) coalesceNode(headerStyle.path("padding"), styleSettings.path("cellPadding")).asInt(8);
        styles.append("padding: ").append(padding).append("px;");

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

        if ("icon".equals(cellType)) {
            JsonNode icon = column.path("icon");
            if (!icon.isMissingNode() && !icon.isNull()) {
                String svg = icon.path("svg").asText("");
                String iconUrl = icon.path("url").asText("");
                int iconSize = icon.path("size").asInt(20);
                
                if (!svg.isEmpty()) {
                    String iconColor = icon.path("color").asText("");
                    String processedSvg = svg;
                    if (!iconColor.isEmpty()) {
                    processedSvg = processedSvg.replaceAll("fill=\"[^\"]*\"", "fill=\"" + iconColor + "\"");
                    processedSvg = processedSvg.replaceAll("stroke=\"[^\"]*\"", "stroke=\"" + iconColor + "\"");
                    if (!processedSvg.contains("fill=")) {
                        processedSvg = processedSvg.replaceFirst("<svg", "<svg fill=\"" + iconColor + "\"");
                    }
                }
                if (!processedSvg.contains("width=") && !processedSvg.contains("width=\"")) {
                        processedSvg = processedSvg.replaceFirst("<svg", "<svg width=\"" + iconSize + "\" height=\"" + iconSize + "\"");
                    }
                    return "<span style=\"display: inline-flex; align-items: center; justify-content: center; width: " + iconSize + "px; height: " + iconSize + "px;\">" + processedSvg + "</span>";
                } else if (!iconUrl.isEmpty()) {
                    return "<img src=\"" + iconUrl + "\" style=\"max-width: 100%; max-height: 100%; object-fit: contain; width: " + iconSize + "px; height: " + iconSize + "px;\" />";
                }
            }
        }

        if ("currency".equals(cellType)) {
            if (cell != null && !cell.isNull()) {
                double value;
                if (cell.isNumber()) {
                    value = cell.asDouble();
                } else if (cell.isTextual()) {
                    try {
                        value = Double.parseDouble(cell.asText("0"));
                    } catch (NumberFormatException e) {
                        value = 0.0;
                    }
                } else {
                    value = 0.0;
                }
                return String.format("$%.2f", value);
            }
        }

        if ("number".equals(cellType)) {
            if (cell != null && !cell.isNull()) {
                double value;
                if (cell.isNumber()) {
                    value = cell.asDouble();
                } else if (cell.isTextual()) {
                    try {
                        value = Double.parseDouble(cell.asText("0"));
                    } catch (NumberFormatException e) {
                        value = 0.0;
                    }
                } else {
                    value = 0.0;
                }
                return String.format("%,.0f", value);
            }
        }

        if (cell == null || cell.isNull()) {
            return "";
        }
        String cellText;
        if (cell.isTextual()) {
            cellText = cell.asText("");
        } else if (cell.isNumber()) {
            cellText = cell.numberValue().toString();
        } else {
            cellText = cell.toString();
        }
        return escapeHtml(cellText);
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

    private String escapeHtml(String input) {
        if (input == null) {
            return "";
        }
        return input.replace("&", "&amp;")
                    .replace("<", "&lt;")
                    .replace(">", "&gt;")
                    .replace("\"", "&quot;")
                    .replace("'", "&#39;");
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

        return "<div class=\"page__logo-placeholder\" style=\"" + style + "\">" +
                "<img src=\"" + logo.getUrl() + "\" alt=\"Logo\" class=\"page__logo-image\" />" +
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
        footerHtml.append("<div class=\"page__footer\">");

        footerHtml.append("<div class=\"page__footer-left\">");
        if (footer.getLeftText() != null && !footer.getLeftText().isBlank()) {
            footerHtml.append(footer.getLeftText());
        }
        footerHtml.append("</div>");

        footerHtml.append("<div class=\"page__footer-center\">");
        if (footer.getCenterText() != null && !footer.getCenterText().isBlank()) {
            footerHtml.append("<div class=\"page__footer-center-line\">").append(footer.getCenterText()).append("</div>");
        }
        if (footer.getCenterSubText() != null && !footer.getCenterSubText().isBlank()) {
            footerHtml.append("<div class=\"page__footer-center-line\">").append(footer.getCenterSubText()).append("</div>");
        }
        footerHtml.append("</div>");

        footerHtml.append("<div class=\"page__footer-right\">");
        if (footer.getShowPageNumber() != null && footer.getShowPageNumber() && page.getNumber() != null) {
            footerHtml.append(page.getNumber());
        }
        footerHtml.append("</div>");

        footerHtml.append("</div>");
        return footerHtml.toString();
    }
}

