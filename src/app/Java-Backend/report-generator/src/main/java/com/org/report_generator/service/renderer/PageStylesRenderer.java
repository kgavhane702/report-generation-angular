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
        .page__surface {
            position: relative;
            background: #ffffff;
            box-shadow: 0 20px 60px rgba(15, 23, 42, 0.12), 0 8px 24px rgba(15, 23, 42, 0.08);
            padding: 0;
            border: 1px solid rgba(148, 163, 184, 0.2);
            border-radius: 0;
        }
        
        .page__logo-placeholder {
            position: absolute;
            top: 0;
            right: 0;
            z-index: 1000;
            padding: 12px 16px;
            display: flex;
            align-items: center;
            justify-content: flex-end;
            pointer-events: none;
        }
        
        .page__logo-image {
            max-height: 40px;
            max-width: 120px;
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
            padding: 4px 20px;
            pointer-events: none;
            background: rgba(255, 255, 255, 0.95);
        }
        
        .page__footer-left {
            font-size: 12px;
            color: #1e40af;
            font-weight: 500;
            flex: 1;
            text-align: left;
            min-width: 0;
            line-height: 1.2;
            padding-bottom: 2px;
        }
        
        .page__footer-center {
            font-size: 12px;
            color: #374151;
            font-weight: 500;
            flex: 1;
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 1px;
            min-width: 0;
            padding-bottom: 2px;
        }
        
        .page__footer-center-line {
            line-height: 1.2;
        }
        
        .page__footer-right {
            font-size: 12px;
            color: #374151;
            font-weight: 500;
            flex: 1;
            text-align: right;
            min-width: 0;
            line-height: 1.2;
            padding-bottom: 2px;
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

