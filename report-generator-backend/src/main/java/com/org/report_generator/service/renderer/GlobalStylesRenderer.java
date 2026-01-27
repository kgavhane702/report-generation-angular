package com.org.report_generator.service.renderer;

/**
 * Renders global CSS styles matching the frontend exactly.
 */
public class GlobalStylesRenderer {
    
    private static final String GLOBAL_CSS = """
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        
        html, body {
            height: 100%;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }
        
        body {
            margin: 0;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
            background: #ffffff;
            color: #0f172a;
            line-height: 1.6;
            padding: 0;
        }
        
        .document-container {
            background: white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            margin: 0 auto;
        }
        
        .widget {
            position: absolute;
            /* Match editor behavior: no internal scrollbars; allow content to extend if it outgrows the box. */
            overflow: visible;
        }
        
        /* Text widgets need visible overflow for superscript/subscript */
        .widget-text {
            overflow: visible !important;
        }
        
        @media print {
            body {
                background: white;
                padding: 0;
            }
            /* PDF doesn't need editor-style shadows; removing them reduces render/print cost. */
            .document-container {
                box-shadow: none !important;
            }
            .widget-text ul, .widget-text ol {
                page-break-inside: avoid;
            }
            .widget-editastra ul, .widget-editastra ol {
                page-break-inside: avoid;
            }
            .widget-text table {
                page-break-inside: avoid;
            }
        }
        """;
    
    /**
     * Get global CSS styles
     */
    public static String getCss() {
        return GLOBAL_CSS;
    }
}

