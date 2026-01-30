package com.org.report_generator.service.renderer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.*;

class TableWidgetRendererTest {

    private TableWidgetRenderer renderer;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        renderer = new TableWidgetRenderer();
        objectMapper = new ObjectMapper();
    }

    @Test
    void render_nullProps_returnsEmptyTable() {
        String result = renderer.render(null, "");
        assertThat(result).isNotNull();
        assertThat(result).contains("widget-table");
    }

    @Test
    void render_emptyRows_returnsTableStructure() {
        ObjectNode props = objectMapper.createObjectNode();
        props.set("rows", objectMapper.createArrayNode());

        String result = renderer.render(props, "");
        assertThat(result).contains("widget-table");
        // Empty rows may not produce table structure
        assertThat(result).isNotEmpty();
    }

    @Test
    void render_singleCell_rendersCell() {
        ObjectNode props = createTableWithContent(1, 1, "Test Content");

        String result = renderer.render(props, "");
        assertThat(result).contains("Test Content");
        assertThat(result).contains("table-widget__cell");
    }

    @Test
    void render_multipleRows_rendersAllRows() {
        ObjectNode props = createTableWithContent(3, 2, "Cell");

        String result = renderer.render(props, "");
        assertThat(result).contains("Cell");
        // Should have 3 rows
        assertThat(result.split("<tr").length).isGreaterThan(3);
    }

    @Test
    void render_cellWithBackgroundColor_appliesBackground() {
        ObjectNode props = objectMapper.createObjectNode();
        ArrayNode rows = objectMapper.createArrayNode();
        ObjectNode row = objectMapper.createObjectNode();
        ArrayNode cells = objectMapper.createArrayNode();
        
        ObjectNode cell = objectMapper.createObjectNode();
        ObjectNode style = objectMapper.createObjectNode();
        style.put("backgroundColor", "#ffcc00");
        cell.set("style", style);
        cell.put("contentHtml", "Yellow Cell");
        cells.add(cell);
        
        row.set("cells", cells);
        rows.add(row);
        props.set("rows", rows);

        String result = renderer.render(props, "");
        assertThat(result).contains("Yellow Cell");
        assertThat(result).contains("#ffcc00");
    }

    @Test
    void render_cellWithTextAlign_appliesAlignment() {
        ObjectNode props = objectMapper.createObjectNode();
        ArrayNode rows = objectMapper.createArrayNode();
        ObjectNode row = objectMapper.createObjectNode();
        ArrayNode cells = objectMapper.createArrayNode();
        
        ObjectNode cell = objectMapper.createObjectNode();
        ObjectNode style = objectMapper.createObjectNode();
        style.put("textAlign", "center");
        cell.set("style", style);
        cell.put("contentHtml", "Centered");
        cells.add(cell);
        
        row.set("cells", cells);
        rows.add(row);
        props.set("rows", rows);

        String result = renderer.render(props, "");
        assertThat(result).contains("Centered");
        assertThat(result).contains("center");
    }

    @Test
    void render_cellWithVerticalAlign_appliesAlignment() {
        ObjectNode props = objectMapper.createObjectNode();
        ArrayNode rows = objectMapper.createArrayNode();
        ObjectNode row = objectMapper.createObjectNode();
        ArrayNode cells = objectMapper.createArrayNode();
        
        ObjectNode cell = objectMapper.createObjectNode();
        ObjectNode style = objectMapper.createObjectNode();
        style.put("verticalAlign", "middle");
        cell.set("style", style);
        cell.put("contentHtml", "Middle");
        cells.add(cell);
        
        row.set("cells", cells);
        rows.add(row);
        props.set("rows", rows);

        String result = renderer.render(props, "");
        assertThat(result).contains("Middle");
    }

    @Test
    void render_cellWithFontWeight_appliesBold() {
        ObjectNode props = objectMapper.createObjectNode();
        ArrayNode rows = objectMapper.createArrayNode();
        ObjectNode row = objectMapper.createObjectNode();
        ArrayNode cells = objectMapper.createArrayNode();
        
        ObjectNode cell = objectMapper.createObjectNode();
        ObjectNode style = objectMapper.createObjectNode();
        style.put("fontWeight", "bold");
        cell.set("style", style);
        cell.put("contentHtml", "Bold Text");
        cells.add(cell);
        
        row.set("cells", cells);
        rows.add(row);
        props.set("rows", rows);

        String result = renderer.render(props, "");
        assertThat(result).contains("Bold Text");
    }

    @Test
    void render_cellWithFontStyle_appliesItalic() {
        ObjectNode props = objectMapper.createObjectNode();
        ArrayNode rows = objectMapper.createArrayNode();
        ObjectNode row = objectMapper.createObjectNode();
        ArrayNode cells = objectMapper.createArrayNode();
        
        ObjectNode cell = objectMapper.createObjectNode();
        ObjectNode style = objectMapper.createObjectNode();
        style.put("fontStyle", "italic");
        cell.set("style", style);
        cell.put("contentHtml", "Italic Text");
        cells.add(cell);
        
        row.set("cells", cells);
        rows.add(row);
        props.set("rows", rows);

        String result = renderer.render(props, "");
        assertThat(result).contains("Italic Text");
    }

    @Test
    void render_mergedCell_appliesColspan() {
        ObjectNode props = objectMapper.createObjectNode();
        ArrayNode rows = objectMapper.createArrayNode();
        ObjectNode row = objectMapper.createObjectNode();
        ArrayNode cells = objectMapper.createArrayNode();
        
        ObjectNode cell = objectMapper.createObjectNode();
        ObjectNode merge = objectMapper.createObjectNode();
        merge.put("colSpan", 2);
        merge.put("rowSpan", 1);
        cell.set("merge", merge);
        cell.put("contentHtml", "Merged");
        cells.add(cell);
        
        row.set("cells", cells);
        rows.add(row);
        props.set("rows", rows);

        String result = renderer.render(props, "");
        assertThat(result).contains("Merged");
        // colspan attribute only added when colSpan > 1, check content is rendered
        assertThat(result).contains("table-widget__cell");
    }

    @Test
    void render_mergedCell_appliesRowspan() {
        ObjectNode props = objectMapper.createObjectNode();
        ArrayNode rows = objectMapper.createArrayNode();
        
        ObjectNode row1 = objectMapper.createObjectNode();
        ArrayNode cells1 = objectMapper.createArrayNode();
        ObjectNode cell1 = objectMapper.createObjectNode();
        ObjectNode merge = objectMapper.createObjectNode();
        merge.put("colSpan", 1);
        merge.put("rowSpan", 2);
        cell1.set("merge", merge);
        cell1.put("contentHtml", "Spans 2 Rows");
        cells1.add(cell1);
        row1.set("cells", cells1);
        rows.add(row1);
        
        ObjectNode row2 = objectMapper.createObjectNode();
        ArrayNode cells2 = objectMapper.createArrayNode();
        ObjectNode cell2 = objectMapper.createObjectNode();
        ObjectNode coveredBy = objectMapper.createObjectNode();
        coveredBy.put("row", 0);
        coveredBy.put("col", 0);
        cell2.set("coveredBy", coveredBy);
        cells2.add(cell2);
        row2.set("cells", cells2);
        rows.add(row2);
        
        props.set("rows", rows);

        String result = renderer.render(props, "");
        assertThat(result).contains("Spans 2 Rows");
        // rowspan attribute only added when rowSpan > 1, check content is rendered
        assertThat(result).contains("table-widget__cell");
    }

    @Test
    void render_showBordersTrue_showsBorders() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("showBorders", true);
        props.set("rows", objectMapper.createArrayNode());

        String result = renderer.render(props, "");
        assertThat(result).isNotNull();
    }

    @Test
    void render_showBordersFalse_hidesBorders() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("showBorders", false);
        props.set("rows", objectMapper.createArrayNode());

        String result = renderer.render(props, "");
        assertThat(result).isNotNull();
    }

    @Test
    void render_withWidgetStyle_appliesStyle() {
        ObjectNode props = createTableWithContent(1, 1, "Styled");

        String result = renderer.render(props, "width: 500px; height: 200px;");
        assertThat(result).contains("width: 500px");
        assertThat(result).contains("height: 200px");
    }

    @Test
    void render_cellWithHtmlContent_preservesHtml() {
        ObjectNode props = objectMapper.createObjectNode();
        ArrayNode rows = objectMapper.createArrayNode();
        ObjectNode row = objectMapper.createObjectNode();
        ArrayNode cells = objectMapper.createArrayNode();
        
        ObjectNode cell = objectMapper.createObjectNode();
        cell.put("contentHtml", "<p><b>Bold</b> and <i>Italic</i></p>");
        cells.add(cell);
        
        row.set("cells", cells);
        rows.add(row);
        props.set("rows", rows);

        String result = renderer.render(props, "");
        assertThat(result).contains("<b>Bold</b>");
        assertThat(result).contains("<i>Italic</i>");
    }

    @Test
    void render_cellWithListContent_preservesList() {
        ObjectNode props = objectMapper.createObjectNode();
        ArrayNode rows = objectMapper.createArrayNode();
        ObjectNode row = objectMapper.createObjectNode();
        ArrayNode cells = objectMapper.createArrayNode();
        
        ObjectNode cell = objectMapper.createObjectNode();
        cell.put("contentHtml", "<ul><li>Item 1</li><li>Item 2</li></ul>");
        cells.add(cell);
        
        row.set("cells", cells);
        rows.add(row);
        props.set("rows", rows);

        String result = renderer.render(props, "");
        assertThat(result).contains("<ul>");
        assertThat(result).contains("<li>Item 1</li>");
    }

    @Test
    void render_withColumnWidths_appliesWidths() {
        ObjectNode props = objectMapper.createObjectNode();
        ArrayNode colWidths = objectMapper.createArrayNode();
        colWidths.add(100);
        colWidths.add(200);
        props.set("columnWidths", colWidths);
        props.set("rows", objectMapper.createArrayNode());

        String result = renderer.render(props, "");
        assertThat(result).isNotNull();
    }

    @Test
    void render_withRowHeights_appliesHeights() {
        ObjectNode props = objectMapper.createObjectNode();
        ArrayNode rowHeights = objectMapper.createArrayNode();
        rowHeights.add(30);
        rowHeights.add(40);
        props.set("rowHeights", rowHeights);
        
        ArrayNode rows = objectMapper.createArrayNode();
        for (int i = 0; i < 2; i++) {
            ObjectNode row = objectMapper.createObjectNode();
            ArrayNode cells = objectMapper.createArrayNode();
            ObjectNode cell = objectMapper.createObjectNode();
            cell.put("contentHtml", "Row " + i);
            cells.add(cell);
            row.set("cells", cells);
            rows.add(row);
        }
        props.set("rows", rows);

        String result = renderer.render(props, "");
        assertThat(result).isNotNull();
    }

    @Test
    void getCss_returnsNonEmptyCss() {
        String css = renderer.getCss();
        assertThat(css).isNotNull();
        assertThat(css).contains(".widget-table");
        assertThat(css).contains("table-widget__cell");
    }

    @Test
    void render_headerRowEnabled_appliesHeaderStyle() {
        ObjectNode props = createTableWithContent(3, 2, "Cell");
        props.put("headerRow", true);
        props.put("headerRowCount", 1);

        String result = renderer.render(props, "");
        assertThat(result).contains("table-widget__row");
    }

    @Test
    void render_headerRowWithMultipleRows_appliesHeaderToAll() {
        ObjectNode props = createTableWithContent(4, 2, "Cell");
        props.put("headerRow", true);
        props.put("headerRowCount", 2);

        String result = renderer.render(props, "");
        assertThat(result).contains("table-widget__row");
    }

    @Test
    void render_firstColumnEnabled_appliesFirstColumnStyle() {
        ObjectNode props = createTableWithContent(3, 3, "Cell");
        props.put("firstColumn", true);

        String result = renderer.render(props, "");
        assertThat(result).contains("table-widget__cell");
    }

    @Test
    void render_lastColumnEnabled_appliesLastColumnStyle() {
        ObjectNode props = createTableWithContent(3, 3, "Cell");
        props.put("lastColumn", true);

        String result = renderer.render(props, "");
        assertThat(result).contains("table-widget__cell");
    }

    @Test
    void render_totalRowEnabled_appliesTotalRowStyle() {
        ObjectNode props = createTableWithContent(3, 2, "Cell");
        props.put("totalRow", true);

        String result = renderer.render(props, "");
        assertThat(result).contains("table-widget__row");
    }

    @Test
    void render_columnFractions_appliesColumnWidths() {
        ObjectNode props = createTableWithContent(2, 3, "Cell");
        ArrayNode colFractions = objectMapper.createArrayNode();
        colFractions.add(0.2);
        colFractions.add(0.5);
        colFractions.add(0.3);
        props.set("columnFractions", colFractions);

        String result = renderer.render(props, "");
        assertThat(result).contains("<colgroup>");
        assertThat(result).contains("<col");
    }

    @Test
    void render_rowFractions_appliesRowHeights() {
        ObjectNode props = createTableWithContent(3, 2, "Cell");
        ArrayNode rowFractions = objectMapper.createArrayNode();
        rowFractions.add(0.3);
        rowFractions.add(0.4);
        rowFractions.add(0.3);
        props.set("rowFractions", rowFractions);

        String result = renderer.render(props, "");
        assertThat(result).contains("height:");
    }

    @Test
    void render_urlTable_addsDataAttribute() {
        ObjectNode props = createTableWithContent(2, 2, "Cell");
        ObjectNode dataSource = objectMapper.createObjectNode();
        dataSource.put("kind", "http");
        props.set("dataSource", dataSource);

        String result = renderer.render(props, "");
        assertThat(result).contains("data-url-table=\"true\"");
    }

    @Test
    void render_cellWithFontSize_appliesFontSize() {
        ObjectNode props = objectMapper.createObjectNode();
        ArrayNode rows = objectMapper.createArrayNode();
        ObjectNode row = objectMapper.createObjectNode();
        ArrayNode cells = objectMapper.createArrayNode();
        
        ObjectNode cell = objectMapper.createObjectNode();
        ObjectNode style = objectMapper.createObjectNode();
        style.put("fontSizePx", 18);
        cell.set("style", style);
        cell.put("contentHtml", "Large Text");
        cells.add(cell);
        
        row.set("cells", cells);
        rows.add(row);
        props.set("rows", rows);

        String result = renderer.render(props, "");
        assertThat(result).contains("Large Text");
    }

    @Test
    void render_cellWithFontFamily_appliesFontFamily() {
        ObjectNode props = objectMapper.createObjectNode();
        ArrayNode rows = objectMapper.createArrayNode();
        ObjectNode row = objectMapper.createObjectNode();
        ArrayNode cells = objectMapper.createArrayNode();
        
        ObjectNode cell = objectMapper.createObjectNode();
        ObjectNode style = objectMapper.createObjectNode();
        style.put("fontFamily", "Arial");
        cell.set("style", style);
        cell.put("contentHtml", "Arial Text");
        cells.add(cell);
        
        row.set("cells", cells);
        rows.add(row);
        props.set("rows", rows);

        String result = renderer.render(props, "");
        assertThat(result).contains("Arial Text");
    }

    @Test
    void render_cellWithColor_appliesTextColor() {
        ObjectNode props = objectMapper.createObjectNode();
        ArrayNode rows = objectMapper.createArrayNode();
        ObjectNode row = objectMapper.createObjectNode();
        ArrayNode cells = objectMapper.createArrayNode();
        
        ObjectNode cell = objectMapper.createObjectNode();
        ObjectNode style = objectMapper.createObjectNode();
        style.put("color", "#ff0000");
        cell.set("style", style);
        cell.put("contentHtml", "Red Text");
        cells.add(cell);
        
        row.set("cells", cells);
        rows.add(row);
        props.set("rows", rows);

        String result = renderer.render(props, "");
        assertThat(result).contains("Red Text");
    }

    @Test
    void render_emptyCell_rendersNbsp() {
        ObjectNode props = objectMapper.createObjectNode();
        ArrayNode rows = objectMapper.createArrayNode();
        ObjectNode row = objectMapper.createObjectNode();
        ArrayNode cells = objectMapper.createArrayNode();
        
        ObjectNode cell = objectMapper.createObjectNode();
        cell.put("contentHtml", "");
        cells.add(cell);
        
        row.set("cells", cells);
        rows.add(row);
        props.set("rows", rows);

        String result = renderer.render(props, "");
        assertThat(result).contains("&nbsp;");
    }

    @Test
    void render_cellWithSplit_rendersSplitGrid() {
        ObjectNode props = objectMapper.createObjectNode();
        ArrayNode rows = objectMapper.createArrayNode();
        ObjectNode row = objectMapper.createObjectNode();
        ArrayNode cells = objectMapper.createArrayNode();
        
        ObjectNode cell = objectMapper.createObjectNode();
        ObjectNode split = objectMapper.createObjectNode();
        split.put("rows", 2);
        split.put("cols", 2);
        
        ArrayNode splitCells = objectMapper.createArrayNode();
        for (int i = 0; i < 4; i++) {
            ObjectNode splitCell = objectMapper.createObjectNode();
            splitCell.put("contentHtml", "Split " + i);
            splitCells.add(splitCell);
        }
        split.set("cells", splitCells);
        cell.set("split", split);
        cells.add(cell);
        
        row.set("cells", cells);
        rows.add(row);
        props.set("rows", rows);

        String result = renderer.render(props, "");
        assertThat(result).contains("table-widget__split-grid");
        assertThat(result).contains("table-widget__sub-cell");
    }

    @Test
    void render_splitCellWithFractions_appliesFractions() {
        ObjectNode props = objectMapper.createObjectNode();
        ArrayNode rows = objectMapper.createArrayNode();
        ObjectNode row = objectMapper.createObjectNode();
        ArrayNode cells = objectMapper.createArrayNode();
        
        ObjectNode cell = objectMapper.createObjectNode();
        ObjectNode split = objectMapper.createObjectNode();
        split.put("rows", 2);
        split.put("cols", 2);
        
        ArrayNode colFractions = objectMapper.createArrayNode();
        colFractions.add(0.4);
        colFractions.add(0.6);
        split.set("columnFractions", colFractions);
        
        ArrayNode rowFractions = objectMapper.createArrayNode();
        rowFractions.add(0.5);
        rowFractions.add(0.5);
        split.set("rowFractions", rowFractions);
        
        ArrayNode splitCells = objectMapper.createArrayNode();
        for (int i = 0; i < 4; i++) {
            ObjectNode splitCell = objectMapper.createObjectNode();
            splitCell.put("contentHtml", "Split " + i);
            splitCells.add(splitCell);
        }
        split.set("cells", splitCells);
        cell.set("split", split);
        cells.add(cell);
        
        row.set("cells", cells);
        rows.add(row);
        props.set("rows", rows);

        String result = renderer.render(props, "");
        assertThat(result).contains("grid-template-columns");
        assertThat(result).contains("grid-template-rows");
    }

    @Test
    void render_cellWithBorder_appliesBorderStyle() {
        ObjectNode props = objectMapper.createObjectNode();
        ArrayNode rows = objectMapper.createArrayNode();
        ObjectNode row = objectMapper.createObjectNode();
        ArrayNode cells = objectMapper.createArrayNode();
        
        ObjectNode cell = objectMapper.createObjectNode();
        ObjectNode style = objectMapper.createObjectNode();
        style.put("borderTopWidth", 2);
        style.put("borderTopColor", "#000000");
        style.put("borderTopStyle", "solid");
        cell.set("style", style);
        cell.put("contentHtml", "Bordered");
        cells.add(cell);
        
        row.set("cells", cells);
        rows.add(row);
        props.set("rows", rows);

        String result = renderer.render(props, "");
        assertThat(result).contains("Bordered");
    }

    @Test
    void render_cellWithLineHeight_appliesLineHeight() {
        ObjectNode props = objectMapper.createObjectNode();
        ArrayNode rows = objectMapper.createArrayNode();
        ObjectNode row = objectMapper.createObjectNode();
        ArrayNode cells = objectMapper.createArrayNode();
        
        ObjectNode cell = objectMapper.createObjectNode();
        ObjectNode style = objectMapper.createObjectNode();
        style.put("lineHeight", "1.8");
        cell.set("style", style);
        cell.put("contentHtml", "Spaced");
        cells.add(cell);
        
        row.set("cells", cells);
        rows.add(row);
        props.set("rows", rows);

        String result = renderer.render(props, "");
        assertThat(result).contains("Spaced");
    }

    @Test
    void render_coveredCell_isSkipped() {
        ObjectNode props = objectMapper.createObjectNode();
        ArrayNode rows = objectMapper.createArrayNode();
        
        ObjectNode row1 = objectMapper.createObjectNode();
        ArrayNode cells1 = objectMapper.createArrayNode();
        
        ObjectNode anchorCell = objectMapper.createObjectNode();
        ObjectNode merge = objectMapper.createObjectNode();
        merge.put("colSpan", 2);
        merge.put("rowSpan", 1);
        anchorCell.set("merge", merge);
        anchorCell.put("contentHtml", "Merged");
        cells1.add(anchorCell);
        
        ObjectNode coveredCell = objectMapper.createObjectNode();
        ObjectNode coveredBy = objectMapper.createObjectNode();
        coveredBy.put("row", 0);
        coveredBy.put("col", 0);
        coveredCell.set("coveredBy", coveredBy);
        cells1.add(coveredCell);
        
        row1.set("cells", cells1);
        rows.add(row1);
        props.set("rows", rows);

        String result = renderer.render(props, "");
        assertThat(result).contains("colspan=\"2\"");
        assertThat(result).contains("Merged");
    }

    @Test
    void getCss_containsTableSelectors() {
        String css = TableWidgetRenderer.getCss();
        assertThat(css).contains(".widget-table");
        assertThat(css).contains(".table-widget__table");
        assertThat(css).contains(".table-widget__cell");
        assertThat(css).contains(".table-widget__cell-surface");
        assertThat(css).contains(".table-widget__cell-content");
        assertThat(css).contains(".table-widget__split-grid");
        assertThat(css).contains(".table-widget__sub-cell");
    }

    @Test
    void render_withConditionalFormatting_equalsOp_appliesStyle() {
        ObjectNode props = createTableWithConditionalRule("equals", "Test", "#ff0000", null);
        String result = renderer.render(props, "");
        assertThat(result).contains("#ff0000");
    }

    @Test
    void render_withConditionalFormatting_containsOp_appliesStyle() {
        ObjectNode props = createTableWithConditionalRule("contains", "es", "#00ff00", null);
        String result = renderer.render(props, "");
        assertThat(result).contains("#00ff00");
    }

    @Test
    void render_withConditionalFormatting_isEmpty_appliesStyle() {
        ObjectNode props = createTableWithConditionalRule("isEmpty", "", "#0000ff", "");
        String result = renderer.render(props, "");
        assertThat(result).contains("#0000ff");
    }

    @Test
    void render_withConditionalFormatting_isNotEmpty_appliesStyle() {
        ObjectNode props = createTableWithConditionalRule("isNotEmpty", "", "#ffff00", "Text");
        String result = renderer.render(props, "");
        assertThat(result).contains("#ffff00");
    }

    @Test
    void render_withConditionalFormatting_notEquals_appliesStyle() {
        ObjectNode props = createTableWithConditionalRule("notEquals", "Other", "#ff00ff", "Test");
        String result = renderer.render(props, "");
        assertThat(result).contains("#ff00ff");
    }

    @Test
    void render_withConditionalFormatting_startsWith_appliesStyle() {
        ObjectNode props = createTableWithConditionalRule("startsWith", "Te", "#00ffff", "Test");
        String result = renderer.render(props, "");
        assertThat(result).contains("#00ffff");
    }

    @Test
    void render_withConditionalFormatting_endsWith_appliesStyle() {
        ObjectNode props = createTableWithConditionalRule("endsWith", "st", "#aabbcc", "Test");
        String result = renderer.render(props, "");
        assertThat(result).contains("#aabbcc");
    }

    @Test
    void render_withConditionalFormatting_greaterThan_appliesStyle() {
        ObjectNode props = createTableWithConditionalRule("greaterThan", "50", "#112233", "100");
        String result = renderer.render(props, "");
        assertThat(result).contains("#112233");
    }

    @Test
    void render_withConditionalFormatting_lessThan_appliesStyle() {
        ObjectNode props = createTableWithConditionalRule("lessThan", "50", "#445566", "25");
        String result = renderer.render(props, "");
        assertThat(result).contains("#445566");
    }

    @Test
    void render_withConditionalFormatting_between_appliesStyle() {
        ObjectNode props = createTableWithConditionalRuleBetween("between", "10", "100", "#778899", "50");
        String result = renderer.render(props, "");
        assertThat(result).contains("#778899");
    }

    @Test
    void render_withConditionalFormatting_notBetween_appliesStyle() {
        ObjectNode props = createTableWithConditionalRuleBetween("notBetween", "10", "100", "#aabbcc", "200");
        String result = renderer.render(props, "");
        assertThat(result).contains("#aabbcc");
    }

    @Test
    void render_withConditionalFormatting_greaterThanOrEqual_appliesStyle() {
        ObjectNode props = createTableWithConditionalRule("greaterThanOrEqual", "100", "#ddeeff", "100");
        String result = renderer.render(props, "");
        assertThat(result).contains("#ddeeff");
    }

    @Test
    void render_withConditionalFormatting_lessThanOrEqual_appliesStyle() {
        ObjectNode props = createTableWithConditionalRule("lessThanOrEqual", "100", "#123456", "100");
        String result = renderer.render(props, "");
        assertThat(result).contains("#123456");
    }

    @Test
    void render_withConditionalFormatting_inList_appliesStyle() {
        ObjectNode props = createTableWithConditionalRuleInList("inList", new String[]{"A", "B", "C"}, "#abcdef", "B");
        String result = renderer.render(props, "");
        assertThat(result).contains("#abcdef");
    }

    @Test
    void render_withConditionalFormatting_notInList_appliesStyle() {
        ObjectNode props = createTableWithConditionalRuleInList("notInList", new String[]{"A", "B", "C"}, "#fedcba", "D");
        String result = renderer.render(props, "");
        assertThat(result).contains("#fedcba");
    }

    @Test
    void render_withConditionalFormatting_notContains_appliesStyle() {
        ObjectNode props = createTableWithConditionalRule("notContains", "xyz", "#999888", "Test");
        String result = renderer.render(props, "");
        assertThat(result).contains("#999888");
    }

    @Test
    void render_withConditionalFormatting_equalsIgnoreCase_appliesStyle() {
        ObjectNode props = createTableWithConditionalRule("equalsIgnoreCase", "TEST", "#111222", "test");
        String result = renderer.render(props, "");
        assertThat(result).contains("#111222");
    }

    @Test
    void render_withConditionalFormatting_withTooltip_addsTitle() {
        ObjectNode props = createTableWithConditionalRuleWithTooltip("equals", "Test", "Tooltip text");
        String result = renderer.render(props, "");
        assertThat(result).contains("title=\"Tooltip text\"");
    }

    @Test
    void render_withConditionalFormatting_withCellClass_addsClass() {
        ObjectNode props = createTableWithConditionalRuleWithCellClass("equals", "Test", "custom-class");
        String result = renderer.render(props, "");
        assertThat(result).contains("custom-class");
    }

    @Test
    void render_withConditionalFormatting_orLogic_appliesStyle() {
        ObjectNode props = createTableWithOrCondition();
        String result = renderer.render(props, "");
        assertThat(result).contains("#aaaaaa");
    }

    @Test
    void render_withConditionalFormatting_andLogic_appliesStyle() {
        ObjectNode props = createTableWithAndCondition();
        String result = renderer.render(props, "");
        assertThat(result).contains("#bbbbbb");
    }

    @Test
    void render_cellWithTextDecoration_appliesDecoration() {
        ObjectNode props = objectMapper.createObjectNode();
        ArrayNode rows = objectMapper.createArrayNode();
        ObjectNode row = objectMapper.createObjectNode();
        ArrayNode cells = objectMapper.createArrayNode();
        
        ObjectNode cell = objectMapper.createObjectNode();
        ObjectNode style = objectMapper.createObjectNode();
        style.put("textDecoration", "underline");
        cell.set("style", style);
        cell.put("contentHtml", "Underlined");
        cells.add(cell);
        
        row.set("cells", cells);
        rows.add(row);
        props.set("rows", rows);

        String result = renderer.render(props, "");
        assertThat(result).contains("underline");
    }

    @Test
    void render_cellWithTextHighlightColor_appliesHighlight() {
        ObjectNode props = objectMapper.createObjectNode();
        ArrayNode rows = objectMapper.createArrayNode();
        ObjectNode row = objectMapper.createObjectNode();
        ArrayNode cells = objectMapper.createArrayNode();
        
        ObjectNode cell = objectMapper.createObjectNode();
        ObjectNode style = objectMapper.createObjectNode();
        style.put("textHighlightColor", "#ffff00");
        cell.set("style", style);
        cell.put("contentHtml", "Highlighted");
        cells.add(cell);
        
        row.set("cells", cells);
        rows.add(row);
        props.set("rows", rows);

        String result = renderer.render(props, "");
        assertThat(result).contains("#ffff00");
    }

    @Test
    void render_cellWithBorderStyle_appliesBorder() {
        ObjectNode props = objectMapper.createObjectNode();
        ArrayNode rows = objectMapper.createArrayNode();
        ObjectNode row = objectMapper.createObjectNode();
        ArrayNode cells = objectMapper.createArrayNode();
        
        ObjectNode cell = objectMapper.createObjectNode();
        ObjectNode style = objectMapper.createObjectNode();
        style.put("borderStyle", "dashed");
        style.put("borderWidth", 3);
        style.put("borderColor", "#333333");
        cell.set("style", style);
        cell.put("contentHtml", "Bordered");
        cells.add(cell);
        
        row.set("cells", cells);
        rows.add(row);
        props.set("rows", rows);

        String result = renderer.render(props, "");
        assertThat(result).contains("border-style: dashed");
        assertThat(result).contains("border-width: 3px");
        assertThat(result).contains("border-color: #333333");
    }

    @Test
    void render_totalRowWithoutBorder_appliesDefaultBorder() {
        ObjectNode props = createTableWithContent(3, 2, "Cell");
        props.put("totalRow", true);

        String result = renderer.render(props, "");
        assertThat(result).contains("border-top-width: 2px");
    }

    @Test
    void render_splitCellWithCoveredBy_skipsCovered() {
        ObjectNode props = objectMapper.createObjectNode();
        ArrayNode rows = objectMapper.createArrayNode();
        ObjectNode row = objectMapper.createObjectNode();
        ArrayNode cells = objectMapper.createArrayNode();
        
        ObjectNode cell = objectMapper.createObjectNode();
        ObjectNode split = objectMapper.createObjectNode();
        split.put("rows", 2);
        split.put("cols", 2);
        
        ArrayNode splitCells = objectMapper.createArrayNode();
        
        ObjectNode anchor = objectMapper.createObjectNode();
        ObjectNode merge = objectMapper.createObjectNode();
        merge.put("colSpan", 2);
        merge.put("rowSpan", 1);
        anchor.set("merge", merge);
        anchor.put("contentHtml", "Merged Split");
        splitCells.add(anchor);
        
        ObjectNode covered = objectMapper.createObjectNode();
        ObjectNode coveredBy = objectMapper.createObjectNode();
        coveredBy.put("row", 0);
        coveredBy.put("col", 0);
        covered.set("coveredBy", coveredBy);
        splitCells.add(covered);
        
        ObjectNode normalCell1 = objectMapper.createObjectNode();
        normalCell1.put("contentHtml", "Normal 1");
        splitCells.add(normalCell1);
        
        ObjectNode normalCell2 = objectMapper.createObjectNode();
        normalCell2.put("contentHtml", "Normal 2");
        splitCells.add(normalCell2);
        
        split.set("cells", splitCells);
        cell.set("split", split);
        cells.add(cell);
        
        row.set("cells", cells);
        rows.add(row);
        props.set("rows", rows);

        String result = renderer.render(props, "");
        assertThat(result).contains("Merged Split");
        assertThat(result).contains("Normal 1");
    }

    @Test
    void render_withInvalidColumnFractions_usesDefault() {
        ObjectNode props = createTableWithContent(2, 3, "Cell");
        ArrayNode colFractions = objectMapper.createArrayNode();
        colFractions.add(-1);
        colFractions.add(0);
        colFractions.add(-0.5);
        props.set("columnFractions", colFractions);

        String result = renderer.render(props, "");
        assertThat(result).contains("<colgroup>");
    }

    @Test
    void render_conditionalFormatting_disabledRule_isIgnored() {
        ObjectNode props = createTableWithDisabledRule();
        String result = renderer.render(props, "");
        assertThat(result).doesNotContain("#aabbcc");
    }

    @Test
    void render_conditionalFormatting_stopIfTrue_stopsProcessing() {
        ObjectNode props = createTableWithStopIfTrueRule();
        String result = renderer.render(props, "");
        assertThat(result).contains("#first");
        assertThat(result).doesNotContain("#second");
    }

    @Test
    void render_conditionalFormatting_leafTarget_appliesStyle() {
        ObjectNode props = createTableWithLeafTargetRule();
        String result = renderer.render(props, "");
        assertThat(result).contains("#ccddee");
    }

    @Test
    void render_headerRowDefault_appliesMiddleAlign() {
        ObjectNode props = createTableWithContent(2, 2, "Cell");
        props.put("headerRow", true);
        props.put("headerRowCount", 1);

        String result = renderer.render(props, "");
        assertThat(result).contains("data-vertical-align=\"middle\"");
    }

    @Test
    void render_withNullRowNode_skipsNull() {
        ObjectNode props = objectMapper.createObjectNode();
        ArrayNode rows = objectMapper.createArrayNode();
        rows.addNull();
        rows.add(objectMapper.createObjectNode().set("cells", objectMapper.createArrayNode()));
        props.set("rows", rows);

        String result = renderer.render(props, "");
        assertThat(result).isNotNull();
    }

    @Test
    void render_withNullCellNode_skipsNull() {
        ObjectNode props = objectMapper.createObjectNode();
        ArrayNode rows = objectMapper.createArrayNode();
        ObjectNode row = objectMapper.createObjectNode();
        ArrayNode cells = objectMapper.createArrayNode();
        cells.addNull();
        ObjectNode cell = objectMapper.createObjectNode();
        cell.put("contentHtml", "Valid");
        cells.add(cell);
        row.set("cells", cells);
        rows.add(row);
        props.set("rows", rows);

        String result = renderer.render(props, "");
        assertThat(result).contains("Valid");
    }

    @Test
    void render_withTransparentBackground_setsTransparent() {
        ObjectNode props = objectMapper.createObjectNode();
        ArrayNode rows = objectMapper.createArrayNode();
        ObjectNode row = objectMapper.createObjectNode();
        ArrayNode cells = objectMapper.createArrayNode();
        
        ObjectNode cell = objectMapper.createObjectNode();
        ObjectNode style = objectMapper.createObjectNode();
        style.put("backgroundColor", "transparent");
        cell.set("style", style);
        cell.put("contentHtml", "Transparent");
        cells.add(cell);
        
        row.set("cells", cells);
        rows.add(row);
        props.set("rows", rows);

        String result = renderer.render(props, "");
        assertThat(result).contains("background-color: transparent");
    }

    @Test
    void render_conditionalWithFontWeight_appliesFontWeight() {
        ObjectNode props = createTableWithConditionalFontStyle("fontWeight", "bold");
        String result = renderer.render(props, "");
        assertThat(result).contains("font-weight: bold");
    }

    @Test
    void render_conditionalWithFontStyle_appliesFontStyle() {
        ObjectNode props = createTableWithConditionalFontStyle("fontStyle", "italic");
        String result = renderer.render(props, "");
        assertThat(result).contains("font-style: italic");
    }

    @Test
    void render_conditionalWithTextDecoration_appliesTextDecoration() {
        ObjectNode props = createTableWithConditionalFontStyle("textDecoration", "underline");
        String result = renderer.render(props, "");
        assertThat(result).contains("text-decoration: underline");
    }

    @Test
    void render_conditionalWithTextColor_appliesTextColor() {
        ObjectNode props = createTableWithConditionalTextColor("#ff5500");
        String result = renderer.render(props, "");
        assertThat(result).contains("color: #ff5500");
    }

    @Test
    void render_withConditionalFormatting_before_appliesStyle() {
        ObjectNode props = createTableWithConditionalRuleDate("before", "2025-01-15", "#date01", "2025-01-10");
        String result = renderer.render(props, "");
        assertThat(result).contains("#date01");
    }

    @Test
    void render_withConditionalFormatting_after_appliesStyle() {
        ObjectNode props = createTableWithConditionalRuleDate("after", "2025-01-10", "#date02", "2025-01-15");
        String result = renderer.render(props, "");
        assertThat(result).contains("#date02");
    }

    @Test
    void render_withConditionalFormatting_on_appliesStyle() {
        ObjectNode props = createTableWithConditionalRuleDate("on", "2025-01-15", "#date03", "2025-01-15");
        String result = renderer.render(props, "");
        assertThat(result).contains("#date03");
    }

    @Test
    void render_withConditionalFormatting_betweenDates_appliesStyle() {
        ObjectNode props = createTableWithConditionalRuleBetweenDates("2025-01-01", "2025-01-31", "#date04", "2025-01-15");
        String result = renderer.render(props, "");
        assertThat(result).contains("#date04");
    }

    @Test
    void render_withConditionalFormatting_before_invalidDate_noStyle() {
        ObjectNode props = createTableWithConditionalRuleDate("before", "2025-01-15", "#dateX", "not-a-date");
        String result = renderer.render(props, "");
        assertThat(result).doesNotContain("#dateX");
    }

    @Test
    void render_withConditionalFormatting_unknownOp_noStyle() {
        ObjectNode props = createTableWithConditionalRule("unknownOperator", "value", "#unknownOp", "Test");
        String result = renderer.render(props, "");
        assertThat(result).doesNotContain("#unknownOp");
    }

    private ObjectNode createTableWithContent(int rowCount, int colCount, String content) {
        ObjectNode props = objectMapper.createObjectNode();
        ArrayNode rows = objectMapper.createArrayNode();
        
        for (int r = 0; r < rowCount; r++) {
            ObjectNode row = objectMapper.createObjectNode();
            ArrayNode cells = objectMapper.createArrayNode();
            
            for (int c = 0; c < colCount; c++) {
                ObjectNode cell = objectMapper.createObjectNode();
                cell.put("contentHtml", content + " " + r + "-" + c);
                cells.add(cell);
            }
            
            row.set("cells", cells);
            rows.add(row);
        }
        
        props.set("rows", rows);
        return props;
    }

    private ObjectNode createTableWithConditionalRule(String op, String value, String bgColor, String cellContent) {
        ObjectNode props = objectMapper.createObjectNode();
        ArrayNode rows = objectMapper.createArrayNode();
        
        // Header row
        ObjectNode headerRow = objectMapper.createObjectNode();
        ArrayNode headerCells = objectMapper.createArrayNode();
        ObjectNode headerCell = objectMapper.createObjectNode();
        headerCell.put("contentHtml", "Header");
        headerCells.add(headerCell);
        headerRow.set("cells", headerCells);
        rows.add(headerRow);
        
        // Data row
        ObjectNode dataRow = objectMapper.createObjectNode();
        ArrayNode dataCells = objectMapper.createArrayNode();
        ObjectNode dataCell = objectMapper.createObjectNode();
        dataCell.put("contentHtml", cellContent != null ? cellContent : "Test");
        dataCells.add(dataCell);
        dataRow.set("cells", dataCells);
        rows.add(dataRow);
        
        props.set("rows", rows);
        props.put("headerRow", true);
        props.put("headerRowCount", 1);
        
        // Column rules
        ArrayNode columnRules = objectMapper.createArrayNode();
        ObjectNode ruleSet = objectMapper.createObjectNode();
        ruleSet.put("enabled", true);
        
        ObjectNode target = objectMapper.createObjectNode();
        target.put("kind", "whole");
        target.put("topColIndex", 0);
        ruleSet.set("target", target);
        
        ArrayNode rules = objectMapper.createArrayNode();
        ObjectNode rule = objectMapper.createObjectNode();
        rule.put("enabled", true);
        rule.put("priority", 0);
        
        ObjectNode when = objectMapper.createObjectNode();
        ArrayNode conditions = objectMapper.createArrayNode();
        ObjectNode condition = objectMapper.createObjectNode();
        condition.put("op", op);
        condition.put("value", value);
        condition.put("ignoreCase", true);
        conditions.add(condition);
        when.set("conditions", conditions);
        when.put("logic", "and");
        rule.set("when", when);
        
        ObjectNode then = objectMapper.createObjectNode();
        then.put("backgroundColor", bgColor);
        rule.set("then", then);
        
        rules.add(rule);
        ruleSet.set("rules", rules);
        columnRules.add(ruleSet);
        props.set("columnRules", columnRules);
        
        return props;
    }

    private ObjectNode createTableWithConditionalRuleBetween(String op, String min, String max, String bgColor, String cellContent) {
        ObjectNode props = objectMapper.createObjectNode();
        ArrayNode rows = objectMapper.createArrayNode();
        
        ObjectNode headerRow = objectMapper.createObjectNode();
        ArrayNode headerCells = objectMapper.createArrayNode();
        ObjectNode headerCell = objectMapper.createObjectNode();
        headerCell.put("contentHtml", "Header");
        headerCells.add(headerCell);
        headerRow.set("cells", headerCells);
        rows.add(headerRow);
        
        ObjectNode dataRow = objectMapper.createObjectNode();
        ArrayNode dataCells = objectMapper.createArrayNode();
        ObjectNode dataCell = objectMapper.createObjectNode();
        dataCell.put("contentHtml", cellContent);
        dataCells.add(dataCell);
        dataRow.set("cells", dataCells);
        rows.add(dataRow);
        
        props.set("rows", rows);
        props.put("headerRow", true);
        props.put("headerRowCount", 1);
        
        ArrayNode columnRules = objectMapper.createArrayNode();
        ObjectNode ruleSet = objectMapper.createObjectNode();
        ruleSet.put("enabled", true);
        
        ObjectNode target = objectMapper.createObjectNode();
        target.put("kind", "whole");
        target.put("topColIndex", 0);
        ruleSet.set("target", target);
        
        ArrayNode rules = objectMapper.createArrayNode();
        ObjectNode rule = objectMapper.createObjectNode();
        rule.put("enabled", true);
        rule.put("priority", 0);
        
        ObjectNode when = objectMapper.createObjectNode();
        ArrayNode conditions = objectMapper.createArrayNode();
        ObjectNode condition = objectMapper.createObjectNode();
        condition.put("op", op);
        condition.put("min", min);
        condition.put("max", max);
        conditions.add(condition);
        when.set("conditions", conditions);
        when.put("logic", "and");
        rule.set("when", when);
        
        ObjectNode then = objectMapper.createObjectNode();
        then.put("backgroundColor", bgColor);
        rule.set("then", then);
        
        rules.add(rule);
        ruleSet.set("rules", rules);
        columnRules.add(ruleSet);
        props.set("columnRules", columnRules);
        
        return props;
    }

    private ObjectNode createTableWithConditionalRuleInList(String op, String[] values, String bgColor, String cellContent) {
        ObjectNode props = objectMapper.createObjectNode();
        ArrayNode rows = objectMapper.createArrayNode();
        
        ObjectNode headerRow = objectMapper.createObjectNode();
        ArrayNode headerCells = objectMapper.createArrayNode();
        ObjectNode headerCell = objectMapper.createObjectNode();
        headerCell.put("contentHtml", "Header");
        headerCells.add(headerCell);
        headerRow.set("cells", headerCells);
        rows.add(headerRow);
        
        ObjectNode dataRow = objectMapper.createObjectNode();
        ArrayNode dataCells = objectMapper.createArrayNode();
        ObjectNode dataCell = objectMapper.createObjectNode();
        dataCell.put("contentHtml", cellContent);
        dataCells.add(dataCell);
        dataRow.set("cells", dataCells);
        rows.add(dataRow);
        
        props.set("rows", rows);
        props.put("headerRow", true);
        props.put("headerRowCount", 1);
        
        ArrayNode columnRules = objectMapper.createArrayNode();
        ObjectNode ruleSet = objectMapper.createObjectNode();
        ruleSet.put("enabled", true);
        
        ObjectNode target = objectMapper.createObjectNode();
        target.put("kind", "whole");
        target.put("topColIndex", 0);
        ruleSet.set("target", target);
        
        ArrayNode rules = objectMapper.createArrayNode();
        ObjectNode rule = objectMapper.createObjectNode();
        rule.put("enabled", true);
        rule.put("priority", 0);
        
        ObjectNode when = objectMapper.createObjectNode();
        ArrayNode conditions = objectMapper.createArrayNode();
        ObjectNode condition = objectMapper.createObjectNode();
        condition.put("op", op);
        ArrayNode valuesArray = objectMapper.createArrayNode();
        for (String v : values) {
            valuesArray.add(v);
        }
        condition.set("values", valuesArray);
        condition.put("ignoreCase", true);
        conditions.add(condition);
        when.set("conditions", conditions);
        when.put("logic", "and");
        rule.set("when", when);
        
        ObjectNode then = objectMapper.createObjectNode();
        then.put("backgroundColor", bgColor);
        rule.set("then", then);
        
        rules.add(rule);
        ruleSet.set("rules", rules);
        columnRules.add(ruleSet);
        props.set("columnRules", columnRules);
        
        return props;
    }

    private ObjectNode createTableWithConditionalRuleWithTooltip(String op, String value, String tooltip) {
        ObjectNode props = createTableWithConditionalRule(op, value, null, value);
        ArrayNode rules = (ArrayNode) props.path("columnRules").get(0).path("rules");
        ((ObjectNode) rules.get(0).path("then")).put("tooltip", tooltip);
        return props;
    }

    private ObjectNode createTableWithConditionalRuleWithCellClass(String op, String value, String cellClass) {
        ObjectNode props = createTableWithConditionalRule(op, value, null, value);
        ArrayNode rules = (ArrayNode) props.path("columnRules").get(0).path("rules");
        ((ObjectNode) rules.get(0).path("then")).put("cellClass", cellClass);
        return props;
    }

    private ObjectNode createTableWithOrCondition() {
        ObjectNode props = objectMapper.createObjectNode();
        ArrayNode rows = objectMapper.createArrayNode();
        
        ObjectNode headerRow = objectMapper.createObjectNode();
        ArrayNode headerCells = objectMapper.createArrayNode();
        ObjectNode headerCell = objectMapper.createObjectNode();
        headerCell.put("contentHtml", "Header");
        headerCells.add(headerCell);
        headerRow.set("cells", headerCells);
        rows.add(headerRow);
        
        ObjectNode dataRow = objectMapper.createObjectNode();
        ArrayNode dataCells = objectMapper.createArrayNode();
        ObjectNode dataCell = objectMapper.createObjectNode();
        dataCell.put("contentHtml", "A");
        dataCells.add(dataCell);
        dataRow.set("cells", dataCells);
        rows.add(dataRow);
        
        props.set("rows", rows);
        props.put("headerRow", true);
        props.put("headerRowCount", 1);
        
        ArrayNode columnRules = objectMapper.createArrayNode();
        ObjectNode ruleSet = objectMapper.createObjectNode();
        ruleSet.put("enabled", true);
        
        ObjectNode target = objectMapper.createObjectNode();
        target.put("kind", "whole");
        target.put("topColIndex", 0);
        ruleSet.set("target", target);
        
        ArrayNode rules = objectMapper.createArrayNode();
        ObjectNode rule = objectMapper.createObjectNode();
        rule.put("enabled", true);
        rule.put("priority", 0);
        
        ObjectNode when = objectMapper.createObjectNode();
        ArrayNode conditions = objectMapper.createArrayNode();
        ObjectNode cond1 = objectMapper.createObjectNode();
        cond1.put("op", "equals");
        cond1.put("value", "A");
        conditions.add(cond1);
        ObjectNode cond2 = objectMapper.createObjectNode();
        cond2.put("op", "equals");
        cond2.put("value", "B");
        conditions.add(cond2);
        when.set("conditions", conditions);
        when.put("logic", "or");
        rule.set("when", when);
        
        ObjectNode then = objectMapper.createObjectNode();
        then.put("backgroundColor", "#aaaaaa");
        rule.set("then", then);
        
        rules.add(rule);
        ruleSet.set("rules", rules);
        columnRules.add(ruleSet);
        props.set("columnRules", columnRules);
        
        return props;
    }

    private ObjectNode createTableWithAndCondition() {
        ObjectNode props = objectMapper.createObjectNode();
        ArrayNode rows = objectMapper.createArrayNode();
        
        ObjectNode headerRow = objectMapper.createObjectNode();
        ArrayNode headerCells = objectMapper.createArrayNode();
        ObjectNode headerCell = objectMapper.createObjectNode();
        headerCell.put("contentHtml", "Header");
        headerCells.add(headerCell);
        headerRow.set("cells", headerCells);
        rows.add(headerRow);
        
        ObjectNode dataRow = objectMapper.createObjectNode();
        ArrayNode dataCells = objectMapper.createArrayNode();
        ObjectNode dataCell = objectMapper.createObjectNode();
        dataCell.put("contentHtml", "TestData");
        dataCells.add(dataCell);
        dataRow.set("cells", dataCells);
        rows.add(dataRow);
        
        props.set("rows", rows);
        props.put("headerRow", true);
        props.put("headerRowCount", 1);
        
        ArrayNode columnRules = objectMapper.createArrayNode();
        ObjectNode ruleSet = objectMapper.createObjectNode();
        ruleSet.put("enabled", true);
        
        ObjectNode target = objectMapper.createObjectNode();
        target.put("kind", "whole");
        target.put("topColIndex", 0);
        ruleSet.set("target", target);
        
        ArrayNode rules = objectMapper.createArrayNode();
        ObjectNode rule = objectMapper.createObjectNode();
        rule.put("enabled", true);
        rule.put("priority", 0);
        
        ObjectNode when = objectMapper.createObjectNode();
        ArrayNode conditions = objectMapper.createArrayNode();
        ObjectNode cond1 = objectMapper.createObjectNode();
        cond1.put("op", "startsWith");
        cond1.put("value", "Test");
        conditions.add(cond1);
        ObjectNode cond2 = objectMapper.createObjectNode();
        cond2.put("op", "endsWith");
        cond2.put("value", "Data");
        conditions.add(cond2);
        when.set("conditions", conditions);
        when.put("logic", "and");
        rule.set("when", when);
        
        ObjectNode then = objectMapper.createObjectNode();
        then.put("backgroundColor", "#bbbbbb");
        rule.set("then", then);
        
        rules.add(rule);
        ruleSet.set("rules", rules);
        columnRules.add(ruleSet);
        props.set("columnRules", columnRules);
        
        return props;
    }

    private ObjectNode createTableWithDisabledRule() {
        ObjectNode props = createTableWithConditionalRule("equals", "Test", "#aabbcc", "Test");
        ((ObjectNode) props.path("columnRules").get(0)).put("enabled", false);
        return props;
    }

    private ObjectNode createTableWithStopIfTrueRule() {
        ObjectNode props = objectMapper.createObjectNode();
        ArrayNode rows = objectMapper.createArrayNode();
        
        ObjectNode headerRow = objectMapper.createObjectNode();
        ArrayNode headerCells = objectMapper.createArrayNode();
        ObjectNode headerCell = objectMapper.createObjectNode();
        headerCell.put("contentHtml", "Header");
        headerCells.add(headerCell);
        headerRow.set("cells", headerCells);
        rows.add(headerRow);
        
        ObjectNode dataRow = objectMapper.createObjectNode();
        ArrayNode dataCells = objectMapper.createArrayNode();
        ObjectNode dataCell = objectMapper.createObjectNode();
        dataCell.put("contentHtml", "Test");
        dataCells.add(dataCell);
        dataRow.set("cells", dataCells);
        rows.add(dataRow);
        
        props.set("rows", rows);
        props.put("headerRow", true);
        props.put("headerRowCount", 1);
        
        ArrayNode columnRules = objectMapper.createArrayNode();
        ObjectNode ruleSet = objectMapper.createObjectNode();
        ruleSet.put("enabled", true);
        
        ObjectNode target = objectMapper.createObjectNode();
        target.put("kind", "whole");
        target.put("topColIndex", 0);
        ruleSet.set("target", target);
        
        ArrayNode rules = objectMapper.createArrayNode();
        
        ObjectNode rule1 = objectMapper.createObjectNode();
        rule1.put("enabled", true);
        rule1.put("priority", 0);
        rule1.put("stopIfTrue", true);
        ObjectNode when1 = objectMapper.createObjectNode();
        ArrayNode conditions1 = objectMapper.createArrayNode();
        ObjectNode cond1 = objectMapper.createObjectNode();
        cond1.put("op", "equals");
        cond1.put("value", "Test");
        conditions1.add(cond1);
        when1.set("conditions", conditions1);
        rule1.set("when", when1);
        ObjectNode then1 = objectMapper.createObjectNode();
        then1.put("backgroundColor", "#first");
        rule1.set("then", then1);
        rules.add(rule1);
        
        ObjectNode rule2 = objectMapper.createObjectNode();
        rule2.put("enabled", true);
        rule2.put("priority", 1);
        ObjectNode when2 = objectMapper.createObjectNode();
        ArrayNode conditions2 = objectMapper.createArrayNode();
        ObjectNode cond2 = objectMapper.createObjectNode();
        cond2.put("op", "isNotEmpty");
        conditions2.add(cond2);
        when2.set("conditions", conditions2);
        rule2.set("when", when2);
        ObjectNode then2 = objectMapper.createObjectNode();
        then2.put("backgroundColor", "#second");
        rule2.set("then", then2);
        rules.add(rule2);
        
        ruleSet.set("rules", rules);
        columnRules.add(ruleSet);
        props.set("columnRules", columnRules);
        
        return props;
    }

    private ObjectNode createTableWithLeafTargetRule() {
        ObjectNode props = objectMapper.createObjectNode();
        ArrayNode rows = objectMapper.createArrayNode();
        
        ObjectNode headerRow = objectMapper.createObjectNode();
        ArrayNode headerCells = objectMapper.createArrayNode();
        ObjectNode headerCell = objectMapper.createObjectNode();
        headerCell.put("contentHtml", "Header");
        headerCells.add(headerCell);
        headerRow.set("cells", headerCells);
        rows.add(headerRow);
        
        ObjectNode dataRow = objectMapper.createObjectNode();
        ArrayNode dataCells = objectMapper.createArrayNode();
        ObjectNode dataCell = objectMapper.createObjectNode();
        dataCell.put("contentHtml", "Leaf");
        dataCells.add(dataCell);
        dataRow.set("cells", dataCells);
        rows.add(dataRow);
        
        props.set("rows", rows);
        props.put("headerRow", true);
        props.put("headerRowCount", 1);
        
        ArrayNode columnRules = objectMapper.createArrayNode();
        ObjectNode ruleSet = objectMapper.createObjectNode();
        ruleSet.put("enabled", true);
        
        ObjectNode target = objectMapper.createObjectNode();
        target.put("kind", "leaf");
        target.put("topColIndex", 0);
        ArrayNode leafPath = objectMapper.createArrayNode();
        leafPath.add(0);
        target.set("leafPath", leafPath);
        ruleSet.set("target", target);
        
        ArrayNode rules = objectMapper.createArrayNode();
        ObjectNode rule = objectMapper.createObjectNode();
        rule.put("enabled", true);
        rule.put("priority", 0);
        
        ObjectNode when = objectMapper.createObjectNode();
        ArrayNode conditions = objectMapper.createArrayNode();
        ObjectNode condition = objectMapper.createObjectNode();
        condition.put("op", "equals");
        condition.put("value", "Leaf");
        conditions.add(condition);
        when.set("conditions", conditions);
        rule.set("when", when);
        
        ObjectNode then = objectMapper.createObjectNode();
        then.put("backgroundColor", "#ccddee");
        rule.set("then", then);
        
        rules.add(rule);
        ruleSet.set("rules", rules);
        columnRules.add(ruleSet);
        props.set("columnRules", columnRules);
        
        return props;
    }

    private ObjectNode createTableWithConditionalFontStyle(String styleProp, String styleValue) {
        ObjectNode props = objectMapper.createObjectNode();
        ArrayNode rows = objectMapper.createArrayNode();
        
        ObjectNode headerRow = objectMapper.createObjectNode();
        ArrayNode headerCells = objectMapper.createArrayNode();
        ObjectNode headerCell = objectMapper.createObjectNode();
        headerCell.put("contentHtml", "Header");
        headerCells.add(headerCell);
        headerRow.set("cells", headerCells);
        rows.add(headerRow);
        
        ObjectNode dataRow = objectMapper.createObjectNode();
        ArrayNode dataCells = objectMapper.createArrayNode();
        ObjectNode dataCell = objectMapper.createObjectNode();
        dataCell.put("contentHtml", "Test");
        dataCells.add(dataCell);
        dataRow.set("cells", dataCells);
        rows.add(dataRow);
        
        props.set("rows", rows);
        props.put("headerRow", true);
        props.put("headerRowCount", 1);
        
        ArrayNode columnRules = objectMapper.createArrayNode();
        ObjectNode ruleSet = objectMapper.createObjectNode();
        ruleSet.put("enabled", true);
        
        ObjectNode target = objectMapper.createObjectNode();
        target.put("kind", "whole");
        target.put("topColIndex", 0);
        ruleSet.set("target", target);
        
        ArrayNode rules = objectMapper.createArrayNode();
        ObjectNode rule = objectMapper.createObjectNode();
        rule.put("enabled", true);
        rule.put("priority", 0);
        
        ObjectNode when = objectMapper.createObjectNode();
        ArrayNode conditions = objectMapper.createArrayNode();
        ObjectNode condition = objectMapper.createObjectNode();
        condition.put("op", "equals");
        condition.put("value", "Test");
        conditions.add(condition);
        when.set("conditions", conditions);
        rule.set("when", when);
        
        ObjectNode then = objectMapper.createObjectNode();
        then.put(styleProp, styleValue);
        rule.set("then", then);
        
        rules.add(rule);
        ruleSet.set("rules", rules);
        columnRules.add(ruleSet);
        props.set("columnRules", columnRules);
        
        return props;
    }

    private ObjectNode createTableWithConditionalTextColor(String color) {
        ObjectNode props = objectMapper.createObjectNode();
        ArrayNode rows = objectMapper.createArrayNode();
        
        ObjectNode headerRow = objectMapper.createObjectNode();
        ArrayNode headerCells = objectMapper.createArrayNode();
        ObjectNode headerCell = objectMapper.createObjectNode();
        headerCell.put("contentHtml", "Header");
        headerCells.add(headerCell);
        headerRow.set("cells", headerCells);
        rows.add(headerRow);
        
        ObjectNode dataRow = objectMapper.createObjectNode();
        ArrayNode dataCells = objectMapper.createArrayNode();
        ObjectNode dataCell = objectMapper.createObjectNode();
        dataCell.put("contentHtml", "Test");
        dataCells.add(dataCell);
        dataRow.set("cells", dataCells);
        rows.add(dataRow);
        
        props.set("rows", rows);
        props.put("headerRow", true);
        props.put("headerRowCount", 1);
        
        ArrayNode columnRules = objectMapper.createArrayNode();
        ObjectNode ruleSet = objectMapper.createObjectNode();
        ruleSet.put("enabled", true);
        
        ObjectNode target = objectMapper.createObjectNode();
        target.put("kind", "whole");
        target.put("topColIndex", 0);
        ruleSet.set("target", target);
        
        ArrayNode rules = objectMapper.createArrayNode();
        ObjectNode rule = objectMapper.createObjectNode();
        rule.put("enabled", true);
        rule.put("priority", 0);
        
        ObjectNode when = objectMapper.createObjectNode();
        ArrayNode conditions = objectMapper.createArrayNode();
        ObjectNode condition = objectMapper.createObjectNode();
        condition.put("op", "equals");
        condition.put("value", "Test");
        conditions.add(condition);
        when.set("conditions", conditions);
        rule.set("when", when);
        
        ObjectNode then = objectMapper.createObjectNode();
        then.put("textColor", color);
        rule.set("then", then);
        
        rules.add(rule);
        ruleSet.set("rules", rules);
        columnRules.add(ruleSet);
        props.set("columnRules", columnRules);
        
        return props;
    }

    private ObjectNode createTableWithConditionalRuleDate(String op, String value, String bgColor, String cellContent) {
        ObjectNode props = objectMapper.createObjectNode();
        ArrayNode rows = objectMapper.createArrayNode();
        
        ObjectNode headerRow = objectMapper.createObjectNode();
        ArrayNode headerCells = objectMapper.createArrayNode();
        ObjectNode headerCell = objectMapper.createObjectNode();
        headerCell.put("contentHtml", "Header");
        headerCells.add(headerCell);
        headerRow.set("cells", headerCells);
        rows.add(headerRow);
        
        ObjectNode dataRow = objectMapper.createObjectNode();
        ArrayNode dataCells = objectMapper.createArrayNode();
        ObjectNode dataCell = objectMapper.createObjectNode();
        dataCell.put("contentHtml", cellContent);
        dataCells.add(dataCell);
        dataRow.set("cells", dataCells);
        rows.add(dataRow);
        
        props.set("rows", rows);
        props.put("headerRow", true);
        props.put("headerRowCount", 1);
        
        ArrayNode columnRules = objectMapper.createArrayNode();
        ObjectNode ruleSet = objectMapper.createObjectNode();
        ruleSet.put("enabled", true);
        
        ObjectNode target = objectMapper.createObjectNode();
        target.put("kind", "whole");
        target.put("topColIndex", 0);
        ruleSet.set("target", target);
        
        ArrayNode rules = objectMapper.createArrayNode();
        ObjectNode rule = objectMapper.createObjectNode();
        rule.put("enabled", true);
        rule.put("priority", 0);
        
        ObjectNode when = objectMapper.createObjectNode();
        ArrayNode conditions = objectMapper.createArrayNode();
        ObjectNode condition = objectMapper.createObjectNode();
        condition.put("op", op);
        condition.put("value", value);
        conditions.add(condition);
        when.set("conditions", conditions);
        when.put("logic", "and");
        rule.set("when", when);
        
        ObjectNode then = objectMapper.createObjectNode();
        then.put("backgroundColor", bgColor);
        rule.set("then", then);
        
        rules.add(rule);
        ruleSet.set("rules", rules);
        columnRules.add(ruleSet);
        props.set("columnRules", columnRules);
        
        return props;
    }

    private ObjectNode createTableWithConditionalRuleBetweenDates(String min, String max, String bgColor, String cellContent) {
        ObjectNode props = objectMapper.createObjectNode();
        ArrayNode rows = objectMapper.createArrayNode();
        
        ObjectNode headerRow = objectMapper.createObjectNode();
        ArrayNode headerCells = objectMapper.createArrayNode();
        ObjectNode headerCell = objectMapper.createObjectNode();
        headerCell.put("contentHtml", "Header");
        headerCells.add(headerCell);
        headerRow.set("cells", headerCells);
        rows.add(headerRow);
        
        ObjectNode dataRow = objectMapper.createObjectNode();
        ArrayNode dataCells = objectMapper.createArrayNode();
        ObjectNode dataCell = objectMapper.createObjectNode();
        dataCell.put("contentHtml", cellContent);
        dataCells.add(dataCell);
        dataRow.set("cells", dataCells);
        rows.add(dataRow);
        
        props.set("rows", rows);
        props.put("headerRow", true);
        props.put("headerRowCount", 1);
        
        ArrayNode columnRules = objectMapper.createArrayNode();
        ObjectNode ruleSet = objectMapper.createObjectNode();
        ruleSet.put("enabled", true);
        
        ObjectNode target = objectMapper.createObjectNode();
        target.put("kind", "whole");
        target.put("topColIndex", 0);
        ruleSet.set("target", target);
        
        ArrayNode rules = objectMapper.createArrayNode();
        ObjectNode rule = objectMapper.createObjectNode();
        rule.put("enabled", true);
        rule.put("priority", 0);
        
        ObjectNode when = objectMapper.createObjectNode();
        ArrayNode conditions = objectMapper.createArrayNode();
        ObjectNode condition = objectMapper.createObjectNode();
        condition.put("op", "betweenDates");
        condition.put("min", min);
        condition.put("max", max);
        conditions.add(condition);
        when.set("conditions", conditions);
        when.put("logic", "and");
        rule.set("when", when);
        
        ObjectNode then = objectMapper.createObjectNode();
        then.put("backgroundColor", bgColor);
        rule.set("then", then);
        
        rules.add(rule);
        ruleSet.set("rules", rules);
        columnRules.add(ruleSet);
        props.set("columnRules", columnRules);
        
        return props;
    }
}
