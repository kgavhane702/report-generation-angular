package com.org.report_generator.render.docx.service;

import org.apache.poi.xwpf.usermodel.ParagraphAlignment;
import org.apache.poi.xwpf.usermodel.LineSpacingRule;
import org.apache.poi.xwpf.usermodel.UnderlinePatterns;
import org.apache.poi.xwpf.usermodel.VerticalAlign;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.apache.poi.xwpf.usermodel.XWPFTableCell;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTShd;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.STShd;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Element;
import org.jsoup.nodes.Node;
import org.jsoup.nodes.TextNode;
import org.springframework.stereotype.Service;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Locale;

@Service
public class HtmlToDocxConverter {

    public void appendHtml(XWPFDocument doc, String html) {
        if (doc == null) return;
        if (html == null || html.isBlank()) {
            doc.createParagraph();
            return;
        }

        Element body = Jsoup.parseBodyFragment(html).body();
        Style base = defaultStyle();
        ParagraphFactory factory = doc::createParagraph;
        for (Node node : body.childNodes()) {
            renderNode(factory, null, node, base, new ListContext(), true);
        }
    }

    public void appendHtml(XWPFParagraph paragraph, String html) {
        if (paragraph == null) return;
        if (html == null || html.isBlank()) {
            return;
        }
        Element body = Jsoup.parseBodyFragment(html).body();
        Style base = defaultStyle();
        ParagraphFactory factory = () -> paragraph;
        for (Node node : body.childNodes()) {
            renderNode(factory, paragraph, node, base, new ListContext(), false);
        }
    }

    public void appendHtmlToCell(XWPFTableCell cell, String html) {
        if (cell == null) return;
        if (html == null || html.isBlank()) return;
        Element body = Jsoup.parseBodyFragment(html).body();
        Style base = defaultStyle();
        ParagraphFactory factory = cell::addParagraph;
        XWPFParagraph first = cell.addParagraph();
        for (Node node : body.childNodes()) {
            renderNode(factory, first, node, base, new ListContext(), true);
        }
    }

    private XWPFParagraph renderNode(ParagraphFactory factory, XWPFParagraph current, Node node, Style style, ListContext listCtx, boolean allowNewParagraphs) {
        if (node instanceof TextNode textNode) {
            String text = textNode.text();
            if (text.isBlank()) return current;
            XWPFParagraph p = ensureParagraph(factory, current);
            XWPFRun run = p.createRun();
            style.applyToRun(run);
            run.setText(text);
            return p;
        }

        if (!(node instanceof Element el)) {
            return current;
        }

        String tag = el.tagName().toLowerCase(Locale.ROOT);
        Style merged = style.merge(parseStyle(el));

        switch (tag) {
            case "br" -> {
                XWPFParagraph p = ensureParagraph(factory, current);
                XWPFRun run = p.createRun();
                merged.applyToRun(run);
                run.addBreak();
                return p;
            }
            case "p", "div", "h1", "h2", "h3", "h4", "h5", "h6" -> {
                if (allowNewParagraphs) {
                    XWPFParagraph p = factory.create();
                    normalizeParagraph(p);
                    applyParagraphAlignment(p, el);
                    if (merged.textAlign != null) {
                        applyTextAlignValue(p, merged.textAlign);
                    }
                    applyLineHeight(p, merged);
                    XWPFParagraph cursor = p;
                    for (Node child : el.childNodes()) {
                        cursor = renderNode(factory, cursor, child, merged, listCtx, allowNewParagraphs);
                    }
                    return null;
                } else {
                    XWPFParagraph p = ensureParagraph(factory, current);
                    XWPFRun run = p.createRun();
                    run.addBreak();
                    normalizeParagraph(p);
                    if (merged.textAlign != null) {
                        applyTextAlignValue(p, merged.textAlign);
                    }
                    applyLineHeight(p, merged);
                    XWPFParagraph cursor = p;
                    for (Node child : el.childNodes()) {
                        cursor = renderNode(factory, cursor, child, merged, listCtx, allowNewParagraphs);
                    }
                    return cursor;
                }
            }
            case "ul" -> {
                listCtx.pushUnordered();
                for (Node child : el.childNodes()) {
                    current = renderNode(factory, current, child, merged, listCtx, allowNewParagraphs);
                }
                listCtx.pop();
                return current;
            }
            case "ol" -> {
                listCtx.pushOrdered();
                for (Node child : el.childNodes()) {
                    current = renderNode(factory, current, child, merged, listCtx, allowNewParagraphs);
                }
                listCtx.pop();
                return current;
            }
            case "li" -> {
                XWPFParagraph p = allowNewParagraphs ? factory.create() : ensureParagraph(factory, current);
                normalizeParagraph(p);
                applyParagraphAlignment(p, el);
                String prefix = listCtx.currentPrefix();
                if (!prefix.isEmpty()) {
                    XWPFRun prefixRun = p.createRun();
                    prefixRun.setText(prefix);
                }
                XWPFParagraph cursor = p;
                for (Node child : el.childNodes()) {
                    cursor = renderNode(factory, cursor, child, merged, listCtx, allowNewParagraphs);
                }
                return allowNewParagraphs ? null : cursor;
            }
            case "strong", "b", "em", "i", "u", "s", "del", "strike", "sup", "sub", "span", "a", "mark" -> {
                for (Node child : el.childNodes()) {
                    current = renderNode(factory, current, child, merged, listCtx, allowNewParagraphs);
                }
                return current;
            }
            default -> {
                for (Node child : el.childNodes()) {
                    current = renderNode(factory, current, child, merged, listCtx, allowNewParagraphs);
                }
                return current;
            }
        }
    }

    private XWPFParagraph ensureParagraph(ParagraphFactory factory, XWPFParagraph current) {
        return current != null ? current : factory.create();
    }

    private void applyHeadingStyle(XWPFParagraph p, String tag) {
        // No-op. Heading styles are applied via Style in parseStyle.
    }

    private void applyParagraphAlignment(XWPFParagraph p, Element el) {
        String align = extractStyle(el, "text-align");
        if (align == null) return;
        applyTextAlignValue(p, align);
    }

    private void applyTextAlignValue(XWPFParagraph p, String align) {
        if (align == null) return;
        switch (align.toLowerCase(Locale.ROOT)) {
            case "center" -> p.setAlignment(ParagraphAlignment.CENTER);
            case "right" -> p.setAlignment(ParagraphAlignment.RIGHT);
            case "justify" -> p.setAlignment(ParagraphAlignment.BOTH);
            default -> p.setAlignment(ParagraphAlignment.LEFT);
        }
    }

    private Style parseStyle(Element el) {
        Style s = new Style();
        String tag = el.tagName().toLowerCase(Locale.ROOT);
        if (tag.equals("strong") || tag.equals("b")) s.bold = true;
        if (tag.equals("em") || tag.equals("i")) s.italic = true;
        if (tag.equals("u")) s.underline = true;
        if (tag.equals("s") || tag.equals("del") || tag.equals("strike")) s.strike = true;
        if (tag.equals("sup")) s.superscript = true;
        if (tag.equals("sub")) s.subscript = true;
        if (tag.equals("mark")) s.backgroundColor = "FFFF00";

        // Heading defaults
        switch (tag) {
            case "h1" -> { s.bold = true; s.fontSize = 24; }
            case "h2" -> { s.bold = true; s.fontSize = 20; }
            case "h3" -> { s.bold = true; s.fontSize = 18; }
            case "h4" -> { s.bold = true; s.fontSize = 16; }
            case "h5" -> { s.bold = true; s.fontSize = 14; }
            case "h6" -> { s.bold = true; s.fontSize = 12; }
            default -> {
            }
        }

        String styleAttr = el.hasAttr("style") ? el.attr("style") : null;
        if (styleAttr != null && !styleAttr.isBlank()) {
            String[] rules = styleAttr.split(";");
            for (String rule : rules) {
                String[] parts = rule.split(":", 2);
                if (parts.length != 2) continue;
                String key = parts[0].trim().toLowerCase(Locale.ROOT);
                String value = parts[1].trim().toLowerCase(Locale.ROOT);
                switch (key) {
                    case "font-weight" -> {
                        if (value.contains("bold") || value.matches("[6-9]00")) s.bold = true;
                    }
                    case "font-style" -> {
                        if (value.contains("italic")) s.italic = true;
                    }
                    case "text-decoration" -> {
                        if (value.contains("underline")) s.underline = true;
                        if (value.contains("line-through")) s.strike = true;
                    }
                    case "color" -> s.color = normalizeColor(value);
                    case "font-size" -> s.fontSize = parseFontSize(value);
                    case "font-family" -> s.fontFamily = parseFontFamily(value);
                    case "background" , "background-color" -> s.backgroundColor = normalizeColor(value);
                    case "line-height" -> applyLineHeightValue(s, value);
                    default -> {
                    }
                }
            }
        }

        String align = extractStyle(el, "text-align");
        if (align != null) {
            s.textAlign = align;
        }
        return s;
    }

    private String extractStyle(Element el, String key) {
        if (!el.hasAttr("style")) return null;
        String styleAttr = el.attr("style");
        if (styleAttr == null) return null;
        String[] rules = styleAttr.split(";");
        for (String rule : rules) {
            String[] parts = rule.split(":", 2);
            if (parts.length != 2) continue;
            if (parts[0].trim().equalsIgnoreCase(key)) {
                return parts[1].trim();
            }
        }
        return null;
    }

    private Integer parseFontSize(String value) {
        try {
            if (value.endsWith("px")) {
                double px = Double.parseDouble(value.replace("px", "").trim());
                return (int) Math.round(px * 0.75); // px to pt
            }
            if (value.endsWith("pt")) {
                return (int) Math.round(Double.parseDouble(value.replace("pt", "").trim()));
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    private void applyLineHeightValue(Style s, String value) {
        try {
            if (value.endsWith("px")) {
                double px = Double.parseDouble(value.replace("px", "").trim());
                s.lineHeightLines = Math.max(0.8, px / 16.0);
                return;
            }
            if (value.endsWith("pt")) {
                double pt = Double.parseDouble(value.replace("pt", "").trim());
                s.lineHeightLines = Math.max(0.8, pt / 12.0);
                return;
            }
            if (value.endsWith("%")) {
                double pct = Double.parseDouble(value.replace("%", "").trim());
                s.lineHeightLines = Math.max(0.8, pct / 100.0);
                return;
            }
            s.lineHeightLines = Double.parseDouble(value.trim());
        } catch (Exception ignored) {
        }
    }

    private String normalizeColor(String value) {
        if (value == null) return null;
        String v = value.trim().toLowerCase(Locale.ROOT);
        if (v.startsWith("#")) {
            String hex = v.substring(1);
            if (hex.length() == 3) {
                return ("" + hex.charAt(0) + hex.charAt(0)
                        + hex.charAt(1) + hex.charAt(1)
                        + hex.charAt(2) + hex.charAt(2)).toUpperCase(Locale.ROOT);
            }
            if (hex.length() == 6) {
                return hex.toUpperCase(Locale.ROOT);
            }
        }
        if (v.startsWith("rgb")) {
            try {
                String inside = v.substring(v.indexOf('(') + 1, v.indexOf(')'));
                String[] parts = inside.split(",");
                int r = Integer.parseInt(parts[0].trim());
                int g = Integer.parseInt(parts[1].trim());
                int b = Integer.parseInt(parts[2].trim());
                return String.format("%02X%02X%02X", r, g, b);
            } catch (Exception ignored) {
            }
        }
        return null;
    }

    private String parseFontFamily(String value) {
        if (value == null) return null;
        String v = value.trim();
        if (v.isEmpty()) return null;
        // Use first family in the list
        String first = v.split(",")[0].trim();
        if (first.startsWith("\"") && first.endsWith("\"")) {
            first = first.substring(1, first.length() - 1);
        }
        return first.isBlank() ? null : first;
    }

    private static class Style {
        boolean bold;
        boolean italic;
        boolean underline;
        boolean strike;
        boolean superscript;
        boolean subscript;
        String color;
        Integer fontSize;
        String fontFamily;
        String backgroundColor;
        Double lineHeightLines;
        String textAlign;

        Style merge(Style other) {
            if (other == null) return this;
            Style s = new Style();
            s.bold = this.bold || other.bold;
            s.italic = this.italic || other.italic;
            s.underline = this.underline || other.underline;
            s.strike = this.strike || other.strike;
            s.superscript = this.superscript || other.superscript;
            s.subscript = this.subscript || other.subscript;
            s.color = other.color != null ? other.color : this.color;
            s.fontSize = other.fontSize != null ? other.fontSize : this.fontSize;
            s.fontFamily = other.fontFamily != null ? other.fontFamily : this.fontFamily;
            s.backgroundColor = other.backgroundColor != null ? other.backgroundColor : this.backgroundColor;
            s.lineHeightLines = other.lineHeightLines != null ? other.lineHeightLines : this.lineHeightLines;
            s.textAlign = other.textAlign != null ? other.textAlign : this.textAlign;
            return s;
        }

        void applyToRun(XWPFRun run) {
            run.setBold(bold);
            run.setItalic(italic);
            if (underline) run.setUnderline(UnderlinePatterns.SINGLE);
            if (strike) run.setStrikeThrough(true);
            if (superscript) run.setSubscript(VerticalAlign.SUPERSCRIPT);
            if (subscript) run.setSubscript(VerticalAlign.SUBSCRIPT);
            if (color != null) run.setColor(color);
            if (fontSize != null && fontSize > 0) run.setFontSize(fontSize);
            if (fontSize == null) run.setFontSize(12);
            if (fontFamily != null) run.setFontFamily(fontFamily);
            if (backgroundColor != null) {
                var ctr = run.getCTR();
                var rpr = ctr.isSetRPr() ? ctr.getRPr() : ctr.addNewRPr();
                CTShd shd = rpr.addNewShd();
                shd.setVal(STShd.CLEAR);
                shd.setFill(backgroundColor);
            }
        }
    }

    private static class ListContext {
        private final Deque<Integer> ordered = new ArrayDeque<>();
        private final Deque<Boolean> unordered = new ArrayDeque<>();

        void pushOrdered() {
            ordered.push(0);
            unordered.push(false);
        }

        void pushUnordered() {
            unordered.push(true);
        }

        void pop() {
            if (!ordered.isEmpty()) ordered.pop();
            if (!unordered.isEmpty()) unordered.pop();
        }

        String currentPrefix() {
            if (!unordered.isEmpty() && unordered.peek()) {
                return "• ";
            }
            if (!ordered.isEmpty()) {
                int n = ordered.pop() + 1;
                ordered.push(n);
                return n + ". ";
            }
            return "";
        }
    }

    private void applyLineHeight(XWPFParagraph p, Style style) {
        if (style == null) return;
        if (style.lineHeightLines != null && style.lineHeightLines > 0) {
            p.setSpacingBetween(style.lineHeightLines, LineSpacingRule.AUTO);
        }
    }

    private interface ParagraphFactory {
        XWPFParagraph create();
    }

    private void normalizeParagraph(XWPFParagraph p) {
        if (p == null) return;
        p.setSpacingBefore(0);
        p.setSpacingAfter(0);
        p.setIndentationLeft(0);
        p.setIndentationRight(0);
    }

    private Style defaultStyle() {
        Style s = new Style();
        s.fontSize = 12; // 16px default
        s.fontFamily = "Inter";
        s.lineHeightLines = 1.4;
        return s;
    }
}
