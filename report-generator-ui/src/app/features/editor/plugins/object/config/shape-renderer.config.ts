/**
 * Shape Renderer Configuration
 * Defines SVG paths and rendering types for all shapes
 */

export type ShapeRenderType = 'css' | 'svg';

type PathBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

interface ShapeSvgConfig {
  /** The SVG path for the shape (normalized to 0-100 viewBox) */
  path: string;
  /** Whether the path should be closed */
  closed?: boolean;
  /** Fill rule for the path */
  fillRule?: 'nonzero' | 'evenodd';
}

/** CSS-renderable shapes (simple rectangles and circles) */
const CSS_SHAPES = ['rectangle', 'square', 'rounded-rectangle', 'circle', 'ellipse'];

/** SVG path definitions for all complex shapes (using 0-100 coordinate system) */
const SHAPE_SVG_PATHS: Record<string, ShapeSvgConfig> = {
  // Basic Shapes
  triangle: {
    path: 'M 50 5 L 95 95 L 5 95 Z',
    closed: true,
  },
  diamond: {
    path: 'M 50 5 L 95 50 L 50 95 L 5 50 Z',
    closed: true,
  },
  pentagon: {
    path: 'M 50 5 L 95 38 L 79 95 L 21 95 L 5 38 Z',
    closed: true,
  },
  hexagon: {
    path: 'M 25 5 L 75 5 L 100 50 L 75 95 L 25 95 L 0 50 Z',
    closed: true,
  },
  octagon: {
    path: 'M 30 5 L 70 5 L 95 30 L 95 70 L 70 95 L 30 95 L 5 70 L 5 30 Z',
    closed: true,
  },
  parallelogram: {
    path: 'M 20 5 L 95 5 L 80 95 L 5 95 Z',
    closed: true,
  },
  trapezoid: {
    path: 'M 20 5 L 80 5 L 95 95 L 5 95 Z',
    closed: true,
  },

  // Line
  line: {
    path: 'M 0 50 L 100 50',
    closed: false,
  },

  // Connectors (stroke-only)
  'elbow-connector': {
    path: 'M 10 15 L 10 75 L 90 75',
    closed: false,
  },
  'elbow-arrow': {
    // Elbow with arrow head at the end
    path: 'M 10 15 L 10 75 L 90 75 M 84 69 L 90 75 L 84 81',
    closed: false,
  },
  'line-arrow': {
    path: 'M 0 50 L 100 50 M 92 44 L 100 50 L 92 56',
    closed: false,
  },
  'line-arrow-double': {
    path: 'M 0 50 L 100 50 M 8 44 L 0 50 L 8 56 M 92 44 L 100 50 L 92 56',
    closed: false,
  },
  'curved-connector': {
    path: 'M 0 50 Q 50 10 100 50',
    closed: false,
  },
  'curved-arrow': {
    path: 'M 0 50 Q 50 10 100 50 M 92 44 L 100 50 L 92 56',
    closed: false,
  },
  's-connector': {
    path: 'M 0 20 C 30 20 70 80 100 80',
    closed: false,
  },
  's-arrow': {
    path: 'M 0 20 C 30 20 70 80 100 80 M 92 74 L 100 80 L 92 86',
    closed: false,
  },

  // Arrows
  'arrow-right': {
    path: 'M 5 40 L 60 40 L 60 20 L 95 50 L 60 80 L 60 60 L 5 60 Z',
    closed: true,
  },
  'arrow-left': {
    path: 'M 95 40 L 40 40 L 40 20 L 5 50 L 40 80 L 40 60 L 95 60 Z',
    closed: true,
  },
  'arrow-up': {
    path: 'M 40 95 L 40 40 L 20 40 L 50 5 L 80 40 L 60 40 L 60 95 Z',
    closed: true,
  },
  'arrow-down': {
    path: 'M 40 5 L 40 60 L 20 60 L 50 95 L 80 60 L 60 60 L 60 5 Z',
    closed: true,
  },
  'arrow-double': {
    path: 'M 5 50 L 25 25 L 25 40 L 75 40 L 75 25 L 95 50 L 75 75 L 75 60 L 25 60 L 25 75 Z',
    closed: true,
  },

  // Flowchart Shapes
  'flowchart-process': {
    path: 'M 5 5 L 95 5 L 95 95 L 5 95 Z',
    closed: true,
  },
  'flowchart-decision': {
    path: 'M 50 5 L 95 50 L 50 95 L 5 50 Z',
    closed: true,
  },
  'flowchart-data': {
    path: 'M 20 5 L 95 5 L 80 95 L 5 95 Z',
    closed: true,
  },
  'flowchart-terminator': {
    path: 'M 20 5 Q 5 5 5 50 Q 5 95 20 95 L 80 95 Q 95 95 95 50 Q 95 5 80 5 Z',
    closed: true,
  },

  // Callouts
  'callout-rectangle': {
    path: 'M 5 5 L 95 5 L 95 70 L 50 70 L 35 95 L 35 70 L 5 70 Z',
    closed: true,
  },
  'callout-rounded': {
    path: 'M 15 5 Q 5 5 5 15 L 5 55 Q 5 65 15 65 L 30 65 L 35 80 L 40 65 L 85 65 Q 95 65 95 55 L 95 15 Q 95 5 85 5 Z',
    closed: true,
  },
  'callout-cloud': {
    path: 'M 30 20 Q 5 15 15 40 Q 0 50 15 65 Q 10 85 35 80 L 25 95 L 40 80 Q 60 90 75 75 Q 95 80 90 60 Q 100 45 85 35 Q 95 15 70 20 Q 55 5 30 20 Z',
    closed: true,
  },

  // Stars
  'star-4': {
    path: 'M 50 5 L 60 40 L 95 50 L 60 60 L 50 95 L 40 60 L 5 50 L 40 40 Z',
    closed: true,
  },
  'star-5': {
    path: 'M 50 5 L 61 38 L 95 38 L 68 59 L 79 95 L 50 73 L 21 95 L 32 59 L 5 38 L 39 38 Z',
    closed: true,
  },
  'star-6': {
    path: 'M 50 5 L 62 30 L 93 20 L 75 45 L 93 80 L 62 70 L 50 95 L 38 70 L 7 80 L 25 45 L 7 20 L 38 30 Z',
    closed: true,
  },
  'star-8': {
    path: 'M 50 5 L 60 25 L 85 10 L 75 35 L 95 50 L 75 65 L 85 90 L 60 75 L 50 95 L 40 75 L 15 90 L 25 65 L 5 50 L 25 35 L 15 10 L 40 25 Z',
    closed: true,
  },
  
  // Wave (wavy ribbon)
  wave: {
    path: 'M 5 35 C 20 20 35 20 50 35 C 65 50 80 50 95 35 L 95 65 C 80 80 65 80 50 65 C 35 50 20 50 5 65 Z',
    closed: true,
  },

  // Symbols
  cross: {
    path: 'M 35 5 L 65 5 L 65 35 L 95 35 L 95 65 L 65 65 L 65 95 L 35 95 L 35 65 L 5 65 L 5 35 L 35 35 Z',
    closed: true,
  },
  heart: {
    path: 'M 50 90 Q 5 55 5 35 Q 5 10 27 10 Q 45 10 50 30 Q 55 10 73 10 Q 95 10 95 35 Q 95 55 50 90 Z',
    closed: true,
  },
  lightning: {
    path: 'M 60 5 L 20 50 L 40 50 L 35 95 L 80 45 L 55 45 Z',
    closed: true,
  },
  moon: {
    path: 'M 70 10 Q 30 10 30 50 Q 30 90 70 90 Q 45 80 45 50 Q 45 20 70 10 Z',
    closed: true,
  },
  cloud: {
    path: 'M 25 70 Q 5 70 5 55 Q 5 40 20 40 Q 20 25 35 25 Q 45 10 60 20 Q 75 10 85 25 Q 95 30 95 45 Q 100 60 85 70 Z',
    closed: true,
  },
};

/**
 * Determine if a shape should be rendered with CSS or SVG
 */
export function getShapeRenderType(shapeType: string): ShapeRenderType {
  return CSS_SHAPES.includes(shapeType) ? 'css' : 'svg';
}

/**
 * Check if a shape is a complex (SVG) shape
 */
export function isComplexShape(shapeType: string): boolean {
  return !CSS_SHAPES.includes(shapeType);
}

/**
 * Get the SVG path for a shape
 */
export function getShapeSvgPath(shapeType: string): string {
  return SHAPE_SVG_PATHS[shapeType]?.path || SHAPE_SVG_PATHS['rectangle']?.path || '';
}

function computePathBounds(path: string): PathBounds | null {
  if (!path) return null;

  const matches = path.match(/-?\d*\.?\d+(?:[eE][-+]?\d+)?/g);
  if (!matches || matches.length < 4) return null;

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (let i = 0; i + 1 < matches.length; i += 2) {
    const x = Number(matches[i]);
    const y = Number(matches[i + 1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null;
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Get a tight SVG viewBox for the shape based on its path bounds.
 * This reduces built-in padding so shapes (like arrows) fill the widget.
 */
export function getShapeSvgViewBox(shapeType: string): string {
  // Stroke-only shapes like 'line' have a near-zero height bounding box.
  // Keep a stable default viewBox for those.
  if (isStrokeOnlyShape(shapeType)) {
    return '0 0 100 100';
  }

  const path = getShapeSvgPath(shapeType);
  const bounds = computePathBounds(path);
  if (!bounds) return '0 0 100 100';

  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  if (width <= 0 || height <= 0) return '0 0 100 100';

  // Tight viewBox: shape should touch the widget edges.
  const pad = 0;

  const minX = bounds.minX - pad;
  const minY = bounds.minY - pad;
  const maxX = bounds.maxX + pad;
  const maxY = bounds.maxY + pad;

  const vbW = maxX - minX;
  const vbH = maxY - minY;
  if (!(vbW > 0) || !(vbH > 0)) return '0 0 100 100';

  return `${minX} ${minY} ${vbW} ${vbH}`;
}

/**
 * Get the full SVG config for a shape
 */
export function getShapeSvgConfig(shapeType: string): ShapeSvgConfig | undefined {
  return SHAPE_SVG_PATHS[shapeType];
}

/**
 * Check if a shape path should be closed
 */
export function isShapePathClosed(shapeType: string): boolean {
  return SHAPE_SVG_PATHS[shapeType]?.closed !== false;
}

/**
 * Check if a shape is stroke-only (like a line)
 */
export function isStrokeOnlyShape(shapeType: string): boolean {
  return (
    shapeType === 'line' ||
    shapeType === 'elbow-connector' ||
    shapeType === 'elbow-arrow' ||
    shapeType === 'line-arrow' ||
    shapeType === 'line-arrow-double' ||
    shapeType === 'curved-connector' ||
    shapeType === 'curved-arrow' ||
    shapeType === 's-connector' ||
    shapeType === 's-arrow'
  );
}

/**
 * Get all available SVG shape types
 */
export function getSvgShapeTypes(): string[] {
  return Object.keys(SHAPE_SVG_PATHS);
}

/**
 * Generate complete SVG markup for a shape
 */
export function generateShapeSvg(
  shapeType: string,
  options: {
    width?: number;
    height?: number;
    fillColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
    strokeStyle?: 'solid' | 'dashed' | 'dotted';
    opacity?: number;
  } = {}
): string {
  const {
    width = 100,
    height = 100,
    fillColor = '#3b82f6',
    strokeColor = '#000000',
    strokeWidth = 0,
    strokeStyle = 'solid',
    opacity = 1,
  } = options;

  const config = SHAPE_SVG_PATHS[shapeType];
  if (!config) {
    return '';
  }

  const viewBox = getShapeSvgViewBox(shapeType);

  let strokeDasharray = '';
  if (strokeStyle === 'dashed') strokeDasharray = 'stroke-dasharray="8,4"';
  else if (strokeStyle === 'dotted') strokeDasharray = 'stroke-dasharray="2,2"';

  const strokeAttr = strokeWidth > 0 
    ? `stroke="${strokeColor}" stroke-width="${strokeWidth}" ${strokeDasharray}`
    : 'stroke="none"';

  return `
    <svg xmlns="http://www.w3.org/2000/svg" 
         viewBox="${viewBox}" 
         width="${width}" 
         height="${height}" 
         preserveAspectRatio="none"
         style="display: block;">
      <path d="${config.path}" 
            fill="${fillColor}" 
            fill-opacity="${opacity}"
            ${strokeAttr}
            ${config.fillRule ? `fill-rule="${config.fillRule}"` : ''} />
    </svg>
  `.trim();
}
