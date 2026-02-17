package com.org.report_generator.service.renderer;

import com.org.report_generator.model.document.BackgroundSpec;
import com.org.report_generator.model.document.DocumentModel;
import com.org.report_generator.model.document.Page;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

@Service
public class SlideThemeStyleResolver {

    private static final String DEFAULT_LAYOUT_TYPE = "blank";

    public String buildSurfaceStyle(DocumentModel document, Page page) {
        ThemeResolution resolution = resolveTheme(document, page);
        VariantDef variant = resolution.variant();

        String background = variant.surfaceBackground();
        BackgroundSpec backgroundSpec = page != null ? page.getBackground() : null;
        if (backgroundSpec != null && backgroundSpec.getValue() != null && !backgroundSpec.getValue().isBlank()) {
            String type = normalize(backgroundSpec.getType());
            if ("image".equals(type)) {
                background = null;
            } else if ("color".equals(type) || "gradient".equals(type)) {
                background = backgroundSpec.getValue().trim();
            }
        }

        String tableBorder = withAlpha(variant.accentColor(), "80", "rgba(15, 23, 42, 0.28)");
        String tableSubBorder = withAlpha(variant.accentColor(), "66", "rgba(15, 23, 42, 0.20)");
        String tableHover = withAlpha(variant.accentColor(), "1A", "rgba(15, 23, 42, 0.06)");
        String tableHeaderBg = withAlpha(variant.accentColor(), "24", "#dbeafe");
        String tableTotalBg = withAlpha(variant.accentColor(), "14", "#eef2f7");
        String tableEdgeBg = withAlpha(variant.accentColor(), "1A", "#f1f5f9");
        String placeholderColor = withAlpha(variant.surfaceForeground(), "B3", "rgba(100, 116, 139, 0.85)");
        String placeholderFill = withAlpha(variant.accentColor(), "14", "transparent");
        String reverseColor = reverseReadableColor(variant.surfaceForeground());

        StringBuilder style = new StringBuilder();

        if (background != null && !background.isBlank()) {
            style.append("background: ").append(background).append(";");
        }

        if (backgroundSpec != null
                && "image".equals(normalize(backgroundSpec.getType()))
                && backgroundSpec.getValue() != null
                && !backgroundSpec.getValue().isBlank()) {
            style.append("background-image: url('")
                    .append(backgroundSpec.getValue().trim())
                    .append("');");
            style.append("background-size: cover;");
            style.append("background-position: center;");
            style.append("background-repeat: no-repeat;");
        }

        style.append("color: ").append(variant.surfaceForeground()).append(";");
        style.append("font-family: ").append(variant.fontFamily()).append(";");
        style.append("font-size: ").append(variant.fontSize()).append(";");

        style.append("--slide-foreground: ").append(variant.surfaceForeground()).append(";");
        style.append("--slide-accent: ").append(variant.accentColor()).append(";");
        style.append("--slide-editor-color: ").append(variant.surfaceForeground()).append(";");
        style.append("--slide-editor-font-family: ").append(variant.fontFamily()).append(";");
        style.append("--slide-editor-font-size: ").append(variant.fontSize()).append(";");
        style.append("--slide-title-font-family: ").append(variant.titleFontFamily()).append(";");
        style.append("--slide-title-font-size: ").append(variant.titleFontSize()).append(";");
        style.append("--slide-title-font-weight: ").append(variant.titleFontWeight()).append(";");
        style.append("--slide-placeholder-color: ").append(placeholderColor).append(";");
        style.append("--slide-placeholder-fill: ").append(placeholderFill).append(";");
        style.append("--slide-reverse-color: ").append(reverseColor).append(";");
        style.append("--slide-table-border: ").append(tableBorder).append(";");
        style.append("--slide-table-sub-border: ").append(tableSubBorder).append(";");
        style.append("--slide-table-hover: ").append(tableHover).append(";");
        style.append("--slide-table-header-bg: ").append(tableHeaderBg).append(";");
        style.append("--slide-table-total-bg: ").append(tableTotalBg).append(";");
        style.append("--slide-table-edge-bg: ").append(tableEdgeBg).append(";");
        style.append("--slide-table-font-size: 14px;");
        style.append("--slide-theme-overlay-soft: ").append(variant.overlaySoftColor()).append(";");
        style.append("--slide-theme-overlay-strong: ").append(variant.overlayStrongColor()).append(";");
        style.append("--slide-theme-tab: ").append(variant.tabColor()).append(";");

        return style.toString();
    }

    public String buildSurfaceClasses(DocumentModel document, Page page) {
        ThemeResolution resolution = resolveTheme(document, page);
        String themeClass = "theme-" + sanitizeClassToken(resolution.theme().id());
        String variantClass = "variant-" + sanitizeClassToken(resolution.variant().id());
        String layoutClass = "layout-" + sanitizeClassToken(resolution.layout());
        return themeClass + " " + variantClass + " " + layoutClass;
    }

    private ThemeResolution resolveTheme(DocumentModel document, Page page) {
        String layout = DEFAULT_LAYOUT_TYPE;

        if (document != null && document.getMetadata() != null) {
            Object defaultLayoutRaw = document.getMetadata().get("defaultSlideLayoutType");
            if (defaultLayoutRaw instanceof String l && !l.isBlank()) {
                layout = normalize(l);
            }
        }

        if (page != null && page.getSlideLayoutType() != null && !page.getSlideLayoutType().isBlank()) {
            layout = normalize(page.getSlideLayoutType());
        }

        ThemeDef theme = resolveThemeFromMetadata(document);

        VariantDef variant;
        if (page != null && page.getSlideVariantId() != null && !page.getSlideVariantId().isBlank()) {
            variant = theme.variantsById().get(normalize(page.getSlideVariantId()));
            if (variant == null) {
                throw new IllegalStateException("slideThemeResolved does not contain page variant: " + page.getSlideVariantId());
            }
        } else {
            variant = theme.defaultVariant();
        }

        return new ThemeResolution(theme, variant, layout);
    }

    @SuppressWarnings("unchecked")
    private ThemeDef resolveThemeFromMetadata(DocumentModel document) {
        if (document == null || document.getMetadata() == null) {
            throw new IllegalStateException("Document metadata is required for slide theme resolution");
        }

        Object resolvedThemeRaw = document.getMetadata().get("slideThemeResolved");
        if (!(resolvedThemeRaw instanceof Map<?, ?> resolvedThemeMap)) {
            throw new IllegalStateException("Document metadata.slideThemeResolved is required");
        }

        String themeId = requiredString(resolvedThemeMap, "themeId");
        String defaultVariantId = requiredString(resolvedThemeMap, "defaultVariantId");

        Object variantsRaw = resolvedThemeMap.get("variants");
        if (!(variantsRaw instanceof Map<?, ?> variantsMap)) {
            throw new IllegalStateException("Document metadata.slideThemeResolved.variants must be an object");
        }

        Map<String, VariantDef> variantsById = new LinkedHashMap<>();
        for (Map.Entry<?, ?> entry : variantsMap.entrySet()) {
            if (!(entry.getValue() instanceof Map<?, ?> variantMap)) {
                continue;
            }
            VariantDef variant = variantFromMap((Map<String, Object>) variantMap);
            variantsById.put(normalize(variant.id()), variant);
        }

        if (variantsById.isEmpty()) {
            throw new IllegalStateException("Document metadata.slideThemeResolved.variants cannot be empty");
        }

        return new ThemeDef(themeId, variantsById, defaultVariantId);
    }

    private VariantDef variantFromMap(Map<String, Object> raw) {
        String id = requiredString(raw, "id");
        String surfaceBackground = requiredString(raw, "surfaceBackground");
        String surfaceForeground = requiredString(raw, "surfaceForeground");
        String fontFamily = requiredString(raw, "fontFamily");
        String fontSize = requiredString(raw, "fontSize");
        String titleFontFamily = requiredString(raw, "titleFontFamily");
        String titleFontSize = requiredString(raw, "titleFontSize");
        String titleFontWeight = requiredString(raw, "titleFontWeight");
        String accentColor = requiredString(raw, "accentColor");
        String overlaySoftColor = requiredString(raw, "overlaySoftColor");
        String overlayStrongColor = requiredString(raw, "overlayStrongColor");
        String tabColor = requiredString(raw, "tabColor");

        return new VariantDef(
                id,
                surfaceBackground,
                surfaceForeground,
                fontFamily,
                fontSize,
                titleFontFamily,
                titleFontSize,
                titleFontWeight,
                accentColor,
                overlaySoftColor,
                overlayStrongColor,
                tabColor
        );
    }

    private static String requiredString(Map<?, ?> map, String key) {
        Object value = map.get(key);
        if (value == null) {
            throw new IllegalStateException("Missing required theme field: " + key);
        }

        String s = String.valueOf(value).trim();
        if (s.isBlank()) {
            throw new IllegalStateException("Theme field is blank: " + key);
        }

        return s;
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private static String withAlpha(String color, String alphaHex, String fallback) {
        if (color == null || color.isBlank()) return fallback;
        String normalized = color.trim();
        if (normalized.matches("^#([A-Fa-f0-9]{6})$")) {
            return normalized + alphaHex;
        }
        if (normalized.matches("^#([A-Fa-f0-9]{3})$")) {
            String expanded = "#"
                    + normalized.charAt(1) + normalized.charAt(1)
                    + normalized.charAt(2) + normalized.charAt(2)
                    + normalized.charAt(3) + normalized.charAt(3);
            return expanded + alphaHex;
        }
        return fallback;
    }

    private static String reverseReadableColor(String foreground) {
        if (foreground == null || !foreground.trim().matches("^#([A-Fa-f0-9]{6})$")) {
            return "#0f172a";
        }

        String hex = foreground.trim().substring(1);
        int r = Integer.parseInt(hex.substring(0, 2), 16);
        int g = Integer.parseInt(hex.substring(2, 4), 16);
        int b = Integer.parseInt(hex.substring(4, 6), 16);
        double luma = (0.299d * r) + (0.587d * g) + (0.114d * b);
        return luma < 140d ? "#ffffff" : "#0f172a";
    }

    private static String sanitizeClassToken(String value) {
        if (value == null || value.isBlank()) return "default";
        return value.toLowerCase(Locale.ROOT).replace('_', '-').replaceAll("[^a-z0-9-]", "-");
    }

    private record VariantDef(
            String id,
            String surfaceBackground,
            String surfaceForeground,
            String fontFamily,
            String fontSize,
            String titleFontFamily,
            String titleFontSize,
            String titleFontWeight,
            String accentColor,
            String overlaySoftColor,
            String overlayStrongColor,
            String tabColor
    ) {
    }

    private record ThemeDef(
            String id,
            Map<String, VariantDef> variantsById,
            String defaultVariantId
    ) {
        VariantDef defaultVariant() {
            VariantDef variant = variantsById.get(normalize(defaultVariantId));
            if (variant == null) {
                throw new IllegalStateException("slideThemeResolved.defaultVariantId is not present in variants: " + defaultVariantId);
            }
            return variant;
        }
    }

    private record ThemeResolution(ThemeDef theme, VariantDef variant, String layout) {
    }
}
