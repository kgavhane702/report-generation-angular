import { UUID } from './document.model';

export type WidgetType =
  | 'text'
  | 'chart'
  | 'table'
  | 'image'
  | 'shape'
  | 'media'
  | 'object';

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
  | TableWidgetProps
  | ImageWidgetProps
  | ShapeWidgetProps
  | MediaWidgetProps;

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
}

import { TableStyleSettings, IconStyle, ColumnStyle, RowStyle, CellStyle } from './table-style.model';

export interface TableWidgetProps {
  provider?: string; // 'html-table' | 'ag-grid' | 'datatable' | etc.
  columns: TableColumn[];
  rows: TableRow[];
  allowIconsInColumns?: boolean;
  styleSettings?: TableStyleSettings;
}

export interface TableColumn extends ColumnStyle {
  id: string;
  title: string;
  widthPx?: number;
  minWidth?: number;
  maxWidth?: number;
  align?: 'left' | 'center' | 'right' | 'justify';
  icon?: TableColumnIcon | null;
  cellType?: 'text' | 'number' | 'currency' | 'icon';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  // Mark as header column (first column can be row header)
  isHeader?: boolean;
}

export interface TableColumnIcon {
  name?: string;
  svg?: string;
  url?: string;
  // Enhanced icon properties (using IconStyle from table-style.model)
  position?: 'before' | 'after' | 'below' | 'above' | 'only'; // Relative to text
  size?: number; // px (width and height)
  color?: string; // For SVG fill/stroke color
  margin?: number; // px (gap between icon and text)
  backgroundColor?: string; // Icon background
  borderRadius?: number; // Icon border radius
  padding?: number; // Icon padding
}

export interface TableRow extends RowStyle {
  id: string;
  cells: unknown[];
  // Mark row as header row (like first row or any row)
  isHeader?: boolean;
  height?: number; // px
  minHeight?: number;
  verticalAlign?: 'top' | 'middle' | 'bottom';
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

