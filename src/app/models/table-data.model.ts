/**
 * Helper utilities for table data operations (CSV import/export, etc.)
 */
import { TableWidgetProps, TableColumn, TableRow } from './widget.model';
import { v4 as uuid } from 'uuid';

/**
 * Parse CSV string to table data structure
 */
export function parseCsvToTableData(csv: string): { columns: TableColumn[]; rows: TableRow[] } {
  const lines = csv.trim().split('\n').filter(line => line.trim());
  if (lines.length === 0) {
    return { columns: [], rows: [] };
  }

  // First line is headers
  const headers = lines[0].split(',').map(h => h.trim());
  
  // Create columns from headers
  const columns: TableColumn[] = headers.map((header, index) => ({
    id: uuid(),
    title: header || `Column ${index + 1}`,
    widthPx: 120,
    align: 'left' as const,
    cellType: 'text' as const,
  }));

  // Parse data rows
  const rows: TableRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const cells: unknown[] = [];
    
    // Fill cells, defaulting empty values to empty string
    for (let j = 0; j < headers.length; j++) {
      cells.push(values[j] || '');
    }
    
    rows.push({
      id: uuid(),
      cells,
    });
  }

  return { columns, rows };
}

/**
 * Convert table data to CSV string
 */
export function tableDataToCsv(columns: TableColumn[], rows: TableRow[]): string {
  // Header row
  const headers = columns.map(col => col.title);
  const csvRows = [headers.join(',')];

  // Data rows
  rows.forEach(row => {
    const values = row.cells.map((cell, index) => {
      const value = String(cell || '');
      // Escape commas and quotes in CSV
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    csvRows.push(values.join(','));
  });

  return csvRows.join('\n');
}

/**
 * Create default table data structure
 */
export function createDefaultTableData(): { columns: TableColumn[]; rows: TableRow[] } {
  const columns: TableColumn[] = [
    {
      id: uuid(),
      title: 'Column 1',
      widthPx: 150,
      align: 'left',
      cellType: 'text',
    },
    {
      id: uuid(),
      title: 'Column 2',
      widthPx: 150,
      align: 'center',
      cellType: 'text',
    },
  ];

  const rows: TableRow[] = [
    {
      id: uuid(),
      cells: ['Row 1, Col 1', 'Row 1, Col 2'],
    },
    {
      id: uuid(),
      cells: ['Row 2, Col 1', 'Row 2, Col 2'],
    },
  ];

  return { columns, rows };
}

