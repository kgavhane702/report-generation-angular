package com.org.report_generator.render.util;

/**
 * Normalizes UI shapeType strings so DOCX and PPTX renderers stay equivalent.
 */
public final class ShapeKeyUtil {

    private ShapeKeyUtil() {
    }

    /**
     * Returns a canonical shape key (lowercase, trimmed).
     */
    public static String canonicalize(String shapeType) {
        if (shapeType == null) return null;
        String key = shapeType.trim().toLowerCase();
        if (key.isEmpty()) return null;
        return key;
    }
}
