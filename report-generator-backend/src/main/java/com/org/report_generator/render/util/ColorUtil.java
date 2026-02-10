package com.org.report_generator.render.util;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Shared color normalization: converts #hex, rgb(), rgba(), hsl(), hsla() to 6-char uppercase hex.
 */
public final class ColorUtil {

    private ColorUtil() {}

    private static final Pattern HSL_RE = Pattern.compile(
            "hsla?\\(\\s*([\\d.]+)\\s*,\\s*([\\d.]+)%\\s*,\\s*([\\d.]+)%\\s*(?:,\\s*[\\d.]+\\s*)?\\)",
            Pattern.CASE_INSENSITIVE);

    private static final Pattern RGB_RE = Pattern.compile(
            "rgba?\\(\\s*([\\d.]+)\\s*,\\s*([\\d.]+)\\s*,\\s*([\\d.]+)\\s*(?:,\\s*[\\d.]+\\s*)?\\)",
            Pattern.CASE_INSENSITIVE);

    /**
     * Normalize any CSS color value to a 6-char uppercase hex string (no '#' prefix).
     * Returns null if the value is unrecognized or transparent.
     */
    public static String normalizeColor(String value) {
        if (value == null) return null;
        String v = value.trim().toLowerCase(Locale.ROOT);
        if (v.isEmpty() || "transparent".equals(v) || "none".equals(v)) return null;

        // #hex
        if (v.startsWith("#")) {
            String hex = v.substring(1);
            if (hex.length() == 3) {
                return ("" + hex.charAt(0) + hex.charAt(0)
                        + hex.charAt(1) + hex.charAt(1)
                        + hex.charAt(2) + hex.charAt(2)).toUpperCase(Locale.ROOT);
            }
            if (hex.length() == 6) return hex.toUpperCase(Locale.ROOT);
            if (hex.length() == 8) return hex.substring(0, 6).toUpperCase(Locale.ROOT);
        }

        // hsl() / hsla()
        Matcher hm = HSL_RE.matcher(v);
        if (hm.find()) {
            double h = Double.parseDouble(hm.group(1));
            double s = Double.parseDouble(hm.group(2)) / 100.0;
            double l = Double.parseDouble(hm.group(3)) / 100.0;
            return hslToHex(h, s, l);
        }

        // rgb() / rgba()
        Matcher rm = RGB_RE.matcher(v);
        if (rm.find()) {
            int r = clamp((int) Double.parseDouble(rm.group(1)));
            int g = clamp((int) Double.parseDouble(rm.group(2)));
            int b = clamp((int) Double.parseDouble(rm.group(3)));
            return String.format("%02X%02X%02X", r, g, b);
        }

        // Named colors (most common)
        return switch (v) {
            case "black" -> "000000";
            case "white" -> "FFFFFF";
            case "red" -> "FF0000";
            case "green" -> "008000";
            case "blue" -> "0000FF";
            case "yellow" -> "FFFF00";
            case "gray", "grey" -> "808080";
            default -> null;
        };
    }

    private static String hslToHex(double h, double s, double l) {
        double c = (1.0 - Math.abs(2.0 * l - 1.0)) * s;
        double hp = h / 60.0;
        double x = c * (1.0 - Math.abs(hp % 2.0 - 1.0));
        double r1, g1, b1;
        if (hp < 1) { r1 = c; g1 = x; b1 = 0; }
        else if (hp < 2) { r1 = x; g1 = c; b1 = 0; }
        else if (hp < 3) { r1 = 0; g1 = c; b1 = x; }
        else if (hp < 4) { r1 = 0; g1 = x; b1 = c; }
        else if (hp < 5) { r1 = x; g1 = 0; b1 = c; }
        else { r1 = c; g1 = 0; b1 = x; }
        double m = l - c / 2.0;
        int r = clamp((int) Math.round((r1 + m) * 255));
        int g = clamp((int) Math.round((g1 + m) * 255));
        int b = clamp((int) Math.round((b1 + m) * 255));
        return String.format("%02X%02X%02X", r, g, b);
    }

    private static int clamp(int v) {
        return Math.max(0, Math.min(255, v));
    }
}
