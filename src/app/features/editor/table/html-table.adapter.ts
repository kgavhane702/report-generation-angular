import { TableStyleSettings } from 'src/app/models/table-style.model';
import { TableWidgetProps, TableColumn, TableRow } from 'src/app/models/widget.model';
import { TableAdapter, TableInstance } from './table-adapter';

/**
 * Default HTML table adapter - uses native HTML table elements.
 * Supports comprehensive styling similar to Microsoft Word/PowerPoint tables:
 * - Table-level styling (background, borders, alternate colors)
 * - Header styling (colors, fonts, icon positioning)
 * - Column-level styling
 * - Row-level styling (including row headers)
 * - Cell-level styling
 * - Icon styling (size, color, position, spacing)
 */
export class HtmlTableAdapter implements TableAdapter {
  readonly id = 'html-table';
  readonly label = 'HTML Table';

  render(container: HTMLElement, props: unknown): TableInstance {
    const tableProps = props as TableWidgetProps;
    const styleSettings = tableProps.styleSettings || {};

    // Clear container
    container.innerHTML = '';

    // Create table element
    const table = document.createElement('table');
    table.className = 'table-adapter';
    this.applyTableStyles(table, tableProps, styleSettings);

    // Determine if first column should be row header
    const showRowHeaders = styleSettings.showRowHeaders === true;

    // Create thead (only if not using first column as row header or if we have regular headers)
    if (!showRowHeaders || tableProps.columns.length > 1) {
      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');
      
      tableProps.columns.forEach((column, colIndex) => {
        // Skip first column if using it as row header
        if (showRowHeaders && colIndex === 0) {
          return;
        }

        const th = document.createElement('th');
        this.applyHeaderCellStyles(th, column, tableProps, styleSettings);
        this.renderHeaderContent(th, column, styleSettings);
        headerRow.appendChild(th);
      });

      thead.appendChild(headerRow);
      table.appendChild(thead);
    }

    // Create tbody
    const tbody = document.createElement('tbody');
    
    tableProps.rows.forEach((row, rowIndex) => {
      const tr = document.createElement('tr');
      this.applyRowStyles(tr, row, rowIndex, tableProps, styleSettings);
      
      row.cells.forEach((cell, cellIndex) => {
        const column = tableProps.columns[cellIndex];
        if (!column) return;

        // Create cell - use th for row header if:
        // 1. showRowHeaders is true AND it's the first column, OR
        // 2. The column itself is marked as isHeader, OR
        // 3. The row is marked as header AND it's the first column
        const isRowHeaderCell = 
          (showRowHeaders && cellIndex === 0) || 
          (column.isHeader === true) || 
          (row.isHeader && cellIndex === 0);
        const cellElement = isRowHeaderCell ? document.createElement('th') : document.createElement('td');

        this.applyCellStyles(cellElement, column, row, cellIndex, rowIndex, tableProps, styleSettings);
        this.renderCellContent(cellElement, cell, column, styleSettings);
        
        tr.appendChild(cellElement);
      });

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    container.appendChild(table);

    return {
      destroy() {
        container.innerHTML = '';
      },
    };
  }

  /**
   * Apply table-level styles
   */
  private applyTableStyles(table: HTMLTableElement, props: TableWidgetProps, styleSettings: TableStyleSettings): void {
    table.style.width = '100%';
    table.style.height = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.fontSize = styleSettings.headerStyle?.fontSize 
      ? `${styleSettings.headerStyle.fontSize}px` 
      : '14px';
    table.style.background = styleSettings.backgroundColor || 'rgba(255, 255, 255, 0.95)';

    // Border
    if (styleSettings.borderColor || styleSettings.borderWidth) {
      const borderWidth = styleSettings.borderWidth || 1;
      const borderStyle = styleSettings.borderStyle || 'solid';
      const borderColor = styleSettings.borderColor || '#e5e7eb';
      table.style.border = `${borderWidth}px ${borderStyle} ${borderColor}`;
    }

    // Border radius can be added via custom CSS if needed

    // Cell padding
    if (styleSettings.cellPadding !== undefined) {
      // Store in data attribute for use in cells
      table.setAttribute('data-cell-padding', styleSettings.cellPadding.toString());
    }

    table.className = 'table-adapter';
  }

  /**
   * Apply header cell styles
   */
  private applyHeaderCellStyles(
    th: HTMLTableCellElement,
    column: TableColumn,
    props: TableWidgetProps,
    styleSettings: TableStyleSettings
  ): void {
    const headerStyle = styleSettings.headerStyle || {};
    const cellPadding = styleSettings.cellPadding || 8;

    // Width
    if (column.widthPx) {
      th.style.width = `${column.widthPx}px`;
    }
    if (column.minWidth) {
      th.style.minWidth = `${column.minWidth}px`;
    }
    if (column.maxWidth) {
      th.style.maxWidth = `${column.maxWidth}px`;
    }

    // Background - priority: column-specific > headerStyle.backgroundColor > headerBackgroundColor > default
    const bgColor = column.backgroundColor || 
                   headerStyle.backgroundColor || 
                   styleSettings.headerBackgroundColor ||
                   '#f3f4f6';
    th.style.backgroundColor = bgColor;

    // Text color - priority: column-specific > headerStyle.textColor > headerTextColor > default
    const textColor = column.textColor || 
                     headerStyle.textColor || 
                     styleSettings.headerTextColor || 
                     '#111827';
    th.style.color = textColor;

    // Font
    const fontFamily = column.fontFamily || headerStyle.fontFamily || 'inherit';
    const fontSize = column.fontSize || headerStyle.fontSize || 14;
    const fontWeight = column.fontWeight || headerStyle.fontWeight || 'bold';
    th.style.fontFamily = fontFamily;
    th.style.fontSize = `${fontSize}px`;
    th.style.fontWeight = String(fontWeight);

    // Alignment
    const align = column.align || headerStyle.textAlign || 'left';
    th.style.textAlign = align;

    // Border
    const borderColor = column.borderColor || headerStyle.borderColor || '#e5e7eb';
    const borderWidth = column.borderWidth || headerStyle.borderWidth || 1;
    const borderStyle = column.borderStyle || headerStyle.borderStyle || 'solid';
    th.style.border = `${borderWidth}px ${borderStyle} ${borderColor}`;

    // Padding
    const padding = column.padding || headerStyle.padding || cellPadding;
    th.style.padding = `${padding}px`;
  }

  /**
   * Render header content with icon positioning support
   */
  private renderHeaderContent(
    th: HTMLTableCellElement,
    column: TableColumn,
    styleSettings: TableStyleSettings
  ): void {
    // Always show text, even if icon is present (unless position is 'only')
    const hasIcon = column.icon && (column.icon.svg || column.icon.url || column.icon.name);
    const iconPosition = column.icon?.position || 'before';
    
    if (hasIcon && iconPosition === 'only') {
      // Icon only mode - no text
      const iconElement = this.createIconElement(column.icon, styleSettings);
      th.appendChild(iconElement);
      return;
    }

    // Create container for icon + text
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.gap = `${column.icon?.margin || 8}px`;

    // Always create text span
    const textSpan = document.createElement('span');
    textSpan.textContent = column.title || '';
    textSpan.style.flex = '1';

    // Add icon if present
    if (hasIcon) {
      const iconElement = this.createIconElement(column.icon, styleSettings);
      
      switch (iconPosition) {
        case 'before':
          container.style.flexDirection = 'row';
          container.appendChild(iconElement);
          container.appendChild(textSpan);
          break;
        case 'after':
          container.style.flexDirection = 'row';
          container.appendChild(textSpan);
          container.appendChild(iconElement);
          break;
        case 'above':
          container.style.flexDirection = 'column';
          container.appendChild(iconElement);
          container.appendChild(textSpan);
          break;
        case 'below':
          container.style.flexDirection = 'column';
          container.appendChild(textSpan);
          container.appendChild(iconElement);
          break;
        default:
          // Default to before
          container.style.flexDirection = 'row';
          container.appendChild(iconElement);
          container.appendChild(textSpan);
      }
    } else {
      // No icon, just text
      container.appendChild(textSpan);
    }

    th.appendChild(container);
  }

  /**
   * Apply row styles
   */
  private applyRowStyles(
    tr: HTMLTableRowElement,
    row: TableRow,
    rowIndex: number,
    props: TableWidgetProps,
    styleSettings: TableStyleSettings
  ): void {
    // Height
    if (row.height) {
      tr.style.height = `${row.height}px`;
    }
    if (row.minHeight) {
      tr.style.minHeight = `${row.minHeight}px`;
    }

    // Background - alternate rows or row-specific
    let bgColor = row.backgroundColor;
    if (!bgColor && styleSettings.alternateRowColor) {
      bgColor = rowIndex % 2 === 0 
        ? (styleSettings.alternateRowColor || undefined)
        : undefined;
    }
    if (bgColor) {
      tr.style.backgroundColor = bgColor;
    }

    // Font
    if (row.fontFamily) {
      tr.style.fontFamily = row.fontFamily;
    }
    if (row.fontSize) {
      tr.style.fontSize = `${row.fontSize}px`;
    }
    if (row.fontWeight) {
      tr.style.fontWeight = String(row.fontWeight);
    }

    // Border
    if (row.borderColor) {
      const borderWidth = row.borderWidth || 1;
      const borderStyle = row.borderStyle || 'solid';
      tr.style.border = `${borderWidth}px ${borderStyle} ${row.borderColor}`;
    }

    // Row header styling
    if (row.isHeader || (styleSettings.showRowHeaders && rowIndex === 0)) {
      const rowHeaderStyle = styleSettings.rowHeaderStyle || styleSettings.headerStyle || {};
      if (rowHeaderStyle.backgroundColor) {
        tr.style.backgroundColor = rowHeaderStyle.backgroundColor;
      }
      if (rowHeaderStyle.textColor) {
        tr.style.color = rowHeaderStyle.textColor;
      }
      if (rowHeaderStyle.fontWeight) {
        tr.style.fontWeight = String(rowHeaderStyle.fontWeight);
      }
    }
  }

  /**
   * Apply cell styles
   */
  private applyCellStyles(
    cell: HTMLTableCellElement,
    column: TableColumn,
    row: TableRow,
    cellIndex: number,
    rowIndex: number,
    props: TableWidgetProps,
    styleSettings: TableStyleSettings
  ): void {
    const cellPadding = styleSettings.cellPadding || 8;
    const showRowHeaders = styleSettings.showRowHeaders === true;
    // column is already passed as parameter, no need to redeclare
    const isRowHeaderCell = 
      (showRowHeaders && cellIndex === 0) || 
      (column?.isHeader === true) || 
      (row.isHeader && cellIndex === 0);

    // Width
    if (column.widthPx) {
      cell.style.width = `${column.widthPx}px`;
    }
    if (column.minWidth) {
      cell.style.minWidth = `${column.minWidth}px`;
    }
    if (column.maxWidth) {
      cell.style.maxWidth = `${column.maxWidth}px`;
    }

    // Background - column-specific, alternate column, row-specific, or alternate row
    let bgColor = column.backgroundColor || row.backgroundColor;
    
    // Alternate column color
    if (!bgColor && styleSettings.alternateColumnColor && cellIndex % 2 === 1) {
      bgColor = styleSettings.alternateColumnColor;
    }
    
    // Alternate row color
    if (!bgColor && styleSettings.alternateRowColor && rowIndex % 2 === 0) {
      bgColor = styleSettings.alternateRowColor;
    }

    // Row header cell styling
    if (isRowHeaderCell) {
      const rowHeaderStyle = styleSettings.rowHeaderStyle || styleSettings.headerStyle || {};
      bgColor = rowHeaderStyle.backgroundColor || bgColor || '#f3f4f6';
      if (rowHeaderStyle.textColor) {
        cell.style.color = rowHeaderStyle.textColor;
      }
      if (rowHeaderStyle.fontWeight) {
        cell.style.fontWeight = String(rowHeaderStyle.fontWeight);
      }
    }

    if (bgColor) {
      cell.style.backgroundColor = bgColor;
    }

    // Text color
    if (column.textColor) {
      cell.style.color = column.textColor;
    } else if (row.fontFamily && !isRowHeaderCell) {
      // Use row text color if specified
    }

    // Font
    const fontFamily = column.fontFamily || row.fontFamily;
    const fontSize = column.fontSize || row.fontSize;
    const fontWeight = column.fontWeight || row.fontWeight;
    if (fontFamily) cell.style.fontFamily = fontFamily;
    if (fontSize) cell.style.fontSize = `${fontSize}px`;
    if (fontWeight) cell.style.fontWeight = String(fontWeight);

    // Alignment
    const align = column.align || 'left';
    cell.style.textAlign = align;

    // Border
    const borderColor = column.borderColor || '#e5e7eb';
    const borderWidth = column.borderWidth || 1;
    const borderStyle = column.borderStyle || 'solid';
    cell.style.border = `${borderWidth}px ${borderStyle} ${borderColor}`;

    // Padding
    const padding = column.padding || row.padding || cellPadding;
    cell.style.padding = `${padding}px`;

    // Vertical alignment
    const verticalAlign = column.verticalAlign || row.verticalAlign || 'middle';
    cell.style.verticalAlign = verticalAlign;

    // Text wrap - allow wrapping by default
    cell.style.whiteSpace = 'normal';
    cell.style.wordWrap = 'break-word';
  }

  /**
   * Render cell content based on cell type
   */
  private renderCellContent(
    cell: HTMLTableCellElement,
    cellValue: unknown,
    column: TableColumn,
    styleSettings: TableStyleSettings
  ): void {
    if (column.cellType === 'icon') {
      const iconSpan = document.createElement('span');
      iconSpan.style.display = 'inline-flex';
      iconSpan.style.alignItems = 'center';
      
      const iconSize = column.icon?.size || 20;
      iconSpan.style.width = `${iconSize}px`;
      iconSpan.style.height = `${iconSize}px`;
      
      const cellStr = String(cellValue || '');
      if (typeof cellValue === 'string' && (cellStr.includes('<svg') || cellStr.includes('<img'))) {
        iconSpan.innerHTML = cellStr;
      } else if (column.icon?.svg) {
        let svgContent = column.icon.svg;
        // Apply icon color to SVG
        if (column.icon.color) {
          svgContent = svgContent.replace(/fill="[^"]*"/g, `fill="${column.icon.color}"`);
          svgContent = svgContent.replace(/stroke="[^"]*"/g, `stroke="${column.icon.color}"`);
        }
        iconSpan.innerHTML = svgContent;
      } else {
        iconSpan.textContent = cellStr;
      }
      
      cell.appendChild(iconSpan);
    } else if (column.cellType === 'currency') {
      const value = typeof cellValue === 'number' ? cellValue : parseFloat(String(cellValue)) || 0;
      cell.textContent = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(value);
    } else if (column.cellType === 'number') {
      const value = typeof cellValue === 'number' ? cellValue : parseFloat(String(cellValue)) || 0;
      cell.textContent = value.toLocaleString();
    } else {
      cell.textContent = String(cellValue || '');
    }
  }

  /**
   * Create icon element with styling
   */
  private createIconElement(icon: TableColumn['icon'], styleSettings: TableStyleSettings): HTMLElement {
    const iconContainer = document.createElement('span');
    iconContainer.style.display = 'inline-flex';
    iconContainer.style.alignItems = 'center';
    iconContainer.style.justifyContent = 'center';
    
    const iconSize = icon?.size || 16;
    iconContainer.style.width = `${iconSize}px`;
    iconContainer.style.height = `${iconSize}px`;
    
    // Icon background
    if (icon?.backgroundColor) {
      iconContainer.style.backgroundColor = icon.backgroundColor;
    }
    
    // Icon border radius
    if (icon?.borderRadius !== undefined) {
      iconContainer.style.borderRadius = `${icon.borderRadius}px`;
    }
    
    // Icon padding
    if (icon?.padding !== undefined) {
      iconContainer.style.padding = `${icon.padding}px`;
    }
    
    // Icon color
    if (icon?.color) {
      iconContainer.style.color = icon.color;
    }

    const iconInner = document.createElement('span');
    iconInner.style.display = 'flex';
    iconInner.style.alignItems = 'center';
    iconInner.style.justifyContent = 'center';
    iconInner.style.width = '100%';
    iconInner.style.height = '100%';

    if (icon?.svg) {
      let svgContent = icon.svg;
      // Apply icon color to SVG if specified
      if (icon.color) {
        svgContent = svgContent.replace(/fill="[^"]*"/g, `fill="${icon.color}"`);
        svgContent = svgContent.replace(/stroke="[^"]*"/g, `stroke="${icon.color}"`);
        // Also add fill/stroke if not present
        if (!svgContent.includes('fill=')) {
          svgContent = svgContent.replace('<svg', `<svg fill="${icon.color}"`);
        }
        if (!svgContent.includes('stroke=') && svgContent.includes('<path')) {
          svgContent = svgContent.replace('<path', `<path stroke="${icon.color}"`);
        }
      }
      iconInner.innerHTML = svgContent;
    } else if (icon?.url) {
      const img = document.createElement('img');
      img.src = icon.url;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'contain';
      iconInner.appendChild(img);
    } else if (icon?.name) {
      iconInner.textContent = icon.name;
      iconInner.style.fontSize = `${iconSize * 0.8}px`;
    }

    iconContainer.appendChild(iconInner);
    return iconContainer;
  }
}
