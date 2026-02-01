package com.org.report_generator.render.pptx;

import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Component
public class PptxWidgetRendererRegistry {
    
    private final Map<String, PptxWidgetRenderer> renderers = new HashMap<>();

    public PptxWidgetRendererRegistry(List<PptxWidgetRenderer> rendererList) {
        for (PptxWidgetRenderer renderer : rendererList) {
            renderers.put(renderer.widgetType().toLowerCase(), renderer);
        }
    }

    public PptxWidgetRenderer getRenderer(String widgetType) {
        return renderers.get(widgetType != null ? widgetType.toLowerCase() : "");
    }
}
