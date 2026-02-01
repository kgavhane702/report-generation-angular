package com.org.report_generator.render.docx;

import org.springframework.stereotype.Component;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Component
public class DocxWidgetRendererRegistry {
    private final Map<String, DocxWidgetRenderer> renderers;

    public DocxWidgetRendererRegistry(List<DocxWidgetRenderer> rendererList) {
        this.renderers = rendererList.stream()
                .collect(Collectors.toMap(DocxWidgetRenderer::widgetType, Function.identity()));
    }

    public DocxWidgetRenderer getRenderer(String type) {
        return renderers.get(type);
    }
}
