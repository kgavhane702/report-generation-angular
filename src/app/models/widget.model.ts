import { UUID } from './document.model';
import type { ChartHttpDataSourceConfig, TableHttpDataSourceConfig } from '../shared/http-request/models/http-data-source.model';

export type WidgetType =
  | 'text'
  | 'chart'
  | 'image'
  | 'editastra'
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
  | EditastraWidgetProps
  | ShapeWidgetProps
  | MediaWidgetProps
  | TableWidgetProps;

export interface TextWidgetProps {
  contentHtml: string;
  editorConfigId?: string;
  flowEnabled?: boolean;
  backgroundColor?: string;
}

/**
 * EditastraWidgetProps
 *
 * Temporary widget that hosts the same custom contenteditable editor used in tables,
 * extracted as a reusable component ("Editastra").
 */
export interface EditastraWidgetProps {
  contentHtml: string;
  placeholder?: string;
  backgroundColor?: string;
  /** Vertical alignment of the text block inside the widget (PPT-like). */
  verticalAlign?: 'top' | 'middle' | 'bottom';
  /** Optional persisted remote source (Postman-like request config). */
  dataSource?: TableHttpDataSourceConfig | null;
  /** Optional transient UI state: show placeholder/skeleton while importing/loading. */
  loading?: boolean;
  loadingMessage?: string;
  /** Optional transient UI state: error message when URL load fails. */
  errorMessage?: string;
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
  /** Optional transient UI state: error message when URL load fails. */
  errorMessage?: string;
}


export interface ImageWidgetProps {
  src: string;
  alt?: string;
  fit?: 'cover' | 'contain' | 'stretch';
  // Transform properties
  flipHorizontal?: boolean;
  flipVertical?: boolean;
  rotation?: number; // degrees: 0, 90, 180, 270
  // Style properties
  opacity?: number; // 0-100
  borderWidth?: number; // px
  borderColor?: string; // hex color
  borderStyle?: 'solid' | 'dashed' | 'dotted' | 'none'; // border style
  borderRadius?: number; // px
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
   * Optional header row count for multi-row headers.
   * - When `headerRow` is true and this is missing, assume 1.
   * - When `headerRow` is false, treat as 0.
   */
  headerRowCount?: number;
  /**
   * URL tables: when enabled, preserve the existing header row(s) (including split header cells)
   * across export/import and URL auto-load. Remote data replaces only the body.
   *
   * Default: false (current behavior).
   */
  preserveHeaderOnUrlLoad?: boolean;
  /**
   * Column-level conditional formatting rules (header-defined).
   * These are persisted in the document JSON and applied at render time (does not mutate rows),
   * so they continue to work for URL tables when data reloads.
   */
  columnRules?: TableColumnRuleSet[];
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
  /** Optional transient UI state: error message when URL load fails. */
  errorMessage?: string;
}

export type TableRuleValueType = 'auto' | 'text' | 'number' | 'date';

export type TableConditionOperator =
  | 'isEmpty'
  | 'isNotEmpty'
  | 'equals'
  | 'notEquals'
  | 'equalsIgnoreCase'
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'inList'
  | 'notInList'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'lessThan'
  | 'lessThanOrEqual'
  | 'between'
  | 'notBetween'
  | 'before'
  | 'after'
  | 'on'
  | 'betweenDates';

export interface TableConditionWhen {
  op: TableConditionOperator;
  /** Optional hint for how to interpret the operands. */
  valueType?: TableRuleValueType;
  /** Single operand (text/number/date as string). */
  value?: string;
  /** Range operands (numbers/dates as strings). */
  min?: string;
  max?: string;
  /** List operands (used by inList/notInList). */
  values?: string[];
  /** Text operators: case sensitivity. */
  ignoreCase?: boolean;
}

export type TableConditionLogic = 'and' | 'or';

/**
 * Group multiple conditions into a single rule expression.
 * - logic='and' -> all conditions must match
 * - logic='or'  -> any condition may match
 */
export interface TableConditionGroup {
  logic: TableConditionLogic;
  conditions: TableConditionWhen[];
}

export type TableRuleWhen = TableConditionWhen | TableConditionGroup;

export interface TableConditionThen {
  /** Optional CSS class name to apply to the cell surface. */
  cellClass?: string;
  backgroundColor?: string;
  textColor?: string;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline' | 'line-through' | 'underline line-through';
  /** Optional tooltip text. */
  tooltip?: string;
}

export interface TableConditionRule {
  id: string;
  enabled?: boolean;
  /** Lower numbers run first (default 0). */
  priority?: number;
  when: TableRuleWhen;
  then: TableConditionThen;
  /** If true and matched, stop evaluating further rules for this column. */
  stopIfTrue?: boolean;
}

/**
 * Structured target for a column rule-set.
 *
 * - `whole`: applies to the whole top-level column (and also to unsplit body cells).
 * - `leaf`: applies to a specific split-leaf column inside a top-level column.\n+ *
 * `leafPath` encodes ONLY the column indices encountered across nested splits where `cols > 1`.\n+ * (It does not include row indices from the widget leaf-id path.)
 */
export type TableColumnTarget =
  | { kind: 'whole'; topColIndex: number }
  | { kind: 'leaf'; topColIndex: number; leafPath: number[] };

export interface TableColumnRuleSet {
  target: TableColumnTarget;
  /** Optional display name captured when the rule set is saved. */
  displayName?: string;
  enabled?: boolean;
  /** Future: allow rule-group semantics. v1 evaluator still applies rules by priority/order. */
  matchMode?: 'all' | 'any';
  rules: TableConditionRule[];
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

