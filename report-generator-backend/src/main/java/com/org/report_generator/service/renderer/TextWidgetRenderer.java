package com.org.report_generator.service.renderer;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Modular renderer for text widgets that matches frontend styling exactly.
 * Handles CKEditor HTML content with proper formatting preservation.
 */
public class TextWidgetRenderer {
    
    private static final String TEXT_WIDGET_CSS = """
        .widget-text {
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            position: relative;
            word-wrap: break-word;
            overflow-wrap: break-word;
            overflow: hidden;
            box-sizing: border-box;
            color: inherit;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
            font-size: 1rem;
            line-height: 1.4;
            color: #0f172a;
        }
        
        .widget-text__content {
            width: 100%;
            max-width: 100%;
            box-sizing: border-box;
            overflow: hidden;
            word-wrap: break-word;
            overflow-wrap: anywhere;
            word-break: break-word;
        }
        
        /* Ensure all inline styles from CKEditor are preserved with highest priority */
        .widget-text [style] {
            /* Inline styles always take precedence */
        }
        
        /* Paragraphs - match CKEditor editable styles */
        .widget-text p {
            margin: 0;
            padding: 0;
            line-height: 1.4;
            overflow: hidden;
            word-wrap: break-word;
            overflow-wrap: anywhere;
            word-break: break-word;
        }
        
        /* Headings */
        .widget-text h1, .widget-text h2, .widget-text h3,
        .widget-text h4, .widget-text h5, .widget-text h6 {
            margin: 0.5em 0;
            font-weight: 600;
            line-height: 1.2;
            color: inherit;
        }
        .widget-text h1 { font-size: 2em; }
        .widget-text h2 { font-size: 1.75em; }
        .widget-text h3 { font-size: 1.5em; }
        .widget-text h4 { font-size: 1.25em; }
        .widget-text h5 { font-size: 1.1em; }
        .widget-text h6 { font-size: 1em; }
        
        /* Lists - match CKEditor list styles */
        .widget-text ul, .widget-text ol {
            padding-left: 1.25rem;
            margin: 0.35rem 0;
            list-style-position: outside;
            line-height: 1.4;
        }
        .widget-text ul {
            list-style-type: disc;
        }
        .widget-text ul ul {
            list-style-type: circle;
            margin-top: 0.25em;
        }
        .widget-text ul ul ul {
            list-style-type: square;
        }
        .widget-text ol {
            list-style-type: decimal;
        }
        .widget-text ol ol {
            list-style-type: lower-alpha;
            margin-top: 0.25em;
        }
        .widget-text ol ol ol {
            list-style-type: lower-roman;
        }
        .widget-text li {
            margin: 0.25rem 0;
        }
        .widget-text li::marker {
            color: inherit;
        }
        .widget-text li ul, .widget-text li ol {
            margin-top: 0.25em;
            margin-bottom: 0.25em;
        }
        
        /* Text formatting */
        .widget-text strong, .widget-text b {
            font-weight: 700;
        }
        .widget-text em, .widget-text i {
            font-style: italic;
        }
        .widget-text u {
            text-decoration: underline;
        }
        .widget-text s, .widget-text strike {
            text-decoration: line-through;
        }
        
        /* Superscript and Subscript */
        .widget-text sup {
            vertical-align: super;
            font-size: 0.75em;
            line-height: 0;
            position: relative;
            top: -0.4em;
        }
        .widget-text sub {
            vertical-align: sub;
            font-size: 0.75em;
            line-height: 0;
            position: relative;
            bottom: -0.2em;
        }
        
        /* Ensure parent containers don't clip superscript/subscript */
        .widget-text p,
        .widget-text div,
        .widget-text span,
        .widget-text li,
        .widget-text strong,
        .widget-text em,
        .widget-text b,
        .widget-text i {
            overflow: visible;
        }
        
        /* Links */
        .widget-text a {
            color: #2563eb;
            text-decoration: underline;
        }
        .widget-text a:hover {
            color: #1d4ed8;
        }
        
        /* Mark/highlight */
        .widget-text mark {
            background-color: yellow;
            padding: 0;
        }
        
        /* Inline style support - ensure all CKEditor inline styles are preserved */
        .widget-text span[style*="color:"],
        .widget-text p[style*="color:"],
        .widget-text div[style*="color:"],
        .widget-text strong[style*="color:"],
        .widget-text em[style*="color:"],
        .widget-text b[style*="color:"],
        .widget-text i[style*="color:"],
        .widget-text u[style*="color:"],
        .widget-text sup[style*="color:"],
        .widget-text sub[style*="color:"] {
            /* Inline color styles are preserved */
        }
        
        .widget-text span[style*="background-color:"],
        .widget-text p[style*="background-color:"],
        .widget-text div[style*="background-color:"],
        .widget-text strong[style*="background-color:"],
        .widget-text em[style*="background-color:"],
        .widget-text mark[style*="background-color:"] {
            /* Inline background-color styles are preserved */
        }
        
        .widget-text span[style*="font-size:"],
        .widget-text p[style*="font-size:"],
        .widget-text div[style*="font-size:"],
        .widget-text strong[style*="font-size:"],
        .widget-text em[style*="font-size:"],
        .widget-text sup[style*="font-size:"],
        .widget-text sub[style*="font-size:"] {
            /* Inline font-size styles are preserved */
        }
        
        .widget-text span[style*="font-family:"],
        .widget-text p[style*="font-family:"],
        .widget-text div[style*="font-family:"] {
            /* Inline font-family styles are preserved */
        }
        
        .widget-text p[style*="text-align:"],
        .widget-text div[style*="text-align:"] {
            /* Inline text-align styles are preserved */
        }
        
        .widget-text [style*="text-align: left"],
        .widget-text [style*="text-align:left"] {
            text-align: left !important;
        }
        .widget-text [style*="text-align: center"],
        .widget-text [style*="text-align:center"] {
            text-align: center !important;
        }
        .widget-text [style*="text-align: right"],
        .widget-text [style*="text-align:right"] {
            text-align: right !important;
        }
        .widget-text [style*="text-align: justify"],
        .widget-text [style*="text-align:justify"] {
            text-align: justify !important;
        }
        
        .widget-text [style*="text-indent:"] {
            /* Inline text-indent styles are preserved */
        }
        
        .widget-text [style*="padding:"],
        .widget-text [style*="margin:"] {
            /* Inline padding and margin styles are preserved */
        }
        
        .widget-text [style*="line-height:"] {
            /* Inline line-height styles are preserved */
        }
        
        .widget-text [style*="font-weight:"] {
            /* Inline font-weight styles are preserved */
        }
        
        .widget-text [style*="letter-spacing:"] {
            /* Inline letter-spacing styles are preserved */
        }
        
        /* Embedded tables in text widgets */
        .widget-text table {
            width: 100%;
            border-collapse: collapse;
            margin: 0.5em 0;
            border: 1px solid #e5e7eb;
            font-size: inherit;
        }
        .widget-text table th,
        .widget-text table td {
            padding: 8px 12px;
            border: 1px solid #e5e7eb;
            vertical-align: top;
            text-align: left;
        }
        .widget-text table th {
            background-color: #f3f4f6;
            font-weight: 600;
        }
        .widget-text table tbody tr:nth-child(even) {
            background-color: #f9fafb;
        }
        .widget-text table[style] {
            /* Inline styles override defaults */
        }
        .widget-text table th[style],
        .widget-text table td[style] {
            /* Inline styles override defaults */
        }
        
        /* Blockquote */
        .widget-text blockquote {
            margin: 0.5em 0;
            padding-left: 1em;
            border-left: 4px solid #e5e7eb;
            font-style: italic;
            color: #6b7280;
        }
        
        /* Code blocks */
        .widget-text code {
            background-color: #f3f4f6;
            padding: 2px 4px;
            border-radius: 3px;
            font-family: 'Courier New', Courier, monospace;
            font-size: 0.9em;
        }
        .widget-text pre {
            background-color: #f3f4f6;
            padding: 0.75em;
            border-radius: 4px;
            overflow-x: auto;
            margin: 0.5em 0;
        }
        .widget-text pre code {
            background-color: transparent;
            padding: 0;
        }
        
        /* Horizontal rule */
        .widget-text hr {
            border: none;
            border-top: 1px solid #e5e7eb;
            margin: 1em 0;
        }
        """;

    /**
     * Render a text widget with proper HTML structure matching frontend
     */
    public String render(JsonNode props, String widgetStyle) {
        if (props == null) {
            return "<div class=\"widget widget-text\" style=\"" + escapeHtmlAttribute(widgetStyle) + "\"></div>";
        }
        
        JsonNode contentHtmlNode = props.path("contentHtml");
        String content = "";
        
        if (!contentHtmlNode.isMissingNode() && !contentHtmlNode.isNull()) {
            if (contentHtmlNode.isTextual()) {
                content = contentHtmlNode.asText("");
            } else {
                content = contentHtmlNode.toString();
            }
        }

        // Some widgets store editor content as plain text (with newlines) rather than HTML.
        // In HTML rendering, newlines collapse into spaces unless we convert them into <br/>.
        // This was causing lines that were separate in the UI to merge in the PDF when the widget is wide.
        if (content != null) {
            String trimmed = content.trim();
            boolean looksLikeHtml = trimmed.startsWith("<") && trimmed.endsWith(">") || trimmed.contains("<p") || trimmed.contains("<div") || trimmed.contains("<br");
            if (!looksLikeHtml) {
                String escaped = escapeHtmlTextContent(content);
                // Preserve explicit line breaks from the editor.
                escaped = escaped.replace("\r\n", "\n").replace("\r", "\n");
                escaped = escaped.replace("\n", "<br/>");
                content = "<div>" + escaped + "</div>";
            }
        }

        if (content.trim().isEmpty()) {
            content = "<p></p>";
        }

        StringBuilder finalStyle = new StringBuilder(widgetStyle);
        JsonNode backgroundColorNode = props.path("backgroundColor");
        if (!backgroundColorNode.isMissingNode() && !backgroundColorNode.isNull() && backgroundColorNode.isTextual()) {
            String backgroundColor = backgroundColorNode.asText("");
            if (!backgroundColor.isBlank() && !backgroundColor.equals("transparent")) {
                finalStyle.append("background-color: ").append(backgroundColor).append(";");
            }
        }

        // Wrap content in an inner div that enforces width constraints
        // This ensures text wraps at the widget boundary, matching UI behavior
        String innerStyle = "width: 100%; max-width: 100%; overflow: hidden; word-wrap: break-word; overflow-wrap: break-word; box-sizing: border-box;";
        
        return "<div class=\"widget widget-text\" style=\"" + escapeHtmlAttribute(finalStyle.toString()) + "\">" +
               "<div class=\"widget-text__content\" style=\"" + innerStyle + "\">" + content + "</div></div>";
    }

    private String escapeHtmlTextContent(String input) {
        if (input == null || input.isEmpty()) {
            return "";
        }
        return input.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }

    /**
     * Escape HTML attribute values to prevent markup breakage/XSS.
     * (We still allow rich HTML in contentHtml; this is only for attribute contexts like style.)
     */
    private String escapeHtmlAttribute(String input) {
        if (input == null || input.isEmpty()) {
            return "";
        }
        return input.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
    
    /**
     * Get CSS styles for text widgets
     */
    public static String getCss() {
        return TEXT_WIDGET_CSS;
    }
}

