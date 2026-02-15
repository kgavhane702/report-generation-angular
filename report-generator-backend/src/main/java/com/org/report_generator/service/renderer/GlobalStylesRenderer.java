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
            /* Export behavior: clip content to the widget frame (prevents hidden/clipped content from showing in PDF). */
            overflow: hidden;
        }

        /* Chart widgets should be fully transparent (match editor behavior). */
        .widget-chart .chart-svg,
        .widget-chart .chart-svg svg,
        .widget-chart img,
        .widget-chart canvas {
            background: transparent !important;
            background-color: transparent !important;
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

