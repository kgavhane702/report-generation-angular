/**
 * Render document model to HTML
 * @param {Object} document - Document model
 * @returns {Promise<string>} HTML string
 */
export async function renderDocumentToHTML(document) {
  const pageSize = document.pageSize || {};
  const widthMm = pageSize.widthMm || 254;
  const heightMm = pageSize.heightMm || 190.5;
  const dpi = pageSize.dpi || 96;

  // Convert mm to pixels
  const widthPx = (widthMm / 25.4) * dpi;
  const heightPx = (heightMm / 25.4) * dpi;

  // Collect all pages first to generate @page rules
  const pages = [];
  if (document.sections && Array.isArray(document.sections)) {
    for (const section of document.sections) {
      if (section.subsections && Array.isArray(section.subsections)) {
        for (const subsection of section.subsections) {
          if (subsection.pages && Array.isArray(subsection.pages)) {
            for (const page of subsection.pages) {
              pages.push({ page, section, subsection });
            }
          }
        }
      }
    }
  }

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${document.title || 'Document'}</title>
  <style>
    ${getGlobalStyles()}
    ${getPageStyles(pages, document)}
  </style>
</head>
<body>
  <div class="document-container">
`;

  // Render all pages
  for (const { page } of pages) {
    html += renderPage(page, document, widthPx, heightPx);
  }

  html += `
  </div>
</body>
</html>`;

  return html;
}

/**
 * Render a single page
 */
function renderPage(page, document, widthPx, heightPx) {
  const orientation = page.orientation || 'landscape';
  const pageSize = document.pageSize || {};
  
  // Calculate page dimensions based on orientation
  let pageWidth, pageHeight;
  if (orientation === 'portrait') {
    pageWidth = Math.min(pageSize.widthMm || 254, pageSize.heightMm || 190.5);
    pageHeight = Math.max(pageSize.widthMm || 254, pageSize.heightMm || 190.5);
  } else {
    pageWidth = Math.max(pageSize.widthMm || 254, pageSize.heightMm || 190.5);
    pageHeight = Math.min(pageSize.widthMm || 254, pageSize.heightMm || 190.5);
  }

  const dpi = pageSize.dpi || 96;
  const widthPxFinal = (pageWidth / 25.4) * dpi;
  const heightPxFinal = (pageHeight / 25.4) * dpi;

  // Use page name for CSS @page rule
  const pageName = `page-${page.id}`;

  let html = `
    <div class="page" style="width: ${widthPxFinal}px; height: ${heightPxFinal}px; page-break-after: always; page: ${pageName};">
      <div class="page-surface">
`;

  // Render widgets
  if (page.widgets && Array.isArray(page.widgets)) {
    for (const widget of page.widgets) {
      html += renderWidget(widget);
    }
  }

  html += `
      </div>
    </div>
`;

  return html;
}

/**
 * Generate CSS @page rules for each page with its specific size
 * Uses named pages for per-page sizing
 */
function getPageStyles(pages, document) {
  const pageSize = document.pageSize || {};
  let css = '';

  pages.forEach(({ page }, index) => {
    const orientation = page.orientation || 'landscape';
    
    // Calculate page dimensions based on orientation
    let pageWidth, pageHeight;
    if (orientation === 'portrait') {
      pageWidth = Math.min(pageSize.widthMm || 254, pageSize.heightMm || 190.5);
      pageHeight = Math.max(pageSize.widthMm || 254, pageSize.heightMm || 190.5);
    } else {
      pageWidth = Math.max(pageSize.widthMm || 254, pageSize.heightMm || 190.5);
      pageHeight = Math.min(pageSize.widthMm || 254, pageSize.heightMm || 190.5);
    }

    // Use page name for @page rule (CSS @page supports named pages)
    const pageName = `page-${page.id}`;
    
    // Generate @page rule with name
    css += `
    @page ${pageName} {
      size: ${pageWidth}mm ${pageHeight}mm;
      margin: 0;
    }
    `;
  });

  return css;
}

/**
 * Render a widget
 */
function renderWidget(widget) {
  const { type, position, size, props, style } = widget;

  const widgetStyle = `
    position: absolute;
    left: ${position.x}px;
    top: ${position.y}px;
    width: ${size.width}px;
    height: ${size.height}px;
    ${style ? Object.entries(style).map(([key, value]) => {
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      return `${cssKey}: ${value};`;
    }).join(' ') : ''}
  `;

  switch (type) {
    case 'text':
      return renderTextWidget(props, widgetStyle);
    case 'table':
      return renderTableWidget(props, widgetStyle);
    case 'image':
      return renderImageWidget(props, widgetStyle);
    case 'chart':
      return renderChartWidget(props, widgetStyle);
    default:
      return `<div class="widget widget-${type}" style="${widgetStyle}"></div>`;
  }
}

/**
 * Render text widget
 */
function renderTextWidget(props, style) {
  const content = props.contentHtml || '';
  return `<div class="widget widget-text" style="${style}">${content}</div>`;
}

/**
 * Render table widget
 */
function renderTableWidget(props, style) {
  const { columns = [], rows = [], styleSettings = {} } = props;

  let html = `<div class="widget widget-table" style="${style}">`;
  html += `<table class="table-adapter" style="${getTableStyles(styleSettings)}">`;

  // Determine if first column is row header
  const showRowHeaders = styleSettings.showRowHeaders === true;

  // Render header (if not using first column as row header)
  if (!showRowHeaders || columns.length > 1) {
    html += '<thead><tr>';
    columns.forEach((column, index) => {
      if (showRowHeaders && index === 0) return;
      html += `<th style="${getHeaderCellStyles(column, styleSettings)}">${renderHeaderContent(column, styleSettings)}</th>`;
    });
    html += '</tr></thead>';
  }

  // Render body
  html += '<tbody>';
  rows.forEach((row, rowIndex) => {
    html += '<tr>';
    row.cells.forEach((cell, cellIndex) => {
      const column = columns[cellIndex];
      if (!column) return;

      const isRowHeaderCell = 
        (showRowHeaders && cellIndex === 0) || 
        (column.isHeader === true) || 
        (row.isHeader && cellIndex === 0);

      const tag = isRowHeaderCell ? 'th' : 'td';
      html += `<${tag} style="${getCellStyles(column, row, cellIndex, rowIndex, styleSettings)}">${renderCellContent(cell, column, styleSettings)}</${tag}>`;
    });
    html += '</tr>';
  });
  html += '</tbody>';

  html += '</table></div>';
  return html;
}

/**
 * Render image widget
 */
function renderImageWidget(props, style) {
  const { url, alt = '' } = props;
  if (!url) return `<div class="widget widget-image" style="${style}"></div>`;
  return `<div class="widget widget-image" style="${style}"><img src="${url}" alt="${alt}" style="width: 100%; height: 100%; object-fit: contain;" /></div>`;
}

/**
 * Render chart widget
 */
function renderChartWidget(props, style) {
  // Check if chart has exported base64 image
  if (props.exportedImage) {
    return `<div class="widget widget-chart" style="${style}"><img src="${props.exportedImage}" alt="Chart: ${props.chartType || 'N/A'}" style="width: 100%; height: 100%; object-fit: contain;" /></div>`;
  }
  
  // Fallback: return a placeholder
  return `<div class="widget widget-chart" style="${style}"><div class="chart-placeholder">Chart: ${props.chartType || 'N/A'}</div></div>`;
}

/**
 * Get global CSS styles
 */
function getGlobalStyles() {
  return `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #f5f5f5;
      padding: 20px;
    }

    .document-container {
      background: white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      margin: 0 auto;
    }

    .page {
      background: white;
      margin: 0 auto 20px;
      position: relative;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .page-surface {
      width: 100%;
      height: 100%;
      position: relative;
    }

    .widget {
      position: absolute;
      overflow: hidden;
    }

    .widget-text {
      word-wrap: break-word;
      overflow-wrap: break-word;
    }

    .table-adapter {
      width: 100%;
      height: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }

    .table-adapter th,
    .table-adapter td {
      padding: 8px;
      border: 1px solid #e5e7eb;
      vertical-align: middle;
    }

    .table-adapter th {
      background-color: #f3f4f6;
      font-weight: 600;
      text-align: left;
    }

    .table-adapter tbody tr:nth-child(even) {
      background-color: #f9fafb;
    }

    .chart-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f3f4f6;
      color: #6b7280;
      font-size: 14px;
    }

    @media print {
      body {
        background: white;
        padding: 0;
      }

      .page {
        margin: 0;
        box-shadow: none;
        page-break-after: always;
      }

      .page:last-child {
        page-break-after: auto;
      }
    }
  `;
}

/**
 * Get table styles
 */
function getTableStyles(styleSettings) {
  const styles = [];
  
  if (styleSettings.backgroundColor) styles.push(`background-color: ${styleSettings.backgroundColor}`);
  if (styleSettings.borderColor) styles.push(`border-color: ${styleSettings.borderColor}`);
  if (styleSettings.borderWidth !== undefined) styles.push(`border-width: ${styleSettings.borderWidth}px`);
  if (styleSettings.borderStyle) styles.push(`border-style: ${styleSettings.borderStyle}`);
  if (styleSettings.fontFamily) styles.push(`font-family: ${styleSettings.fontFamily}`);
  if (styleSettings.fontSize) styles.push(`font-size: ${styleSettings.fontSize}px`);
  if (styleSettings.textColor) styles.push(`color: ${styleSettings.textColor}`);

  return styles.join('; ');
}

/**
 * Get header cell styles
 */
function getHeaderCellStyles(column, styleSettings) {
  const headerStyle = styleSettings.headerStyle || {};
  const styles = [];

  const bgColor = column.backgroundColor || 
                 headerStyle.backgroundColor || 
                 styleSettings.headerBackgroundColor ||
                 '#f3f4f6';
  styles.push(`background-color: ${bgColor}`);

  const textColor = column.textColor || 
                   headerStyle.textColor || 
                   styleSettings.headerTextColor || 
                   '#111827';
  styles.push(`color: ${textColor}`);

  if (column.fontFamily || headerStyle.fontFamily) {
    styles.push(`font-family: ${column.fontFamily || headerStyle.fontFamily}`);
  }
  if (column.fontSize || headerStyle.fontSize) {
    styles.push(`font-size: ${(column.fontSize || headerStyle.fontSize)}px`);
  }
  if (column.fontWeight || headerStyle.fontWeight) {
    styles.push(`font-weight: ${column.fontWeight || headerStyle.fontWeight}`);
  }
  if (column.align || headerStyle.textAlign) {
    styles.push(`text-align: ${column.align || headerStyle.textAlign || 'left'}`);
  }
  if (column.padding !== undefined || styleSettings.cellPadding !== undefined) {
    styles.push(`padding: ${(column.padding ?? styleSettings.cellPadding ?? 8)}px`);
  }
  if (column.borderColor || styleSettings.headerBorderColor) {
    styles.push(`border-color: ${column.borderColor || styleSettings.headerBorderColor || '#e5e7eb'}`);
  }
  if (column.borderWidth !== undefined || styleSettings.headerBorderWidth !== undefined) {
    styles.push(`border-width: ${(column.borderWidth ?? styleSettings.headerBorderWidth ?? 1)}px`);
  }
  if (column.borderStyle || styleSettings.borderStyle) {
    styles.push(`border-style: ${column.borderStyle || styleSettings.borderStyle || 'solid'}`);
  }

  return styles.join('; ');
}

/**
 * Get cell styles
 */
function getCellStyles(column, row, cellIndex, rowIndex, styleSettings) {
  const styles = [];
  const showRowHeaders = styleSettings.showRowHeaders === true;
  const isRowHeaderCell = 
    (showRowHeaders && cellIndex === 0) || 
    (column?.isHeader === true) || 
    (row.isHeader && cellIndex === 0);

  // Background color
  let bgColor = column.backgroundColor || row.backgroundColor;
  
  // Row header styling
  if (isRowHeaderCell) {
    const rowHeaderStyle = styleSettings.rowHeaderStyle || styleSettings.headerStyle || {};
    bgColor = rowHeaderStyle.backgroundColor || bgColor || '#f3f4f6';
    if (rowHeaderStyle.textColor) {
      styles.push(`color: ${rowHeaderStyle.textColor}`);
    }
    if (rowHeaderStyle.fontWeight) {
      styles.push(`font-weight: ${rowHeaderStyle.fontWeight}`);
    }
  }

  // Alternate row color
  if (!bgColor && styleSettings.alternateRowColor && rowIndex % 2 === 0) {
    bgColor = styleSettings.alternateRowColor;
  }

  // Alternate column color
  if (!bgColor && styleSettings.alternateColumnColor && cellIndex % 2 === 1) {
    bgColor = styleSettings.alternateColumnColor;
  }

  if (bgColor) styles.push(`background-color: ${bgColor}`);

  // Text color
  const textColor = column.textColor || row.textColor || styleSettings.bodyStyle?.textColor || styleSettings.textColor;
  if (textColor) styles.push(`color: ${textColor}`);

  // Font styles
  if (column.fontFamily || row.fontFamily || styleSettings.bodyStyle?.fontFamily) {
    styles.push(`font-family: ${column.fontFamily || row.fontFamily || styleSettings.bodyStyle?.fontFamily || styleSettings.fontFamily}`);
  }
  if (column.fontSize || row.fontSize || styleSettings.bodyStyle?.fontSize) {
    styles.push(`font-size: ${(column.fontSize || row.fontSize || styleSettings.bodyStyle?.fontSize || styleSettings.fontSize)}px`);
  }
  if (column.fontWeight || row.fontWeight || styleSettings.bodyStyle?.fontWeight) {
    styles.push(`font-weight: ${column.fontWeight || row.fontWeight || styleSettings.bodyStyle?.fontWeight || 'normal'}`);
  }
  if (column.align) {
    styles.push(`text-align: ${column.align}`);
  }
  if (column.verticalAlign || row.verticalAlign) {
    styles.push(`vertical-align: ${column.verticalAlign || row.verticalAlign || 'middle'}`);
  }

  // Padding
  const padding = column.padding ?? row.padding ?? styleSettings.cellPadding ?? 8;
  styles.push(`padding: ${padding}px`);

  // Borders
  if (column.borderColor || row.borderColor) {
    styles.push(`border-color: ${column.borderColor || row.borderColor || '#e5e7eb'}`);
  }
  if (column.borderWidth !== undefined || row.borderWidth !== undefined) {
    styles.push(`border-width: ${(column.borderWidth ?? row.borderWidth ?? 1)}px`);
  }
  if (column.borderStyle || row.borderStyle) {
    styles.push(`border-style: ${column.borderStyle || row.borderStyle || 'solid'}`);
  }

  return styles.join('; ');
}

/**
 * Render header content with icon
 */
function renderHeaderContent(column, styleSettings) {
  const hasIcon = column.icon && (column.icon.svg || column.icon.url || column.icon.name);
  const iconPosition = column.icon?.position || 'before';
  const title = column.title || '';

  if (!hasIcon || iconPosition === 'only') {
    if (hasIcon && iconPosition === 'only') {
      return column.icon.svg || '';
    }
    return title;
  }

  let html = '<div style="display: flex; align-items: center; gap: ' + (column.icon?.margin || 4) + 'px;">';
  
  if (iconPosition === 'before' || iconPosition === 'above') {
    if (column.icon.svg) html += column.icon.svg;
    if (iconPosition === 'above') html += '<br>';
    html += `<span>${title}</span>`;
  } else {
    html += `<span>${title}</span>`;
    if (iconPosition === 'below') html += '<br>';
    if (column.icon.svg) html += column.icon.svg;
  }
  
  html += '</div>';
  return html;
}

/**
 * Render cell content
 */
function renderCellContent(cell, column, styleSettings) {
  if (column.cellType === 'icon' && column.icon?.svg) {
    return column.icon.svg;
  }
  if (column.icon?.url) {
    return `<img src="${column.icon.url}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />`;
  }
  return String(cell || '');
}

