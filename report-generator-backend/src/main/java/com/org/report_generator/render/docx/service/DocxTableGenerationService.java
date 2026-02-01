package com.org.report_generator.render.docx.service;

import com.fasterxml.jackson.databind.JsonNode;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableCell;
import org.apache.poi.xwpf.usermodel.XWPFTableRow;
import org.springframework.stereotype.Service;

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
        
        // Remove the default empty row created by createTable() if necessary
        // or just use it for the first row. XWPFTable creates one row by default.
        boolean firstRow = true;

        for (JsonNode rowNode : rows) {
            XWPFTableRow row;
            if (firstRow) {
                row = table.getRow(0);
                firstRow = false;
            } else {
                row = table.createRow();
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
}
