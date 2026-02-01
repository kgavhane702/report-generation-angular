package com.org.report_generator.render.docx.widgets;

import com.org.report_generator.model.document.Widget;
import com.org.report_generator.render.docx.DocxRenderContext;
import com.org.report_generator.render.docx.DocxWidgetRenderer;
import com.org.report_generator.render.docx.service.DocxTableGenerationService;
import com.org.report_generator.render.docx.service.DocxPositioningUtil;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.springframework.stereotype.Component;

@Component
public class DocxTableWidgetRenderer implements DocxWidgetRenderer {

    private final DocxTableGenerationService tableService;

    public DocxTableWidgetRenderer(DocxTableGenerationService tableService) {
        this.tableService = tableService;
    }

    @Override
    public String widgetType() {
        return "table";
    }

    @Override
    public void render(Widget widget, DocxRenderContext ctx) {
        // Create a table in the document
        // Note: Logic to position needs to be handled.
        // If flow layout, just create table.
        XWPFTable table = ctx.docx().createTable();
        DocxPositioningUtil.applyTablePosition(table, widget);
        tableService.generateTable(table, widget.getProps());
    }
}
