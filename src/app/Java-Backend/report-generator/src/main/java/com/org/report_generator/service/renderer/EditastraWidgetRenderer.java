package com.org.report_generator.service.renderer;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.Locale;

/**
 * Renderer for Editastra widgets.
 *
 * Editastra is a temporary widget in the Angular UI that reuses the table-style contenteditable editor.
 * For PDF generation we render the stored `contentHtml` and apply the same list/custom-marker CSS as table cells,
 * plus widget-level vertical alignment (top/middle/bottom).
 */
public class EditastraWidgetRenderer {

    private static final String EDITASTRA_WIDGET_CSS = """
        .widget-editastra {
            width: 100%;
            height: 100%;
            /* Match frontend rich text widget: no box border in PDF by default. */
            border-radius: 0;
            overflow: visible;
            border: none;
            background: transparent;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
            color: #0f172a;
        }

        .widget-editastra__content {
            width: 100%;
            height: 100%;
            box-sizing: border-box;
            display: grid;
            align-content: start;
            background: transparent;
        }

        .widget-editastra__content[data-v-align='top'] { align-content: start; }
        .widget-editastra__content[data-v-align='middle'] { align-content: center; }
        .widget-editastra__content[data-v-align='bottom'] { align-content: end; }

        .widget-editastra__editor {
            width: 100%;
            max-height: 100%;
            padding: 10px 12px;
            outline: none;
            overflow: visible;
            white-space: pre-wrap;
            word-break: break-word;
            overflow-wrap: anywhere;
            font-size: 14px;
            line-height: 1.35;
            background: transparent;
        }

        /* Lists & markers (match table cell editor output) */
        .widget-editastra__editor ul,
        .widget-editastra__editor ol {
            display: block !important;
            margin: 0 !important;
            padding: 0 !important;
            list-style-position: inside !important;
        }

        .widget-editastra__editor ul { list-style-type: disc !important; }
        .widget-editastra__editor ul[style*="list-style-type: circle"] { list-style-type: circle !important; }
        .widget-editastra__editor ul[style*="list-style-type: square"] { list-style-type: square !important; }
        .widget-editastra__editor ol { list-style-type: decimal !important; }

        .widget-editastra__editor li {
            display: list-item !important;
            margin: 0 !important;
            padding: 0 !important;
            text-indent: 0 !important;
        }

        /* Custom marker lists - use ::before for marker glyph */
        .widget-editastra__editor .custom-marker-list { list-style-type: none !important; }
        .widget-editastra__editor .custom-marker-list li { display: block !important; }
        .widget-editastra__editor .custom-marker-list li::before {
            display: inline;
            margin-right: 0.3em;
        }
        .widget-editastra__editor .custom-marker-arrow li::before { content: '➤'; }
        .widget-editastra__editor .custom-marker-chevron li::before { content: '›'; }
        .widget-editastra__editor .custom-marker-dash li::before { content: '–'; }
        .widget-editastra__editor .custom-marker-check li::before { content: '✓'; }

        /* Resizable inline images (matches frontend behavior) */
        .widget-editastra .tw-resizable-image {
            display: inline-block;
            vertical-align: middle;
            max-width: 100%;
            background: transparent;
            padding: 0;
            margin: 0 0.25em 0 0;
            position: relative;
        }

        .widget-editastra .tw-resizable-image img,
        .widget-editastra .tw-resizable-image svg {
            display: block;
            width: 100%;
        }

        .widget-editastra .tw-resizable-image img {
            height: auto;
            object-fit: contain;
        }

        .widget-editastra .tw-resizable-image svg {
            height: 100%;
        }

        .widget-editastra .tw-resizable-image--inline { float: none; }
        .widget-editastra .tw-resizable-image--left { float: left; margin: 0.1em 0.5em 0.1em 0; }
        .widget-editastra .tw-resizable-image--right { float: right; margin: 0.1em 0 0.1em 0.5em; }
        .widget-editastra .tw-resizable-image--block { display: block; float: none; clear: both; margin: 0.35em auto; }

        /* Hide resize handle in exported output */
        .widget-editastra .tw-resizable-image__handle { display: none !important; }
        """;

    public String render(JsonNode props, String widgetStyle) {
        if (props == null) {
            return "<div class=\"widget widget-editastra\" style=\"" + escapeHtmlAttribute(widgetStyle) + "\"></div>";
        }

        String content = props.path("contentHtml").asText("");
        if (content.trim().isEmpty()) {
            // Keep an empty editor block to preserve padding/height.
            content = "<div><br></div>";
        }

        String bg = props.path("backgroundColor").asText("");
        StringBuilder finalStyle = new StringBuilder(widgetStyle);
        if (bg != null && !bg.isBlank() && !"transparent".equalsIgnoreCase(bg)) {
            finalStyle.append("background-color: ").append(bg).append(";");
        }

        String vAlign = props.path("verticalAlign").asText("top").toLowerCase(Locale.ROOT);
        if (!("top".equals(vAlign) || "middle".equals(vAlign) || "bottom".equals(vAlign))) {
            vAlign = "top";
        }

        return "<div class=\"widget widget-editastra\" style=\"" + escapeHtmlAttribute(finalStyle.toString()) + "\">"
            + "<div class=\"widget-editastra__content\" data-v-align=\"" + escapeHtmlAttribute(vAlign) + "\">"
            + "<div class=\"widget-editastra__editor\">" + content + "</div>"
            + "</div>"
            + "</div>";
    }

    private String escapeHtmlAttribute(String input) {
        if (input == null || input.isEmpty()) return "";
        return input.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("\"", "&quot;")
            .replace("'", "&#39;");
    }

    public static String getCss() {
        return EDITASTRA_WIDGET_CSS;
    }
}


