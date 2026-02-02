package com.org.report_generator.render.docx.widgets;

import com.org.report_generator.model.document.Widget;
import com.org.report_generator.render.docx.DocxRenderContext;
import com.org.report_generator.render.docx.DocxWidgetRenderer;
import com.org.report_generator.render.docx.service.DocxDrawingUtil;
import org.apache.poi.xwpf.usermodel.Document;
import org.springframework.stereotype.Component;

import java.util.Base64;

@Component
public class DocxChartWidgetRenderer implements DocxWidgetRenderer {

    @Override
    public String widgetType() {
        return "chart";
    }

    @Override
    public void render(Widget widget, DocxRenderContext ctx) {
        if (widget.getProps() == null) return;
        String src = widget.getProps().path("exportedImage").asText("");
        if (src == null || src.isBlank()) return;
        if (!src.startsWith("data:image/")) return;

        try {
            int comma = src.indexOf(',');
            if (comma < 0) return;
            String meta = src.substring(0, comma);
            String base64 = src.substring(comma + 1);
            byte[] bytes = Base64.getDecoder().decode(base64);

            int pictureType = mapPictureType(meta);
            DocxDrawingUtil.createAnchoredImage(ctx.docx(), widget, bytes, pictureType, "Chart");
        } catch (Exception ignored) {
        }
    }

    private int mapPictureType(String meta) {
        String lower = meta.toLowerCase();
        if (lower.contains("png")) return Document.PICTURE_TYPE_PNG;
        if (lower.contains("jpeg") || lower.contains("jpg")) return Document.PICTURE_TYPE_JPEG;
        if (lower.contains("gif")) return Document.PICTURE_TYPE_GIF;
        if (lower.contains("bmp")) return Document.PICTURE_TYPE_BMP;
        if (lower.contains("tiff")) return Document.PICTURE_TYPE_TIFF;
        if (lower.contains("svg")) return Document.PICTURE_TYPE_PNG;
        return Document.PICTURE_TYPE_PNG;
    }
}
