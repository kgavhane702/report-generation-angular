import { TableAdapter, TableInstance } from './table-adapter';
import { TableWidgetProps, TableColumn, TableRow } from '../../../../models/widget.model';

/**
 * Default HTML table adapter - uses native HTML table elements.
 * This is the simplest implementation and can be replaced with
 * any table library (AG-Grid, ngx-datatable, PrimeNG Table, etc.)
 */
export class HtmlTableAdapter implements TableAdapter {
  readonly id = 'html-table';
  readonly label = 'HTML Table';

  render(container: HTMLElement, props: unknown): TableInstance {
    const tableProps = props as TableWidgetProps;

    // Clear container
    container.innerHTML = '';

    // Create table element
    const table = document.createElement('table');
    table.className = 'table-adapter';
    this.applyTableStyles(table, tableProps);

    // Create thead
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    tableProps.columns.forEach((column) => {
      const th = document.createElement('th');
      th.style.width = column.widthPx ? `${column.widthPx}px` : 'auto';
      th.style.textAlign = column.align || 'left';

      // Column header with icon support
      const headerContent = document.createElement('div');
      headerContent.style.display = 'flex';
      headerContent.style.alignItems = 'center';
      headerContent.style.gap = '8px';

      if (column.icon) {
        const iconSpan = document.createElement('span');
        iconSpan.style.display = 'inline-flex';
        iconSpan.style.alignItems = 'center';
        iconSpan.style.width = '16px';
        iconSpan.style.height = '16px';
        
        if (column.icon.svg) {
          iconSpan.innerHTML = column.icon.svg;
        } else if (column.icon.url) {
          const img = document.createElement('img');
          img.src = column.icon.url;
          img.style.width = '100%';
          img.style.height = '100%';
          iconSpan.appendChild(img);
        } else if (column.icon.name) {
          iconSpan.textContent = column.icon.name;
        }
        
        headerContent.appendChild(iconSpan);
      }

      const titleSpan = document.createElement('span');
      titleSpan.textContent = column.title;
      headerContent.appendChild(titleSpan);

      th.appendChild(headerContent);
      headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Create tbody
    const tbody = document.createElement('tbody');
    
    tableProps.rows.forEach((row) => {
      const tr = document.createElement('tr');
      
      row.cells.forEach((cell, index) => {
        const column = tableProps.columns[index];
        if (!column) return;

        const td = document.createElement('td');
        td.style.textAlign = column.align || 'left';
        td.style.padding = '8px 12px';
        td.style.borderBottom = '1px solid rgba(0, 0, 0, 0.1)';

        // Render cell based on column type
        if (column.cellType === 'icon') {
          const iconSpan = document.createElement('span');
          iconSpan.style.display = 'inline-flex';
          iconSpan.style.alignItems = 'center';
          iconSpan.style.width = '20px';
          iconSpan.style.height = '20px';
          
          const cellStr = String(cell || '');
          if (typeof cell === 'string' && (cellStr.includes('<svg') || cellStr.includes('<img'))) {
            iconSpan.innerHTML = cellStr;
          } else if (column.icon?.svg) {
            iconSpan.innerHTML = column.icon.svg;
          } else {
            iconSpan.textContent = cellStr;
          }
          
          td.appendChild(iconSpan);
        } else if (column.cellType === 'currency') {
          const value = typeof cell === 'number' ? cell : parseFloat(String(cell)) || 0;
          td.textContent = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
          }).format(value);
        } else if (column.cellType === 'number') {
          const value = typeof cell === 'number' ? cell : parseFloat(String(cell)) || 0;
          td.textContent = value.toLocaleString();
        } else {
          td.textContent = String(cell || '');
        }

        tr.appendChild(td);
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
   * Apply table styling based on styleSettings
   */
  private applyTableStyles(table: HTMLTableElement, props: TableWidgetProps): void {
    table.style.width = '100%';
    table.style.height = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.fontSize = '0.875rem';
    table.style.background = 'rgba(255, 255, 255, 0.95)';

    // Apply custom styles from styleSettings if provided
    if (props.styleSettings) {
      Object.entries(props.styleSettings).forEach(([key, value]) => {
        (table.style as any)[key] = value;
      });
    }

    // Add default styles via class
    table.className = 'table-adapter';
  }
}

