package com.org.report_generator.render.docx;

import com.fasterxml.jackson.databind.JsonNode;
import com.org.report_generator.model.document.Widget;

public interface DocxWidgetRenderer {
    String widgetType();
    
    /**
     * Renders a widget into the Docx document.
     * @param widget The widget model containing properties and style
     * @param ctx The context containing the POI document
     */
    void render(Widget widget, DocxRenderContext ctx);
}
