package com.org.report_generator.render.util;

import com.org.report_generator.model.document.PageSize;

import java.util.Optional;

public final class PageSizeUtil {

    private PageSizeUtil() {}

    public record OrientedSizeMm(double widthMm, double heightMm, boolean portrait) {}

    public static OrientedSizeMm orientedMm(PageSize base, String orientation) {
        PageSize pageSize = Optional.ofNullable(base).orElseGet(PageSize::new);
        double baseWidth = Optional.ofNullable(pageSize.getWidthMm()).orElse(254d);
        double baseHeight = Optional.ofNullable(pageSize.getHeightMm()).orElse(190.5d);

        boolean portrait = orientation != null && orientation.equalsIgnoreCase("portrait");
        double min = Math.min(baseWidth, baseHeight);
        double max = Math.max(baseWidth, baseHeight);
        return portrait ? new OrientedSizeMm(min, max, true) : new OrientedSizeMm(max, min, false);
    }

    public static int mmToPointsInt(double mm) {
        return (int) Math.round(mm * 72.0 / 25.4);
    }

    public static long mmToTwips(double mm) {
        return Math.round(mm * 1440d / 25.4d);
    }
}
