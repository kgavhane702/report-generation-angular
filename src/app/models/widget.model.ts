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
}

export interface ChartWidgetProps {
  provider?: string;
  chartType?: string;
  data: unknown;
  renderMode?: 'svg' | 'canvas';
}

export interface TableWidgetProps {
  columns: TableColumn[];
  rows: TableRow[];
  allowIconsInColumns?: boolean;
  styleSettings?: Record<string, unknown>;
}

export interface TableColumn {
  id: string;
  title: string;
  widthPx?: number;
  align?: 'left' | 'center' | 'right';
  icon?: TableColumnIcon | null;
  cellType?: 'text' | 'number' | 'currency' | 'icon';
}

export interface TableColumnIcon {
  name?: string;
  svg?: string;
  url?: string;
}

export interface TableRow {
  id: string;
  cells: unknown[];
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

