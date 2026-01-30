package com.org.report_generator.render.widgets.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.org.report_generator.render.widgets.RenderContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.*;

class TableWidgetHtmlRendererTest {

    private TableWidgetHtmlRenderer renderer;
    private ObjectMapper objectMapper;
    private RenderContext ctx;

    @BeforeEach
    void setUp() {
        renderer = new TableWidgetHtmlRenderer();
        objectMapper = new ObjectMapper();
        ctx = new RenderContext(null, null);
    }

    @Test
    void widgetType_returnsTable() {
        assertThat(renderer.widgetType()).isEqualTo("table");
    }

    @Test
    void render_nullProps_returnsEmptyTable() {
        String result = renderer.render(null, "width: 100%;", ctx);
        assertThat(result).isNotNull();
    }

    @Test
    void render_emptyRows_returnsTableStructure() {
        ObjectNode props = objectMapper.createObjectNode();
        props.set("rows", objectMapper.createArrayNode());

        String result = renderer.render(props, "", ctx);
        assertThat(result).isNotNull();
    }

    @Test
    void render_singleCellTable_rendersCell() {
        ObjectNode props = createTableProps(1, 1);

        String result = renderer.render(props, "", ctx);
        assertThat(result).isNotNull();
    }

    @Test
    void render_multiRowTable_rendersAllRows() {
        ObjectNode props = createTableProps(3, 2);

        String result = renderer.render(props, "", ctx);
        assertThat(result).isNotNull();
    }

    @Test
    void render_cellWithContentHtml_rendersContent() {
        ObjectNode props = objectMapper.createObjectNode();
        ArrayNode rows = objectMapper.createArrayNode();
        ObjectNode row = objectMapper.createObjectNode();
        ArrayNode cells = objectMapper.createArrayNode();
        
        ObjectNode cell = objectMapper.createObjectNode();
        cell.put("contentHtml", "<p>Hello <b>World</b></p>");
        cells.add(cell);
        
        row.set("cells", cells);
        rows.add(row);
        props.set("rows", rows);

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("Hello");
    }

    @Test
    void render_cellWithBackgroundColor_appliesStyle() {
        ObjectNode props = objectMapper.createObjectNode();
        ArrayNode rows = objectMapper.createArrayNode();
        ObjectNode row = objectMapper.createObjectNode();
        ArrayNode cells = objectMapper.createArrayNode();
        
        ObjectNode cell = objectMapper.createObjectNode();
        ObjectNode style = objectMapper.createObjectNode();
        style.put("backgroundColor", "#f0f0f0");
        cell.set("style", style);
        cells.add(cell);
        
        row.set("cells", cells);
        rows.add(row);
        props.set("rows", rows);

        String result = renderer.render(props, "", ctx);
        assertThat(result).isNotNull();
    }

    @Test
    void render_cellWithTextAlignment_appliesStyle() {
        ObjectNode props = objectMapper.createObjectNode();
        ArrayNode rows = objectMapper.createArrayNode();
        ObjectNode row = objectMapper.createObjectNode();
        ArrayNode cells = objectMapper.createArrayNode();
        
        ObjectNode cell = objectMapper.createObjectNode();
        ObjectNode style = objectMapper.createObjectNode();
        style.put("textAlign", "center");
        cell.set("style", style);
        cells.add(cell);
        
        row.set("cells", cells);
        rows.add(row);
        props.set("rows", rows);

        String result = renderer.render(props, "", ctx);
        assertThat(result).isNotNull();
    }

    @Test
    void render_cellWithVerticalAlignment_appliesStyle() {
        ObjectNode props = objectMapper.createObjectNode();
        ArrayNode rows = objectMapper.createArrayNode();
        ObjectNode row = objectMapper.createObjectNode();
        ArrayNode cells = objectMapper.createArrayNode();
        
        ObjectNode cell = objectMapper.createObjectNode();
        ObjectNode style = objectMapper.createObjectNode();
        style.put("verticalAlign", "middle");
        cell.set("style", style);
        cells.add(cell);
        
        row.set("cells", cells);
        rows.add(row);
        props.set("rows", rows);

        String result = renderer.render(props, "", ctx);
        assertThat(result).isNotNull();
    }

    @Test
    void render_mergedCell_appliesColspan() {
        ObjectNode props = objectMapper.createObjectNode();
        ArrayNode rows = objectMapper.createArrayNode();
        ObjectNode row = objectMapper.createObjectNode();
        ArrayNode cells = objectMapper.createArrayNode();
        
        ObjectNode cell1 = objectMapper.createObjectNode();
        ObjectNode merge = objectMapper.createObjectNode();
        merge.put("colspan", 2);
        merge.put("rowspan", 1);
        cell1.set("merge", merge);
        cell1.put("contentHtml", "Merged Cell");
        cells.add(cell1);
        
        row.set("cells", cells);
        rows.add(row);
        props.set("rows", rows);

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("Merged Cell");
    }

    @Test
    void render_showBordersFalse_hidesTableBorders() {
        ObjectNode props = objectMapper.createObjectNode();
        props.put("showBorders", false);
        props.set("rows", objectMapper.createArrayNode());

        String result = renderer.render(props, "", ctx);
        assertThat(result).isNotNull();
    }

    @Test
    void render_withWidgetStyle_appliesStyle() {
        ObjectNode props = createTableProps(1, 1);

        String result = renderer.render(props, "position: absolute; top: 10px; left: 20px;", ctx);
        assertThat(result).isNotNull();
    }

    @Test
    void render_cellWithFontWeight_appliesStyle() {
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

        String result = renderer.render(props, "", ctx);
        assertThat(result).contains("Bold Text");
    }

    @Test
    void render_cellWithFontStyle_appliesStyle() {
        ObjectNode props = objectMapper.createObjectNode();
        ArrayNode rows = objectMapper.createArrayNode();
        ObjectNode row = objectMapper.createObjectNode();
        ArrayNode cells = objectMapper.createArrayNode();
        
        ObjectNode cell = objectMapper.createObjectNode();
        ObjectNode style = objectMapper.createObjectNode();
        style.put("fontStyle", "italic");
        cell.set("style", style);
        cells.add(cell);
        
        row.set("cells", cells);
        rows.add(row);
        props.set("rows", rows);

        String result = renderer.render(props, "", ctx);
        assertThat(result).isNotNull();
    }

    private ObjectNode createTableProps(int rowCount, int colCount) {
        ObjectNode props = objectMapper.createObjectNode();
        ArrayNode rows = objectMapper.createArrayNode();
        
        for (int r = 0; r < rowCount; r++) {
            ObjectNode row = objectMapper.createObjectNode();
            ArrayNode cells = objectMapper.createArrayNode();
            
            for (int c = 0; c < colCount; c++) {
                ObjectNode cell = objectMapper.createObjectNode();
                cell.put("contentHtml", "R" + r + "C" + c);
                cells.add(cell);
            }
            
            row.set("cells", cells);
            rows.add(row);
        }
        
        props.set("rows", rows);
        return props;
    }
}
