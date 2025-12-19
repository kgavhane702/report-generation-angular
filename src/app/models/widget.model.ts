import { UUID } from './document.model';

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
  mergedRegions?: TableMergedRegion[];
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
}

export interface TableCellStyle {
  textAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
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

