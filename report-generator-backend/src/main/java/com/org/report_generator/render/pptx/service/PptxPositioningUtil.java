package com.org.report_generator.render.pptx.service;

import com.org.report_generator.model.document.Widget;
import com.org.report_generator.model.document.WidgetPosition;
import com.org.report_generator.model.document.WidgetSize;

import java.awt.geom.Rectangle2D;

/**
 * Utility for converting widget positions/sizes from CSS pixels (96 dpi)
 * to PowerPoint points (72 dpi).
 * 
 * Frontend uses 96 dpi CSS pixels for widget coordinates.
 * PowerPoint uses 72 dpi points for shape anchors.
 * Conversion factor: 72/96 = 0.75
 */
public final class PptxPositioningUtil {

    private PptxPositioningUtil() {}

    // 96 dpi CSS pixels to 72 dpi points
    private static final double PX_TO_PT = 72.0 / 96.0; // = 0.75

    /**
     * Convert widget position and size to a Rectangle2D in points.
     */
    public static Rectangle2D getAnchor(Widget widget) {
        WidgetPosition pos = widget != null ? widget.getPosition() : null;
        WidgetSize size = widget != null ? widget.getSize() : null;
        
        double xPx = pos != null && pos.getX() != null ? pos.getX() : 0;
        double yPx = pos != null && pos.getY() != null ? pos.getY() : 0;
        double wPx = size != null && size.getWidth() != null ? size.getWidth() : 100;
        double hPx = size != null && size.getHeight() != null ? size.getHeight() : 50;
        
        return new Rectangle2D.Double(
            toPoints(xPx),
            toPoints(yPx),
            toPoints(wPx),
            toPoints(hPx)
        );
    }

    /**
     * Convert CSS pixels to PowerPoint points.
     */
    public static double toPoints(double px) {
        return px * PX_TO_PT;
    }

    /**
     * Convert CSS pixels to PowerPoint points, with default.
     */
    public static double toPoints(Double px, double defaultPx) {
        return (px != null ? px : defaultPx) * PX_TO_PT;
    }
}
