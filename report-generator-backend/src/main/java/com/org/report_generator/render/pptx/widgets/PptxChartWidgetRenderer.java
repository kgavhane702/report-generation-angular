package com.org.report_generator.render.pptx.widgets;

import com.fasterxml.jackson.databind.JsonNode;
import com.org.report_generator.model.document.Widget;
import com.org.report_generator.render.pptx.PptxRenderContext;
import com.org.report_generator.render.pptx.PptxWidgetRenderer;
import com.org.report_generator.render.pptx.service.PptxPositioningUtil;
import org.apache.poi.sl.usermodel.PictureData;
import org.apache.poi.xslf.usermodel.XSLFPictureData;
import org.apache.poi.xslf.usermodel.XSLFPictureShape;
import org.springframework.stereotype.Component;

import java.awt.geom.Rectangle2D;
import java.util.Base64;

/**
 * Renders charts in PPTX by using their exported image (base64).
 * Charts are captured as images in the frontend before export.
 */
@Component
public class PptxChartWidgetRenderer implements PptxWidgetRenderer {

    @Override
    public String widgetType() {
        return "chart";
    }

    @Override
    public void render(Widget widget, PptxRenderContext ctx) {
        if (widget == null || widget.getProps() == null) return;

        JsonNode props = widget.getProps();
        String src = props.path("exportedImage").asText("");
        
        if (src.isBlank() || !src.startsWith("data:image/")) return;

        try {
            int commaIdx = src.indexOf(',');
            if (commaIdx < 0) return;
            
            String meta = src.substring(0, commaIdx);
            String base64Data = src.substring(commaIdx + 1);
            byte[] imageBytes = Base64.getDecoder().decode(base64Data);
            
            if (imageBytes == null || imageBytes.length == 0) return;

            PictureData.PictureType pictureType = mapPictureType(meta);

            // Add picture to presentation
            XSLFPictureData pictureData = ctx.pptx().addPicture(imageBytes, pictureType);

            // Get position and size (converted from CSS pixels to points)
            Rectangle2D anchor = PptxPositioningUtil.getAnchor(widget);

            // Create picture shape on slide
            XSLFPictureShape picture = ctx.slide().createPicture(pictureData);
            picture.setAnchor(anchor);

        } catch (Exception e) {
            System.err.println("Failed to render chart in PPTX: " + e.getMessage());
        }
    }

    private PictureData.PictureType mapPictureType(String meta) {
        if (meta == null) return PictureData.PictureType.PNG;
        String lower = meta.toLowerCase();
        if (lower.contains("jpeg") || lower.contains("jpg")) return PictureData.PictureType.JPEG;
        if (lower.contains("gif")) return PictureData.PictureType.GIF;
        if (lower.contains("bmp")) return PictureData.PictureType.BMP;
        if (lower.contains("tiff")) return PictureData.PictureType.TIFF;
        return PictureData.PictureType.PNG;
    }
}
