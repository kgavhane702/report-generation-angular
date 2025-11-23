/**
 * Comprehensive table styling models
 * Similar to Microsoft Word/PowerPoint table customization options
 */

export interface TableStyleSettings {
  // Header styling
  headerStyle?: CellStyle;
  headerBackgroundColor?: string;
  headerTextColor?: string;
  headerBorderColor?: string;
  headerBorderWidth?: number;
  
  // Body styling
  bodyStyle?: CellStyle;
  alternateRowColor?: string;
  alternateColumnColor?: string;
  rowHeaderStyle?: CellStyle;
  rowHeaderBackgroundColor?: string;
  
  // Table borders
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: 'solid' | 'dashed' | 'dotted' | 'none';
  
  // Spacing
  cellPadding?: number;
  cellSpacing?: number;
  
  // Global styles
  fontFamily?: string;
  fontSize?: number;
  textColor?: string;
  backgroundColor?: string;
  
  // Row header configuration
  showRowHeaders?: boolean;
  rowHeaderWidth?: number;
}

export interface CellStyle {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold' | 'lighter' | 'bolder' | number;
  fontStyle?: 'normal' | 'italic' | 'oblique';
  textColor?: string;
  backgroundColor?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  padding?: number;
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: 'solid' | 'dashed' | 'dotted' | 'none';
}

export interface IconStyle {
  // Icon positioning relative to text
  position?: 'before' | 'after' | 'below' | 'above';
  size?: number; // in pixels
  color?: string;
  margin?: number; // spacing from text
  alignment?: 'left' | 'center' | 'right';
}

export interface ColumnStyle extends CellStyle {
  iconStyle?: IconStyle;
  alternateColumnColor?: string;
  width?: number;
}

export interface RowStyle extends CellStyle {
  alternateRowColor?: string;
  isHeader?: boolean; // For row headers
  height?: number;
}

export interface TableTemplate {
  id: string;
  name: string;
  description?: string;
  styleSettings: TableStyleSettings;
  preview?: string; // Preview image URL or base64
}

