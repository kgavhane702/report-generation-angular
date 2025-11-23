/**
 * Comprehensive table styling model
 * Similar to Microsoft Word/PowerPoint table styling options
 */

/**
 * Icon position relative to text
 */
export type IconPosition = 'left' | 'right' | 'above' | 'below' | 'only';

/**
 * Border style
 */
export type BorderStyle = 'solid' | 'dashed' | 'dotted' | 'double' | 'none';

/**
 * Table-level styling settings
 */
export interface TableStyleSettings {
  // Background
  backgroundColor?: string;
  
  // Borders
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: BorderStyle;
  
  // Alternating colors
  alternateRowColor?: string;
  alternateColumnColor?: string;
  headerRowColor?: string;
  headerColumnColor?: string;
  
  // Spacing
  cellPadding?: number;
  cellSpacing?: number;
  
  // Border radius
  borderRadius?: number;
  
  // Width and height
  minWidth?: number;
  minHeight?: number;
  
  // Text wrapping
  textWrap?: boolean;
  
  // Header settings
  headerStyle?: TableHeaderStyleSettings;
  
  // First column as row header
  useFirstColumnAsRowHeader?: boolean;
  rowHeaderStyle?: TableHeaderStyleSettings;
}

/**
 * Header styling settings (for both column headers and row headers)
 */
export interface TableHeaderStyleSettings {
  backgroundColor?: string;
  textColor?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold' | 'bolder' | 'lighter' | number;
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: BorderStyle;
  padding?: number;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
}

/**
 * Column-level style configuration
 */
export interface TableColumnStyleConfig {
  columnId: string;
  backgroundColor?: string;
  textColor?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold' | 'bolder' | 'lighter' | number;
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: BorderStyle;
  padding?: number;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  width?: number;
  minWidth?: number;
  maxWidth?: number;
}

/**
 * Row-level style configuration
 */
export interface TableRowStyleConfig {
  rowId: string;
  backgroundColor?: string;
  textColor?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold' | 'bolder' | 'lighter' | number;
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: BorderStyle;
  padding?: number;
  height?: number;
  minHeight?: number;
  isHeader?: boolean; // Mark as header row
}

/**
 * Cell-level style configuration
 */
export interface TableCellStyleConfig {
  rowId: string;
  columnId: string;
  backgroundColor?: string;
  textColor?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold' | 'bolder' | 'lighter' | number;
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: BorderStyle;
  padding?: number;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  verticalAlign?: 'top' | 'middle' | 'bottom';
}

/**
 * Icon style configuration
 */
export interface TableIconStyleConfig {
  size?: number; // px
  color?: string; // For SVG fill/stroke color
  position?: IconPosition;
  spacing?: number; // px (gap between icon and text)
  backgroundColor?: string;
  borderRadius?: number;
  padding?: number;
}
