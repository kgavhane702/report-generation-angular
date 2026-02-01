package com.org.report_generator.render.pptx;

import com.org.report_generator.model.document.Widget;

public interface PptxWidgetRenderer {
    String widgetType();
    
    /**
     * Renders a widget onto the PowerPoint slide.
     * @param widget The widget model containing properties and style
     * @param ctx The context containing the POI slide show and current slide
     */
    void render(Widget widget, PptxRenderContext ctx);
}
