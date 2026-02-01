package com.org.report_generator.render.docx.service;

import com.fasterxml.jackson.databind.JsonNode;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableCell;
import org.apache.poi.xwpf.usermodel.XWPFTableRow;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.*;
import org.springframework.stereotype.Service;

import java.math.BigInteger;

@Service
public class DocxTableGenerationService {

    private final HtmlToDocxConverter htmlConverter;

    public DocxTableGenerationService(HtmlToDocxConverter htmlConverter) {
        this.htmlConverter = htmlConverter;
    }

    /**
     * Generates a table in the given XWPFTable object based on the properties.
     * @param table The POI table object to populate
     * @param props The widget properties containing rows and styling info
     */
    public void generateTable(XWPFTable table, JsonNode props) {
        if (props == null || !props.has("rows")) return;
        
        JsonNode rows = props.get("rows");
        if (!rows.isArray()) return;

        // Apply table-level styling (borders, width)
        applyTableStyle(table, props);
        
        // Remove the default empty row created by createTable() if necessary
        boolean firstRow = true;

        for (JsonNode rowNode : rows) {
            XWPFTableRow row;
            if (firstRow) {
                row = table.getRow(0);
                firstRow = false;
            } else {
                row = table.createRow();
            }
            
            // Apply row height if specified
            if (rowNode.has("height")) {
                int heightPx = rowNode.get("height").asInt(0);
                if (heightPx > 0) {
                    row.setHeight((int) (heightPx * 15)); // Convert px to twips
                }
            }
            
            if (rowNode.has("cells") && rowNode.get("cells").isArray()) {
                JsonNode cells = rowNode.get("cells");
                int cellIndex = 0;
                for (JsonNode cellNode : cells) {
                    XWPFTableCell cell;
                    if (cellIndex < row.getTableCells().size()) {
                        cell = row.getCell(cellIndex);
                    } else {
                        cell = row.createCell();
                    }

                    // Clear default paragraph
                    if (cell.getParagraphs() != null && !cell.getParagraphs().isEmpty()) {
                        int count = cell.getParagraphs().size();
                        for (int i = count - 1; i >= 0; i--) {
                            cell.removeParagraph(i);
                        }
                    }

                    // Apply cell styling (background, borders, width)
                    applyCellStyle(cell, cellNode, props);

                    if (cellNode.has("contentHtml")) {
                        String html = cellNode.get("contentHtml").asText();
                        htmlConverter.appendHtmlToCell(cell, html);
                    } else if (cellNode.has("text")) {
                        cell.setText(cellNode.get("text").asText());
                    }
                    cellIndex++;
                }
            }
        }
    }

    /**
     * Apply table-level styling including borders and width.
     */
    private void applyTableStyle(XWPFTable table, JsonNode props) {
        CTTbl ctTbl = table.getCTTbl();
        CTTblPr tblPr = ctTbl.getTblPr();
        if (tblPr == null) {
            tblPr = ctTbl.addNewTblPr();
        }

        // Table borders from props
        String borderColor = "000000";
        int borderWidth = 1;
        String borderStyle = "single";

        if (props.has("border")) {
            JsonNode border = props.get("border");
            borderColor = normalizeColor(border.path("color").asText("#000000"));
            borderWidth = border.path("width").asInt(1);
            borderStyle = border.path("style").asText("solid");
        }

        // Apply table borders
        CTTblBorders borders = tblPr.isSetTblBorders() ? tblPr.getTblBorders() : tblPr.addNewTblBorders();
        int sz = Math.max(1, borderWidth) * 8; // Convert to eighths of a point
        STBorder.Enum stBorder = mapBorderStyle(borderStyle);

        setTableBorder(borders.addNewTop(), sz, borderColor, stBorder);
        setTableBorder(borders.addNewBottom(), sz, borderColor, stBorder);
        setTableBorder(borders.addNewLeft(), sz, borderColor, stBorder);
        setTableBorder(borders.addNewRight(), sz, borderColor, stBorder);
        setTableBorder(borders.addNewInsideH(), sz, borderColor, stBorder);
        setTableBorder(borders.addNewInsideV(), sz, borderColor, stBorder);

        // Table width - try to set from widget size
        if (props.has("tableWidth")) {
            int widthPx = props.get("tableWidth").asInt(0);
            if (widthPx > 0) {
                CTTblWidth tblW = tblPr.isSetTblW() ? tblPr.getTblW() : tblPr.addNewTblW();
                tblW.setW(BigInteger.valueOf(widthPx * 15L)); // twips
                tblW.setType(STTblWidth.DXA);
            }
        }
    }

    /**
     * Apply cell-level styling including background color, borders, and width.
     */
    private void applyCellStyle(XWPFTableCell cell, JsonNode cellNode, JsonNode tableProps) {
        CTTc ctTc = cell.getCTTc();
        CTTcPr tcPr = ctTc.isSetTcPr() ? ctTc.getTcPr() : ctTc.addNewTcPr();

        // Background color
        String bgColor = cellNode.path("backgroundColor").asText(null);
        if (bgColor == null) {
            bgColor = cellNode.path("background").asText(null);
        }
        if (bgColor != null && !bgColor.isEmpty() && !"transparent".equalsIgnoreCase(bgColor)) {
            String normalizedBg = normalizeColor(bgColor);
            if (normalizedBg != null) {
                CTShd shd = tcPr.isSetShd() ? tcPr.getShd() : tcPr.addNewShd();
                shd.setVal(STShd.CLEAR);
                shd.setFill(normalizedBg);
            }
        }

        // Cell width
        if (cellNode.has("width")) {
            int widthPx = cellNode.get("width").asInt(0);
            if (widthPx > 0) {
                CTTblWidth tcW = tcPr.isSetTcW() ? tcPr.getTcW() : tcPr.addNewTcW();
                tcW.setW(BigInteger.valueOf(widthPx * 15L)); // twips
                tcW.setType(STTblWidth.DXA);
            }
        }

        // Cell borders (override table borders if specified)
        if (cellNode.has("border")) {
            JsonNode border = cellNode.get("border");
            String borderColor = normalizeColor(border.path("color").asText("#000000"));
            int borderWidth = border.path("width").asInt(1);
            String borderStyle = border.path("style").asText("solid");

            CTTcBorders tcBorders = tcPr.isSetTcBorders() ? tcPr.getTcBorders() : tcPr.addNewTcBorders();
            int sz = Math.max(1, borderWidth) * 8;
            STBorder.Enum stBorder = mapBorderStyle(borderStyle);

            setCellBorder(tcBorders.addNewTop(), sz, borderColor, stBorder);
            setCellBorder(tcBorders.addNewBottom(), sz, borderColor, stBorder);
            setCellBorder(tcBorders.addNewLeft(), sz, borderColor, stBorder);
            setCellBorder(tcBorders.addNewRight(), sz, borderColor, stBorder);
        }

        // Vertical alignment
        String vAlign = cellNode.path("verticalAlign").asText(null);
        if (vAlign != null) {
            switch (vAlign.toLowerCase()) {
                case "top" -> cell.setVerticalAlignment(XWPFTableCell.XWPFVertAlign.TOP);
                case "middle", "center" -> cell.setVerticalAlignment(XWPFTableCell.XWPFVertAlign.CENTER);
                case "bottom" -> cell.setVerticalAlignment(XWPFTableCell.XWPFVertAlign.BOTTOM);
            }
        }

        // Cell padding/margins
        if (cellNode.has("padding")) {
            int padding = cellNode.get("padding").asInt(0);
            if (padding > 0) {
                int paddingTwips = padding * 15;
                CTTcMar margins = tcPr.isSetTcMar() ? tcPr.getTcMar() : tcPr.addNewTcMar();
                
                CTTblWidth top = margins.isSetTop() ? margins.getTop() : margins.addNewTop();
                top.setW(BigInteger.valueOf(paddingTwips));
                top.setType(STTblWidth.DXA);
                
                CTTblWidth bottom = margins.isSetBottom() ? margins.getBottom() : margins.addNewBottom();
                bottom.setW(BigInteger.valueOf(paddingTwips));
                bottom.setType(STTblWidth.DXA);
                
                CTTblWidth left = margins.isSetLeft() ? margins.getLeft() : margins.addNewLeft();
                left.setW(BigInteger.valueOf(paddingTwips));
                left.setType(STTblWidth.DXA);
                
                CTTblWidth right = margins.isSetRight() ? margins.getRight() : margins.addNewRight();
                right.setW(BigInteger.valueOf(paddingTwips));
                right.setType(STTblWidth.DXA);
            }
        }
    }

    private void setTableBorder(CTBorder border, int size, String color, STBorder.Enum style) {
        border.setVal(style);
        border.setSz(BigInteger.valueOf(size));
        border.setColor(color);
        border.setSpace(BigInteger.ZERO);
    }

    private void setCellBorder(CTBorder border, int size, String color, STBorder.Enum style) {
        border.setVal(style);
        border.setSz(BigInteger.valueOf(size));
        border.setColor(color);
    }

    private STBorder.Enum mapBorderStyle(String style) {
        if (style == null) return STBorder.SINGLE;
        return switch (style.toLowerCase()) {
            case "dashed" -> STBorder.DASHED;
            case "dotted" -> STBorder.DOTTED;
            case "double" -> STBorder.DOUBLE;
            case "none", "hidden" -> STBorder.NIL;
            default -> STBorder.SINGLE;
        };
    }

    /**
     * Normalize color to 6-char hex without #
     */
    private String normalizeColor(String color) {
        if (color == null || color.isBlank()) return null;
        String c = color.trim().toLowerCase();
        
        // Handle hex format
        if (c.startsWith("#")) {
            String hex = c.substring(1);
            if (hex.length() == 3) {
                return "" + hex.charAt(0) + hex.charAt(0) 
                     + hex.charAt(1) + hex.charAt(1) 
                     + hex.charAt(2) + hex.charAt(2);
            }
            if (hex.length() >= 6) {
                return hex.substring(0, 6).toUpperCase();
            }
        }
        
        // Handle rgb/rgba
        if (c.startsWith("rgb")) {
            try {
                int start = c.indexOf('(');
                int end = c.indexOf(')');
                if (start >= 0 && end > start) {
                    String inside = c.substring(start + 1, end);
                    String[] parts = inside.split(",");
                    if (parts.length >= 3) {
                        int r = Integer.parseInt(parts[0].trim());
                        int g = Integer.parseInt(parts[1].trim());
                        int b = Integer.parseInt(parts[2].trim());
                        r = Math.max(0, Math.min(255, r));
                        g = Math.max(0, Math.min(255, g));
                        b = Math.max(0, Math.min(255, b));
                        return String.format("%02X%02X%02X", r, g, b);
                    }
                }
            } catch (Exception ignored) {}
        }
        
        // Named colors
        return switch (c) {
            case "black" -> "000000";
            case "white" -> "FFFFFF";
            case "red" -> "FF0000";
            case "green" -> "00FF00";
            case "blue" -> "0000FF";
            case "yellow" -> "FFFF00";
            case "transparent", "none" -> null;
            default -> {
                if (c.matches("[0-9a-f]{6}")) {
                    yield c.toUpperCase();
                }
                yield null;
            }
        };
    }
}
