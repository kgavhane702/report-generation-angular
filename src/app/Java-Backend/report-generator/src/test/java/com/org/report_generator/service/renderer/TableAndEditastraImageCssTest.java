package com.org.report_generator.service.renderer;

import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class TableAndEditastraImageCssTest {

    @Test
    void tableCssIncludesResizableImageRulesAndClearfix() {
        String css = TableWidgetRenderer.getCss();
        assertTrue(css.contains(".widget-table .tw-resizable-image"), "Expected table CSS to include tw-resizable-image rules");
        assertTrue(css.contains("max-width: 100%"), "Expected table CSS to clamp images to container width");
        assertTrue(css.contains(".widget-table .table-widget__cell-content::after"), "Expected clearfix to prevent clipped floated content");
        assertTrue(css.contains("clear: both"), "Expected clearfix to clear floats");
    }

    @Test
    void editastraCssIncludesResizableImageRulesAndClearfix() {
        String css = EditastraWidgetRenderer.getCss();
        assertTrue(css.contains(".widget-editastra .tw-resizable-image"), "Expected editastra CSS to include tw-resizable-image rules");
        assertTrue(css.contains("max-width: 100%"), "Expected editastra CSS to clamp images to container width");
        assertTrue(css.contains(".widget-editastra__editor::after"), "Expected clearfix to prevent clipped floated content");
        assertTrue(css.contains("clear: both"), "Expected clearfix to clear floats");
    }

    @Test
    void tableRenderPreservesDataImageAndWrapperHtml() {
        TableWidgetRenderer renderer = new TableWidgetRenderer();

        ObjectNode props = JsonNodeFactory.instance.objectNode();
        ArrayNode rows = props.putArray("rows");

        ObjectNode row = rows.addObject();
        row.put("id", "r1");
        ArrayNode cells = row.putArray("cells");
        ObjectNode cell = cells.addObject();
        cell.put("id", "c1");
        cell.put("contentHtml",
            "<div>Hello " +
                "<span class=\"tw-resizable-image tw-resizable-image--left\" style=\"width: 120px;\">" +
                    "<img src=\"data:image/png;base64,AAAA\" alt=\"logo\" />" +
                "</span> " +
                "world</div>"
        );
        cell.putNull("merge");
        cell.putNull("coveredBy");

        String out = renderer.render(props, "");
        assertTrue(out.contains("tw-resizable-image"), "Expected output to contain resizable image wrapper");
        assertTrue(out.contains("data:image/png"), "Expected output to contain embedded data:image src");
        assertTrue(out.contains("style=\"width: 120px;\""), "Expected output to preserve inline width for PDF fidelity");
    }

    @Test
    void editastraRenderPreservesDataImageAndWrapperHtml() {
        EditastraWidgetRenderer renderer = new EditastraWidgetRenderer();

        ObjectNode props = JsonNodeFactory.instance.objectNode();
        props.put("contentHtml",
            "<div>Hi " +
                "<span class=\"tw-resizable-image tw-resizable-image--inline\" style=\"width: 4em;\">" +
                    "<img src=\"data:image/jpeg;base64,AAAA\" alt=\"photo\" />" +
                "</span></div>"
        );

        String out = renderer.render(props, "");
        assertTrue(out.contains("tw-resizable-image"), "Expected output to contain resizable image wrapper");
        assertTrue(out.contains("data:image/jpeg"), "Expected output to contain embedded data:image src");
        assertTrue(out.contains("style=\"width: 4em;\""), "Expected output to preserve inline width for PDF fidelity");
    }
}


