package com.org.report_generator.service.renderer;

import com.org.report_generator.model.document.DocumentModel;
import com.org.report_generator.model.document.Page;
import com.org.report_generator.model.document.PageSize;

import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

/**
 * Renders page-specific CSS styles matching frontend page component styles.
 */
public class PageStylesRenderer {
    
    private static final double DEFAULT_WIDTH_MM = 254d;
    private static final double DEFAULT_HEIGHT_MM = 190.5d;
    
    private static final String PAGE_CSS = """
        .page {
            position: relative;
            /* Allow visible overflow for header/footer - clipping handled by @page rules */
            overflow: visible;
            box-sizing: border-box;
        }
        
        .page__surface {
            position: relative;
            background: #ffffff;
            box-shadow: 0 20px 60px rgba(15, 23, 42, 0.12), 0 8px 24px rgba(15, 23, 42, 0.08);
            padding: 0;
            border: 1px solid rgba(148, 163, 184, 0.2);
            border-radius: 0;
            /* Allow visible overflow for header/footer */
            overflow: visible;
            box-sizing: border-box;
        }

        .page__theme-layer {
            position: absolute;
            inset: 0;
            pointer-events: none;
            z-index: 0;
        }

        .page__theme-layer::before,
        .page__theme-layer::after {
            content: '';
            position: absolute;
            pointer-events: none;
        }

        /* Curvy Magenta: top-right magenta tab */
        .page__theme-layer.theme-curvy-magenta::after {
            right: 9.5%;
            top: 0;
            width: 4.8%;
            height: 17.5%;
            background: #c71585;
            border-radius: 0 0 2px 2px;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
        }

        /* Curvy cover slides */
        .page__theme-layer.theme-curvy-magenta.variant-g1::before,
        .page__theme-layer.theme-curvy-magenta.layout-title-slide::before,
        .page__theme-layer.theme-curvy-magenta.layout-section-header::before {
            left: 4%;
            right: 4%;
            top: 0;
            height: 42%;
            border-radius: 0 0 46% 46% / 0 0 30% 30%;
            background: rgba(255, 255, 255, 0.14);
        }

        /* Curvy content slides */
        .page__theme-layer.theme-curvy-magenta.variant-g2::before,
        .page__theme-layer.theme-curvy-magenta.layout-title-and-content::before,
        .page__theme-layer.theme-curvy-magenta.layout-two-content::before,
        .page__theme-layer.theme-curvy-magenta.layout-comparison::before,
        .page__theme-layer.theme-curvy-magenta.layout-title-only::before {
            left: 0;
            right: 0;
            top: 0;
            height: 34%;
            border-radius: 0 0 55% 55% / 0 0 26% 26%;
            background: rgba(255, 255, 255, 0.18);
        }

        /* Curvy blank slides */
        .page__theme-layer.theme-curvy-magenta.variant-g3::before,
        .page__theme-layer.theme-curvy-magenta.layout-blank::before {
            display: none;
        }

        @media print {
            /* Avoid subtle layout shifts from shadows/borders in print mode */
            .page__surface {
                box-shadow: none !important;
                border: none !important;
                overflow: hidden !important;
            }

            /* Ensure header/footer are visible in print */
            .page__header,
            .page__footer {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
        }
        
        .page__logo-image {
            max-height: 40px;
            max-width: 120px;
            object-fit: contain;
            display: block;
        }

        .page__logo-image--inline {
            max-height: 26px;
            max-width: 100px;
        }

        .page__header {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            z-index: 1000;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding: 8px 20px;
            pointer-events: none;
            /* Transparent background so widgets in header area are visible */
            background: transparent;
            min-height: 24px;
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }

        .page__header-left,
        .page__header-center,
        .page__header-right {
            font-size: 12px;
            font-weight: 500;
            flex: 1;
            min-width: 0;
            line-height: 1.4;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .page__header-left { justify-content: flex-start; text-align: left; }
        .page__header-center { justify-content: center; text-align: center; }
        .page__header-right { justify-content: flex-end; text-align: right; }

        .page__header-image {
            max-height: 30px;
            max-width: 100px;
            object-fit: contain;
            display: block;
        }
        
        .page__footer {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            z-index: 1000;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            padding: 8px 20px;
            pointer-events: none;
            /* Transparent background so widgets in footer area are visible */
            background: transparent;
            min-height: 24px;
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        
        .page__footer-left {
            font-size: 12px;
            font-weight: 500;
            flex: 1;
            text-align: left;
            min-width: 0;
            line-height: 1.4;
            padding-bottom: 2px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .page__footer-center {
            font-size: 12px;
            font-weight: 500;
            flex: 1;
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 2px;
            min-width: 0;
            padding-bottom: 2px;
        }
        
        .page__footer-center-line {
            line-height: 1.4;
        }
        
        .page__footer-right {
            font-size: 12px;
            font-weight: 500;
            flex: 1;
            text-align: right;
            min-width: 0;
            line-height: 1.4;
            padding-bottom: 2px;
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 8px;
        }

        .page__footer-image {
            max-height: 30px;
            max-width: 100px;
            object-fit: contain;
            display: block;
        }
        """;
    
    /**
     * Get page-specific CSS including @page rules for PDF generation
     */
    public static String getCss(List<Page> pages, DocumentModel document) {
        StringBuilder css = new StringBuilder(PAGE_CSS);
        
        PageSize pageSize = Optional.ofNullable(document.getPageSize()).orElse(new PageSize());
        double baseWidth = Optional.ofNullable(pageSize.getWidthMm()).orElse(DEFAULT_WIDTH_MM);
        double baseHeight = Optional.ofNullable(pageSize.getHeightMm()).orElse(DEFAULT_HEIGHT_MM);

        // Default page rule (Chromium may ignore named pages in some contexts; this keeps single-orientation docs correct).
        double defaultWidth = Math.max(baseWidth, baseHeight);
        double defaultHeight = Math.min(baseWidth, baseHeight);
        css.append("@page { size: ")
                .append(defaultWidth).append("mm ")
                .append(defaultHeight).append("mm; margin: 0; }\n");
        
        for (Page page : pages) {
            String orientation = Optional.ofNullable(page.getOrientation()).orElse("landscape").toLowerCase(Locale.ROOT);
            double pageWidth = orientation.equals("portrait") ? Math.min(baseWidth, baseHeight) : Math.max(baseWidth, baseHeight);
            double pageHeight = orientation.equals("portrait") ? Math.max(baseWidth, baseHeight) : Math.min(baseWidth, baseHeight);
            String pageName = "page-" + Optional.ofNullable(page.getId()).orElse(UUID.randomUUID().toString());
            
            css.append("@page ").append(pageName).append(" { size: ")
                    .append(pageWidth).append("mm ")
                    .append(pageHeight).append("mm; margin: 0; }\n");
        }
        
        return css.toString();
    }
}

