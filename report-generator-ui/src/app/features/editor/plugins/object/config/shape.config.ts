/**
 * Shape Configuration
 * 
 * Central configuration for all available shapes in the object widget.
 * Add new shapes here and they will automatically appear in the shape selector.
 */

/**
 * Shape category for grouping shapes in the UI
 */
export type ShapeCategory = 
  | 'basic'
  | 'arrows'
  | 'flowchart'
  | 'callouts'
  | 'stars'
  | 'symbols'
  | 'custom';

/**
 * Configuration for a single shape
 */
export interface ShapeConfig {
  /** Unique identifier for the shape (used as shapeType in widget props) */
  id: string;
  /** Display name shown in UI */
  label: string;
  /** Icon name for the shape (relative to assets/icons/) */
  icon: string;
  /** Category for grouping */
  category: ShapeCategory;
  /** Tooltip/description */
  description?: string;
  /** Default fill color (hex) */
  defaultFillColor?: string;
  /** Default border radius for applicable shapes */
  defaultBorderRadius?: number;
  /** Whether this shape supports border radius */
  supportsBorderRadius?: boolean;
  /** SVG path data for custom shapes (optional) */
  svgPath?: string;
  /** Order within category for sorting */
  order?: number;
}

/**
 * All available shapes organized by category
 */
export const SHAPE_CONFIGS: ShapeConfig[] = [
  // ============================================
  // BASIC SHAPES
  // ============================================
  {
    id: 'rectangle',
    label: 'Rectangle',
    icon: 'shapes/rectangle',
    category: 'basic',
    description: 'Insert a rectangle shape',
    defaultFillColor: '#3b82f6',
    supportsBorderRadius: true,
    defaultBorderRadius: 0,
    order: 1,
  },
  {
    id: 'circle',
    label: 'Circle',
    icon: 'shapes/circle',
    category: 'basic',
    description: 'Insert a circle shape',
    defaultFillColor: '#3b82f6',
    supportsBorderRadius: false,
    order: 2,
  },
  {
    id: 'ellipse',
    label: 'Ellipse',
    icon: 'shapes/ellipse',
    category: 'basic',
    description: 'Insert an ellipse shape',
    defaultFillColor: '#3b82f6',
    supportsBorderRadius: false,
    order: 3,
  },
  {
    id: 'square',
    label: 'Square',
    icon: 'shapes/square',
    category: 'basic',
    description: 'Insert a square shape',
    defaultFillColor: '#3b82f6',
    supportsBorderRadius: true,
    defaultBorderRadius: 0,
    order: 4,
  },
  {
    id: 'rounded-rectangle',
    label: 'Rounded Rectangle',
    icon: 'shapes/rounded_rectangle',
    category: 'basic',
    description: 'Insert a rounded rectangle shape',
    defaultFillColor: '#3b82f6',
    supportsBorderRadius: true,
    defaultBorderRadius: 12,
    order: 5,
  },
  {
    id: 'triangle',
    label: 'Triangle',
    icon: 'shapes/triangle',
    category: 'basic',
    description: 'Insert a triangle shape',
    defaultFillColor: '#3b82f6',
    supportsBorderRadius: false,
    order: 6,
  },
  {
    id: 'diamond',
    label: 'Diamond',
    icon: 'shapes/diamond',
    category: 'basic',
    description: 'Insert a diamond shape',
    defaultFillColor: '#3b82f6',
    supportsBorderRadius: false,
    order: 7,
  },
  {
    id: 'pentagon',
    label: 'Pentagon',
    icon: 'shapes/pentagon',
    category: 'basic',
    description: 'Insert a pentagon shape',
    defaultFillColor: '#3b82f6',
    supportsBorderRadius: false,
    order: 8,
  },
  {
    id: 'hexagon',
    label: 'Hexagon',
    icon: 'shapes/hexagon',
    category: 'basic',
    description: 'Insert a hexagon shape',
    defaultFillColor: '#3b82f6',
    supportsBorderRadius: false,
    order: 9,
  },
  {
    id: 'line',
    label: 'Line',
    icon: 'shapes/line',
    category: 'basic',
    description: 'Insert a line',
    defaultFillColor: '#000000',
    supportsBorderRadius: false,
    order: 10,
  },

  // ============================================
  // ARROWS
  // ============================================
  {
    id: 'arrow-right',
    label: 'Arrow Right',
    icon: 'shapes/arrow_right_shape',
    category: 'arrows',
    description: 'Insert a right arrow',
    defaultFillColor: '#3b82f6',
    order: 1,
  },
  {
    id: 'arrow-left',
    label: 'Arrow Left',
    icon: 'shapes/arrow_left_shape',
    category: 'arrows',
    description: 'Insert a left arrow',
    defaultFillColor: '#3b82f6',
    order: 2,
  },
  {
    id: 'arrow-up',
    label: 'Arrow Up',
    icon: 'shapes/arrow_up_shape',
    category: 'arrows',
    description: 'Insert an up arrow',
    defaultFillColor: '#3b82f6',
    order: 3,
  },
  {
    id: 'arrow-down',
    label: 'Arrow Down',
    icon: 'shapes/arrow_down_shape',
    category: 'arrows',
    description: 'Insert a down arrow',
    defaultFillColor: '#3b82f6',
    order: 4,
  },
  {
    id: 'arrow-double',
    label: 'Double Arrow',
    icon: 'shapes/arrow_double',
    category: 'arrows',
    description: 'Insert a double-headed arrow',
    defaultFillColor: '#3b82f6',
    order: 5,
  },

  // ============================================
  // FLOWCHART
  // ============================================
  {
    id: 'flowchart-process',
    label: 'Process',
    icon: 'shapes/flowchart_process',
    category: 'flowchart',
    description: 'Flowchart process shape',
    defaultFillColor: '#3b82f6',
    supportsBorderRadius: true,
    order: 1,
  },
  {
    id: 'flowchart-decision',
    label: 'Decision',
    icon: 'shapes/flowchart_decision',
    category: 'flowchart',
    description: 'Flowchart decision shape',
    defaultFillColor: '#f59e0b',
    order: 2,
  },
  {
    id: 'flowchart-terminator',
    label: 'Terminator',
    icon: 'shapes/flowchart_terminator',
    category: 'flowchart',
    description: 'Flowchart start/end shape',
    defaultFillColor: '#10b981',
    order: 3,
  },
  {
    id: 'flowchart-data',
    label: 'Data',
    icon: 'shapes/flowchart_data',
    category: 'flowchart',
    description: 'Flowchart data shape',
    defaultFillColor: '#8b5cf6',
    order: 4,
  },

  // ============================================
  // CALLOUTS
  // ============================================
  {
    id: 'callout-rectangle',
    label: 'Rectangle Callout',
    icon: 'shapes/callout_rectangle',
    category: 'callouts',
    description: 'Insert a rectangle callout',
    defaultFillColor: '#fef3c7',
    order: 1,
  },
  {
    id: 'callout-rounded',
    label: 'Rounded Callout',
    icon: 'shapes/callout_rounded',
    category: 'callouts',
    description: 'Insert a rounded callout',
    defaultFillColor: '#fef3c7',
    order: 2,
  },

  // ============================================
  // STARS & BANNERS
  // ============================================
  {
    id: 'star-4',
    label: '4-Point Star',
    icon: 'shapes/star_4',
    category: 'stars',
    description: 'Insert a 4-point star',
    defaultFillColor: '#f59e0b',
    order: 1,
  },
  {
    id: 'star-5',
    label: '5-Point Star',
    icon: 'shapes/star_5',
    category: 'stars',
    description: 'Insert a 5-point star',
    defaultFillColor: '#f59e0b',
    order: 2,
  },
  {
    id: 'star-6',
    label: '6-Point Star',
    icon: 'shapes/star_6',
    category: 'stars',
    description: 'Insert a 6-point star',
    defaultFillColor: '#f59e0b',
    order: 3,
  },
  {
    id: 'banner',
    label: 'Banner',
    icon: 'shapes/banner',
    category: 'stars',
    description: 'Insert a banner shape',
    defaultFillColor: '#ef4444',
    order: 4,
  },

  // ============================================
  // SYMBOLS
  // ============================================
  {
    id: 'cross',
    label: 'Cross',
    icon: 'shapes/cross',
    category: 'symbols',
    description: 'Insert a cross shape',
    defaultFillColor: '#ef4444',
    order: 1,
  },
  {
    id: 'heart',
    label: 'Heart',
    icon: 'shapes/heart',
    category: 'symbols',
    description: 'Insert a heart shape',
    defaultFillColor: '#ec4899',
    order: 2,
  },
  {
    id: 'lightning',
    label: 'Lightning',
    icon: 'shapes/lightning',
    category: 'symbols',
    description: 'Insert a lightning bolt',
    defaultFillColor: '#f59e0b',
    order: 3,
  },
  {
    id: 'cloud',
    label: 'Cloud',
    icon: 'shapes/cloud',
    category: 'symbols',
    description: 'Insert a cloud shape',
    defaultFillColor: '#60a5fa',
    order: 4,
  },
];

/**
 * Category display configuration
 */
export interface ShapeCategoryConfig {
  id: ShapeCategory;
  label: string;
  order: number;
}

export const SHAPE_CATEGORIES: ShapeCategoryConfig[] = [
  { id: 'basic', label: 'Basic Shapes', order: 1 },
  { id: 'arrows', label: 'Arrows', order: 2 },
  { id: 'flowchart', label: 'Flowchart', order: 3 },
  { id: 'callouts', label: 'Callouts', order: 4 },
  { id: 'stars', label: 'Stars & Banners', order: 5 },
  { id: 'symbols', label: 'Symbols', order: 6 },
  { id: 'custom', label: 'Custom', order: 7 },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get shape config by ID
 */
export function getShapeConfig(shapeId: string): ShapeConfig | undefined {
  return SHAPE_CONFIGS.find(s => s.id === shapeId);
}

/**
 * Get all shapes in a category, sorted by order
 */
export function getShapesByCategory(category: ShapeCategory): ShapeConfig[] {
  return SHAPE_CONFIGS
    .filter(s => s.category === category)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/**
 * Get shapes grouped by category
 */
export function getShapesGroupedByCategory(): Map<ShapeCategory, ShapeConfig[]> {
  const grouped = new Map<ShapeCategory, ShapeConfig[]>();
  
  for (const category of SHAPE_CATEGORIES) {
    const shapes = getShapesByCategory(category.id);
    if (shapes.length > 0) {
      grouped.set(category.id, shapes);
    }
  }
  
  return grouped;
}

/**
 * Get category config by ID
 */
export function getCategoryConfig(categoryId: ShapeCategory): ShapeCategoryConfig | undefined {
  return SHAPE_CATEGORIES.find(c => c.id === categoryId);
}

/**
 * Get all shape IDs (for validation)
 */
export function getAllShapeIds(): string[] {
  return SHAPE_CONFIGS.map(s => s.id);
}

/**
 * Check if a shape ID is valid
 */
export function isValidShapeId(shapeId: string): boolean {
  return SHAPE_CONFIGS.some(s => s.id === shapeId);
}
