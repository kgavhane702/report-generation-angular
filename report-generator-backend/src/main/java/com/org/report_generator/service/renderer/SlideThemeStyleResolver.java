package com.org.report_generator.service.renderer;

import com.org.report_generator.model.document.BackgroundSpec;
import com.org.report_generator.model.document.DocumentModel;
import com.org.report_generator.model.document.Page;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

@Service
public class SlideThemeStyleResolver {

    private static final String DEFAULT_THEME_ID = "berlin_orange";
    private static final String DEFAULT_LAYOUT_TYPE = "title_slide";

    private static final Map<String, ThemeDef> THEMES = buildThemes();

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
        String themeId = DEFAULT_THEME_ID;
        String layout = DEFAULT_LAYOUT_TYPE;

        if (document != null && document.getMetadata() != null) {
            Object themeRaw = document.getMetadata().get("slideThemeId");
            if (themeRaw instanceof String t && !t.isBlank()) {
                themeId = normalize(t);
            }

            Object defaultLayoutRaw = document.getMetadata().get("defaultSlideLayoutType");
            if (defaultLayoutRaw instanceof String l && !l.isBlank()) {
                layout = normalize(l);
            }
        }

        if (page != null && page.getSlideLayoutType() != null && !page.getSlideLayoutType().isBlank()) {
            layout = normalize(page.getSlideLayoutType());
        }

        ThemeDef theme = THEMES.getOrDefault(themeId, THEMES.get(DEFAULT_THEME_ID));

        VariantDef variant = null;
        if (page != null && page.getSlideVariantId() != null && !page.getSlideVariantId().isBlank()) {
            variant = theme.variantsById().get(normalize(page.getSlideVariantId()));
        }

        if (variant == null) {
            String mappedVariantId = theme.layoutVariantMap().getOrDefault(layout, null);
            if (mappedVariantId != null) {
                variant = theme.variantsById().get(normalize(mappedVariantId));
            }
        }

        if (variant == null) {
            variant = theme.defaultVariant();
        }

        return new ThemeResolution(theme, variant, layout);
    }

    private static Map<String, ThemeDef> buildThemes() {
        Map<String, ThemeDef> map = new HashMap<>();

        map.put("berlin_orange", new ThemeDef(
                "berlin_orange",
                variants(
                        variant("A1", "linear-gradient(90deg, #f97316 0%, #dc2626 100%)", "#ffffff", "'Segoe UI', 'Inter', sans-serif", "16px", "'Segoe UI Semibold', 'Segoe UI', sans-serif", "32px", "700", "#111827")
                ),
                layoutMap(allLayouts("A1")),
                "A1"
        ));

        map.put("minimal_slate", new ThemeDef(
                "minimal_slate",
                variants(
                        variant("B1", "linear-gradient(135deg, #334155 0%, #1e293b 100%)", "#f8fafc", "'Inter', 'Segoe UI', sans-serif", "15px", "'Inter', 'Segoe UI', sans-serif", "34px", "700", "#94a3b8"),
                        variant("B2", "#ffffff", "#0f172a", "'Inter', 'Segoe UI', sans-serif", "15px", "'Inter', 'Segoe UI', sans-serif", "28px", "600", "#475569")
                ),
                layoutMap(mapOf(
                        "title_slide", "B1",
                        "section_header", "B1",
                        "title_and_content", "B2",
                        "two_content", "B2",
                        "comparison", "B2",
                        "title_only", "B2",
                        "blank", "B2"
                )),
                "B1"
        ));

        map.put("ocean_blue", new ThemeDef(
                "ocean_blue",
                variants(
                        variant("C1", "linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)", "#0b2545", "'Calibri', 'Segoe UI', sans-serif", "16px", "'Calibri', 'Segoe UI', sans-serif", "30px", "700", "#1d4ed8"),
                        variant("C2", "linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)", "#f8fafc", "'Calibri', 'Segoe UI', sans-serif", "16px", "'Calibri', 'Segoe UI', sans-serif", "34px", "700", "#60a5fa")
                ),
                layoutMap(mapOf(
                        "title_slide", "C2",
                        "section_header", "C2",
                        "title_and_content", "C1",
                        "title_only", "C1",
                        "comparison", "C1",
                        "two_content", "C1",
                        "blank", "C1"
                )),
                "C1"
        ));

        map.put("emerald_forest", new ThemeDef(
                "emerald_forest",
                variants(
                        variant("D1", "linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)", "#052e16", "'Aptos', 'Inter', sans-serif", "15px", "'Aptos', 'Inter', sans-serif", "28px", "600", "#047857"),
                        variant("D2", "linear-gradient(135deg, #064e3b 0%, #022c22 100%)", "#ecfdf5", "'Aptos', 'Inter', sans-serif", "15px", "'Aptos', 'Inter', sans-serif", "34px", "700", "#34d399")
                ),
                layoutMap(mapOf(
                        "title_slide", "D2",
                        "section_header", "D2",
                        "title_and_content", "D1",
                        "title_only", "D1",
                        "comparison", "D1",
                        "two_content", "D1",
                        "blank", "D1"
                )),
                "D1"
        ));

        map.put("royal_purple", new ThemeDef(
                "royal_purple",
                variants(
                        variant("E1", "linear-gradient(135deg, #f3e8ff 0%, #ddd6fe 100%)", "#2e1065", "'Cambria', 'Georgia', serif", "16px", "'Georgia', 'Cambria', serif", "30px", "700", "#7c3aed"),
                        variant("E2", "linear-gradient(135deg, #4c1d95 0%, #2e1065 100%)", "#faf5ff", "'Cambria', 'Georgia', serif", "16px", "'Georgia', 'Cambria', serif", "34px", "700", "#c4b5fd"),
                        variant("E3", "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)", "#ffffff", "'Cambria', 'Georgia', serif", "16px", "'Georgia', 'Cambria', serif", "28px", "600", "#e9d5ff")
                ),
                layoutMap(mapOf(
                        "title_slide", "E2",
                        "section_header", "E2",
                        "title_and_content", "E1",
                        "title_only", "E1",
                        "comparison", "E3",
                        "two_content", "E1",
                        "blank", "E1"
                )),
                "E1"
        ));

        map.put("sunset_rose", new ThemeDef(
                "sunset_rose",
                variants(
                        variant("F1", "linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)", "#4c0519", "'Trebuchet MS', 'Verdana', sans-serif", "15px", "'Trebuchet MS', 'Verdana', sans-serif", "28px", "700", "#e11d48"),
                        variant("F2", "linear-gradient(135deg, #be123c 0%, #7f1d1d 100%)", "#fff1f2", "'Trebuchet MS', 'Verdana', sans-serif", "15px", "'Trebuchet MS', 'Verdana', sans-serif", "34px", "700", "#fb7185")
                ),
                layoutMap(mapOf(
                        "title_slide", "F2",
                        "section_header", "F2",
                        "title_and_content", "F1",
                        "title_only", "F1",
                        "comparison", "F1",
                        "two_content", "F1",
                        "blank", "F1"
                )),
                "F1"
        ));

        map.put("curvy_magenta", new ThemeDef(
                "curvy_magenta",
                variants(
                        variant("G1", "radial-gradient(120% 180% at 50% 25%, #8a3f79 0%, #5c2e73 40%, #262457 100%)", "#e5e7eb", "'Segoe UI', 'Inter', sans-serif", "16px", "'Segoe UI', 'Inter', sans-serif", "48px", "600", "#c71585"),
                        variant("G2", "radial-gradient(160% 110% at 50% -8%, #8a3f79 0%, #5c2e73 48%, #262457 72%, transparent 73%) top/100% 52% no-repeat, #f8fafc", "#0f172a", "'Segoe UI', 'Inter', sans-serif", "15px", "'Segoe UI', 'Inter', sans-serif", "30px", "700", "#c71585"),
                        variant("G3", "#f8fafc", "#0f172a", "'Segoe UI', 'Inter', sans-serif", "15px", "'Segoe UI', 'Inter', sans-serif", "28px", "600", "#c71585")
                ),
                layoutMap(mapOf(
                        "title_slide", "G1",
                        "section_header", "G1",
                        "title_and_content", "G2",
                        "title_only", "G2",
                        "two_content", "G2",
                        "comparison", "G2",
                        "blank", "G3"
                )),
                "G1"
        ));

        return map;
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

    private static Map<String, VariantDef> variants(VariantDef... variants) {
        Map<String, VariantDef> map = new LinkedHashMap<>();
        for (VariantDef v : variants) {
            map.put(normalize(v.id()), v);
        }
        return map;
    }

    private static VariantDef variant(
            String id,
            String surfaceBackground,
            String surfaceForeground,
            String fontFamily,
            String fontSize,
            String titleFontFamily,
            String titleFontSize,
            String titleFontWeight,
            String accentColor
    ) {
        return new VariantDef(
                id,
                surfaceBackground,
                surfaceForeground,
                fontFamily,
                fontSize,
                titleFontFamily,
                titleFontSize,
                titleFontWeight,
                accentColor
        );
    }

    private static Map<String, String> layoutMap(Map<String, String> input) {
        Map<String, String> out = new HashMap<>();
        for (Map.Entry<String, String> e : input.entrySet()) {
            out.put(normalize(e.getKey()), normalize(e.getValue()));
        }
        return out;
    }

    private static Map<String, String> allLayouts(String variantId) {
        return mapOf(
                "title_slide", variantId,
                "title_and_content", variantId,
                "section_header", variantId,
                "title_only", variantId,
                "comparison", variantId,
                "two_content", variantId,
                "blank", variantId
        );
    }

    private static Map<String, String> mapOf(String... kv) {
        Map<String, String> map = new LinkedHashMap<>();
        for (int i = 0; i < kv.length - 1; i += 2) {
            map.put(kv[i], kv[i + 1]);
        }
        return map;
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
            String accentColor
    ) {
    }

    private record ThemeDef(
            String id,
            Map<String, VariantDef> variantsById,
            Map<String, String> layoutVariantMap,
            String defaultVariantId
    ) {
        VariantDef defaultVariant() {
            VariantDef v = variantsById.get(normalize(defaultVariantId));
            if (v != null) return v;
            return variantsById.values().stream().findFirst()
                    .orElse(new VariantDef(
                            "DEFAULT",
                            "#ffffff",
                            "#0f172a",
                            "'Inter', 'Segoe UI', sans-serif",
                            "16px",
                            "'Inter', 'Segoe UI', sans-serif",
                            "28px",
                            "700",
                            "#0f172a"
                    ));
        }
    }

    private record ThemeResolution(ThemeDef theme, VariantDef variant, String layout) {
    }
}
