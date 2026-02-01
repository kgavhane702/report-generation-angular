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

@Component
public class PptxImageWidgetRenderer implements PptxWidgetRenderer {

    @Override
    public String widgetType() {
        return "image";
    }

    @Override
    public void render(Widget widget, PptxRenderContext ctx) {
        if (widget == null || widget.getProps() == null) return;

        JsonNode props = widget.getProps();
        String src = props.path("src").asText("");
        
        if (src.isBlank()) return;

        try {
            byte[] imageBytes;
            PictureData.PictureType pictureType;

            if (src.startsWith("data:")) {
                // Base64 encoded image
                int commaIdx = src.indexOf(',');
                if (commaIdx < 0) return;
                
                String mimeType = src.substring(5, src.indexOf(';'));
                String base64Data = src.substring(commaIdx + 1);
                imageBytes = Base64.getDecoder().decode(base64Data);
                pictureType = mapMimeType(mimeType);
            } else {
                // URL - skip for now, would need HTTP fetch
                return;
            }

            if (imageBytes == null || imageBytes.length == 0) return;

            // Add picture to presentation
            XSLFPictureData pictureData = ctx.pptx().addPicture(imageBytes, pictureType);

            // Get position and size (converted from CSS pixels to points)
            Rectangle2D anchor = PptxPositioningUtil.getAnchor(widget);

            // Create picture shape on slide
            XSLFPictureShape picture = ctx.slide().createPicture(pictureData);
            picture.setAnchor(anchor);

        } catch (Exception e) {
            System.err.println("Failed to render image in PPTX: " + e.getMessage());
        }
    }

    private PictureData.PictureType mapMimeType(String mimeType) {
        if (mimeType == null) return PictureData.PictureType.PNG;
        return switch (mimeType.toLowerCase()) {
            case "image/jpeg", "image/jpg" -> PictureData.PictureType.JPEG;
            case "image/gif" -> PictureData.PictureType.GIF;
            case "image/bmp" -> PictureData.PictureType.BMP;
            case "image/tiff" -> PictureData.PictureType.TIFF;
            case "image/svg+xml" -> PictureData.PictureType.SVG;
            default -> PictureData.PictureType.PNG;
        };
    }
}
