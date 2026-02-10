package com.org.report_generator.render.util;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Element;
import org.jsoup.nodes.Node;
import org.jsoup.nodes.TextNode;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Shared HTML-to-rich-text parser used by both PPTX and DOCX DrawingML renderers.
 * Converts HTML content into a flat list of styled text runs, preserving:
 * bold, italic, underline, strikethrough, superscript, subscript,
 * font color, font size, font family, and background highlight.
 */
public final class HtmlRichTextParser {

    private HtmlRichTextParser() {}

    /** A single styled chunk of text. */
    public static class StyledRun {
        public final String text;
        public final boolean bold;
        public final boolean italic;
        public final boolean underline;
        public final boolean strike;
        public final boolean superscript;
        public final boolean subscript;
        public final String color;            // 6-char hex (no #), e.g. "FF0000"
        public final Integer fontSizePt;      // in points
        public final String fontFamily;
        public final String backgroundColor;  // 6-char hex (no #)
        public final boolean lineBreak;       // true = just a line-break marker

        public StyledRun(String text, RunStyle style, boolean lineBreak) {
            this.text = text;
            this.bold = style.bold;
            this.italic = style.italic;
            this.underline = style.underline;
            this.strike = style.strike;
            this.superscript = style.superscript;
            this.subscript = style.subscript;
            this.color = style.color;
            this.fontSizePt = style.fontSizePt;
            this.fontFamily = style.fontFamily;
            this.backgroundColor = style.backgroundColor;
            this.lineBreak = lineBreak;
        }
    }

    /** Mutable style accumulator. */
    public static class RunStyle {
        public boolean bold;
        public boolean italic;
        public boolean underline;
        public boolean strike;
        public boolean superscript;
        public boolean subscript;
        public String color;
        public Integer fontSizePt;
        public String fontFamily;
        public String backgroundColor;

        public RunStyle() {}

        public RunStyle copy() {
            RunStyle c = new RunStyle();
            c.bold = bold;
            c.italic = italic;
            c.underline = underline;
            c.strike = strike;
            c.superscript = superscript;
            c.subscript = subscript;
            c.color = color;
            c.fontSizePt = fontSizePt;
            c.fontFamily = fontFamily;
            c.backgroundColor = backgroundColor;
            return c;
        }

        public RunStyle merge(RunStyle child) {
            RunStyle m = this.copy();
            m.bold = m.bold || child.bold;
            m.italic = m.italic || child.italic;
            m.underline = m.underline || child.underline;
            m.strike = m.strike || child.strike;
            m.superscript = m.superscript || child.superscript;
            m.subscript = m.subscript || child.subscript;
            if (child.color != null) m.color = child.color;
            if (child.fontSizePt != null) m.fontSizePt = child.fontSizePt;
            if (child.fontFamily != null) m.fontFamily = child.fontFamily;
            if (child.backgroundColor != null) m.backgroundColor = child.backgroundColor;
            return m;
        }
    }

    /**
     * Parse HTML content into a flat list of styled runs.
     * Block-level elements (p, div, h1-h6, li) produce a line-break run between blocks.
     */
    public static List<StyledRun> parse(String html) {
        if (html == null || html.isBlank()) return List.of();
        Element body = Jsoup.parseBodyFragment(html).body();
        List<StyledRun> runs = new ArrayList<>();
        RunStyle base = new RunStyle();
        base.fontSizePt = 12;
        base.fontFamily = "Inter";
        walkNode(body, base, runs, false);
        // Trim trailing line-break
        while (!runs.isEmpty() && runs.get(runs.size() - 1).lineBreak) {
            runs.remove(runs.size() - 1);
        }
        return runs;
    }

    private static void walkNode(Node node, RunStyle inherited, List<StyledRun> runs, boolean needsBreakBefore) {
        if (node instanceof TextNode tn) {
            String text = tn.getWholeText();
            // Collapse whitespace like browser
            text = text.replaceAll("\\s+", " ");
            if (!text.isEmpty()) {
                runs.add(new StyledRun(text, inherited, false));
            }
            return;
        }
        if (!(node instanceof Element el)) return;

        String tag = el.tagName().toLowerCase(Locale.ROOT);
        RunStyle childStyle = inherited.merge(parseElementStyle(el));

        boolean isBlock = isBlockTag(tag);

        // Insert line-break before block elements (except the very first content)
        if (isBlock && !runs.isEmpty()) {
            // Only add break if last run wasn't already a break
            if (!runs.get(runs.size() - 1).lineBreak) {
                runs.add(new StyledRun("", inherited, true));
            }
        }

        if ("br".equals(tag)) {
            runs.add(new StyledRun("", inherited, true));
            return;
        }

        // List prefixes
        if ("li".equals(tag)) {
            Element parent = el.parent();
            if (parent != null && "ol".equals(parent.tagName().toLowerCase(Locale.ROOT))) {
                int idx = el.elementSiblingIndex() + 1;
                runs.add(new StyledRun(idx + ". ", childStyle, false));
            } else {
                runs.add(new StyledRun("• ", childStyle, false));
            }
        }

        for (Node child : el.childNodes()) {
            walkNode(child, childStyle, runs, false);
        }

        // Line-break after block
        if (isBlock) {
            if (!runs.isEmpty() && !runs.get(runs.size() - 1).lineBreak) {
                runs.add(new StyledRun("", inherited, true));
            }
        }
    }

    private static boolean isBlockTag(String tag) {
        return switch (tag) {
            case "p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "li", "ul", "ol", "blockquote" -> true;
            default -> false;
        };
    }

    private static RunStyle parseElementStyle(Element el) {
        RunStyle s = new RunStyle();
        String tag = el.tagName().toLowerCase(Locale.ROOT);

        // Tag-based formatting
        switch (tag) {
            case "strong", "b" -> s.bold = true;
            case "em", "i" -> s.italic = true;
            case "u" -> s.underline = true;
            case "s", "del", "strike" -> s.strike = true;
            case "sup" -> s.superscript = true;
            case "sub" -> s.subscript = true;
            case "mark" -> s.backgroundColor = "FFFF00";
            case "h1" -> { s.bold = true; s.fontSizePt = 24; }
            case "h2" -> { s.bold = true; s.fontSizePt = 20; }
            case "h3" -> { s.bold = true; s.fontSizePt = 18; }
            case "h4" -> { s.bold = true; s.fontSizePt = 16; }
            case "h5" -> { s.bold = true; s.fontSizePt = 14; }
            case "h6" -> { s.bold = true; s.fontSizePt = 12; }
            default -> {}
        }

        // Inline style parsing
        String styleAttr = el.attr("style");
        if (styleAttr != null && !styleAttr.isBlank()) {
            for (String rule : styleAttr.split(";")) {
                String[] kv = rule.split(":", 2);
                if (kv.length != 2) continue;
                String key = kv[0].trim().toLowerCase(Locale.ROOT);
                String val = kv[1].trim();
                switch (key) {
                    case "font-weight" -> {
                        String lv = val.toLowerCase(Locale.ROOT);
                        if (lv.contains("bold") || lv.matches("[6-9]00")) s.bold = true;
                    }
                    case "font-style" -> {
                        if (val.toLowerCase(Locale.ROOT).contains("italic")) s.italic = true;
                    }
                    case "text-decoration" -> {
                        String lv = val.toLowerCase(Locale.ROOT);
                        if (lv.contains("underline")) s.underline = true;
                        if (lv.contains("line-through")) s.strike = true;
                    }
                    case "color" -> s.color = ColorUtil.normalizeColor(val);
                    case "font-size" -> s.fontSizePt = parseFontSizePt(val);
                    case "font-family" -> s.fontFamily = parseFontFamily(val);
                    case "background-color", "background" -> s.backgroundColor = ColorUtil.normalizeColor(val);
                    default -> {}
                }
            }
        }
        return s;
    }

    private static Integer parseFontSizePt(String value) {
        try {
            String v = value.trim().toLowerCase(Locale.ROOT);
            if (v.endsWith("px")) {
                double px = Double.parseDouble(v.replace("px", "").trim());
                return (int) Math.round(px * 0.75);
            }
            if (v.endsWith("pt")) {
                return (int) Math.round(Double.parseDouble(v.replace("pt", "").trim()));
            }
        } catch (Exception ignored) {}
        return null;
    }

    private static String parseFontFamily(String value) {
        if (value == null || value.isBlank()) return null;
        String first = value.split(",")[0].trim();
        if (first.startsWith("\"") && first.endsWith("\"")) first = first.substring(1, first.length() - 1);
        if (first.startsWith("'") && first.endsWith("'")) first = first.substring(1, first.length() - 1);
        return first.isBlank() ? null : first;
    }
}
