import { UUID } from './document.model';
import type { ChartHttpDataSourceConfig, TableHttpDataSourceConfig } from '../shared/http-request/models/http-data-source.model';

export type WidgetType =
  | 'text'
  | 'chart'
  | 'image'
  | 'shape'
  | 'media'
  | 'object'
  | 'table';

export interface WidgetModel<TProps = WidgetProps> {
  id: UUID;
  type: WidgetType;
  position: WidgetPosition;
  size: WidgetSize;
  rotation?: number;
  zIndex: number;
  locked?: boolean;
  props: TProps;
  style?: CssStyleObject;
}

export interface WidgetPosition {
  x: number;
  y: number;
}

export interface WidgetSize {
  width: number;
  height: number;
}

export type WidgetProps =
  | TextWidgetProps
  | ChartWidgetProps
  | ImageWidgetProps
  | ShapeWidgetProps
  | MediaWidgetProps
  | TableWidgetProps;

export interface TextWidgetProps {
  contentHtml: string;
  editorConfigId?: string;
  flowEnabled?: boolean;
  backgroundColor?: string;
}

export interface ChartWidgetProps {
  provider?: string;
  chartType?: string;
  data: unknown;
  renderMode?: 'svg' | 'canvas';
  exportedImage?: string;
  /** Optional persisted remote source (Postman-like request config). */
  dataSource?: ChartHttpDataSourceConfig | null;
  /** Optional transient UI state: show placeholder/skeleton while data is loading. */
  loading?: boolean;
  loadingMessage?: string;
}


export interface ImageWidgetProps {
  src: string;
  alt?: string;
  fit?: 'cover' | 'contain' | 'stretch';
}

export interface ShapeWidgetProps {
  shape: 'rectangle' | 'ellipse' | 'line' | 'triangle' | string;
  stroke?: ShapeStroke;
  fill?: string;
  borderRadius?: number;
}

export interface ShapeStroke {
  color: string;
  width: number;
  dashArray?: string;
}

export interface MediaWidgetProps {
  src: string;
  mediaType: 'video' | 'audio' | 'lottie';
  autoplay?: boolean;
  loop?: boolean;
  controls?: boolean;
}

export interface TableWidgetProps {
  rows: TableRow[];
  showBorders?: boolean;
  /** PPT-like table section flags (affect styling and some behaviors) */
  headerRow?: boolean;
  firstColumn?: boolean;
  totalRow?: boolean;
  lastColumn?: boolean;
  /**
   * Column sizing as fractions (sum to 1). Length should equal the top-level column count.
   * Used by the table widget for resizable columns and by PDF export for consistent layout.
   */
  columnFractions?: number[];
  /**
   * Row sizing as fractions (sum to 1). Length should equal the top-level row count.
   * Used by the table widget for resizable rows and by PDF export for consistent layout.
   */
  rowFractions?: number[];
  /**
   * Legacy merge representation (overlay-based).
   * Kept only for backwards compatibility with saved documents.
   *
   * New approach: merges are represented inline on `TableCell` via `merge` (anchor)
   * and `coveredBy` (covered cells), allowing merged areas to behave like normal cells.
   */
  mergedRegions?: TableMergedRegion[];
  /** Optional persisted remote source (Postman-like request config). */
  dataSource?: TableHttpDataSourceConfig | null;
  /** Optional transient UI state: show placeholder/skeleton while importing/loading. */
  loading?: boolean;
  loadingMessage?: string;
}

export interface TableMergedRegion {
  id: string;
  /** Leaf IDs (data-leaf values) covered by this merge */
  leafIds: string[];
  /** The top-left leaf in the region */
  anchorLeafId: string;
  /** Editable merged content */
  contentHtml: string;
  style?: TableCellStyle;
  /**
   * Optional split grid inside this merged region (so merged cells can be split further).
   */
  split?: TableCellSplit;
}

export interface TableRow {
  id: string;
  cells: TableCell[];
}

export interface TableCellSplit {
  rows: number;
  cols: number;
  /**
   * Flattened array (row-major), length = rows * cols
   */
  cells: TableCell[];
  /**
   * Optional persisted sizing for split grid columns (fractions that sum to 1).
   * Length should equal `cols`. When missing, UI defaults to equal columns.
   */
  columnFractions?: number[];
  /**
   * Optional persisted sizing for split grid rows (fractions that sum to 1).
   * Length should equal `rows`. When missing, UI defaults to equal rows.
   */
  rowFractions?: number[];
}

export interface TableCell {
  id: string;
  contentHtml: string;
  style?: TableCellStyle;
  /**
   * Optional split grid inside this cell.
   * When present, the cell renders as an RxC grid of child TableCells.
   */
  split?: TableCellSplit;
  /**
   * When present on an anchor cell, renders this cell as a real HTML table merge
   * using `rowspan` / `colspan`.
   */
  merge?: TableCellMerge;
  /**
   * When present, this cell is covered by a merged anchor cell at the given coordinates.
   * Covered cells are not rendered as <td> elements.
   */
  coveredBy?: { row: number; col: number };
}

export interface TableCellMerge {
  rowSpan: number;
  colSpan: number;
}

export interface TableCellStyle {
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  /**
   * Optional text decoration for the whole cell content.
   * Used for PPT-like multi-cell underline/strikethrough.
   */
  textDecoration?: 'none' | 'underline' | 'line-through' | 'underline line-through';
  /**
   * Optional font family for the cell (applies to the entire cell content).
   * Example: "Inter", "Arial", "Times New Roman".
   */
  fontFamily?: string;
  /**
   * Optional font size in pixels for the cell (applies to the entire cell content).
   */
  fontSizePx?: number;
  /** Optional text color for the whole cell content. */
  color?: string;
  /** Optional text highlight for the whole cell content (background on text layer). */
  textHighlightColor?: string;
  /** Optional line-height for the whole cell content (e.g. "1.4" or "20px"). */
  lineHeight?: string;
  /**
   * Cell fill / background color (applies to the cell container, not selected text).
   */
  backgroundColor?: string;
  /**
   * Optional cell border styling (applies to the cell container: <td> for normal cells,
   * and .table-widget__sub-cell for split cells).
   */
  borderColor?: string;
  /** Border width in pixels. */
  borderWidth?: number;
  borderStyle?: 'solid' | 'dashed' | 'dotted' | 'none';
}

export type CssStyleObject = Partial<
  Record<
    | 'fontFamily'
    | 'fontWeight'
    | 'fontSize'
    | 'color'
    | 'backgroundColor'
    | 'border'
    | 'borderRadius'
    | 'boxShadow'
    | 'opacity'
    | 'letterSpacing'
    | 'lineHeight',
    string | number
  >
>;

