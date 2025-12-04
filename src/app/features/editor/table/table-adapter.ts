/**
 * Interface for pluggable table adapters.
 * Allows swapping table implementations (HTML table, AG-Grid, ngx-datatable, etc.)
 */
export interface TableAdapter {
  /**
   * Unique identifier for this adapter (e.g., 'html-table', 'ag-grid', 'datatable')
   */
  id: string;

  /**
   * Display label for this adapter
   */
  label: string;

  /**
   * Render the table in the given container with the provided props
   * @param container - The HTML element to render the table into
   * @param props - Table widget props containing columns, rows, and styling
   * @returns TableInstance for managing the table lifecycle
   */
  render(container: HTMLElement, props: unknown): TableInstance | void;

  /**
   * Optional cleanup method when table is destroyed
   */
  destroy?(instance: TableInstance): void;
}

/**
 * Interface representing a table instance
 */
export interface TableInstance {
  /**
   * Optional cleanup method
   */
  destroy?: () => void;

  /**
   * Optional method to update table data without full re-render
   */
  updateData?: (props: unknown) => void;
}

