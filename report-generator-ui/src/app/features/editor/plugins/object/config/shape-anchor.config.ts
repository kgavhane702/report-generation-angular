/**
 * Shape Anchor Configuration
 * 
 * Defines connector anchor points for each shape type based on actual shape geometry.
 * Anchor points are specified as percentages (0-100) relative to the widget's bounding box.
 * 
 * IMPORTANT: SVG shapes use tight viewBox (e.g., triangle path "M 50 5 L 95 95 L 5 95 Z" 
 * has viewBox "5 5 90 90"). With preserveAspectRatio="none", the shape fills the widget.
 * 
 * To convert SVG coordinates to widget percentages:
 *   widgetPercent = (svgCoord - viewBox.min) / viewBox.size * 100
 * 
 * For triangle: viewBox is 5,5 to 95,95 (size 90x90)
 *   - SVG point (50, 5) → widget ((50-5)/90*100, (5-5)/90*100) = (50%, 0%)
 *   - SVG point (95, 95) → widget ((95-5)/90*100, (95-5)/90*100) = (100%, 100%)
 *   - SVG point (5, 95) → widget ((5-5)/90*100, (95-5)/90*100) = (0%, 100%)
 */

export interface ShapeAnchorPoint {
  /** Unique position identifier */
  position: string;
  /** X position as percentage of widget width (0-100) */
  xPercent: number;
  /** Y position as percentage of widget height (0-100) */
  yPercent: number;
  /** Optional label for debugging/display */
  label?: string;
}

/**
 * Default 8-point anchors for rectangular shapes (rectangle, square, rounded-rectangle)
 * These are positioned at the corners and edge midpoints of the bounding box.
 */
const RECTANGULAR_ANCHORS: ShapeAnchorPoint[] = [
  { position: 'top', xPercent: 50, yPercent: 0 },
  { position: 'top-right', xPercent: 100, yPercent: 0 },
  { position: 'right', xPercent: 100, yPercent: 50 },
  { position: 'bottom-right', xPercent: 100, yPercent: 100 },
  { position: 'bottom', xPercent: 50, yPercent: 100 },
  { position: 'bottom-left', xPercent: 0, yPercent: 100 },
  { position: 'left', xPercent: 0, yPercent: 50 },
  { position: 'top-left', xPercent: 0, yPercent: 0 },
];

/**
 * Circle/Ellipse anchors - 8 points around the perimeter
 */
const CIRCLE_ANCHORS: ShapeAnchorPoint[] = [
  { position: 'top', xPercent: 50, yPercent: 0 },
  { position: 'top-right', xPercent: 85.36, yPercent: 14.64 }, // 45° on circle
  { position: 'right', xPercent: 100, yPercent: 50 },
  { position: 'bottom-right', xPercent: 85.36, yPercent: 85.36 },
  { position: 'bottom', xPercent: 50, yPercent: 100 },
  { position: 'bottom-left', xPercent: 14.64, yPercent: 85.36 },
  { position: 'left', xPercent: 0, yPercent: 50 },
  { position: 'top-left', xPercent: 14.64, yPercent: 14.64 },
];

/**
 * Triangle anchors - 3 vertices + 3 edge midpoints
 * SVG path: M 50 5 L 95 95 L 5 95 Z
 * ViewBox: 5 5 90 90 (minX=5, minY=5, width=90, height=90)
 * 
 * Widget coords = (svgCoord - 5) / 90 * 100
 *   - (50,5) → (50%, 0%)      top vertex
 *   - (95,95) → (100%, 100%)  bottom-right vertex
 *   - (5,95) → (0%, 100%)     bottom-left vertex
 */
const TRIANGLE_ANCHORS: ShapeAnchorPoint[] = [
  // Vertices
  { position: 'top', xPercent: 50, yPercent: 0, label: 'top vertex' },
  { position: 'bottom-right', xPercent: 100, yPercent: 100, label: 'bottom-right vertex' },
  { position: 'bottom-left', xPercent: 0, yPercent: 100, label: 'bottom-left vertex' },
  // Edge midpoints
  { position: 'right', xPercent: 75, yPercent: 50, label: 'right edge mid' },
  { position: 'bottom', xPercent: 50, yPercent: 100, label: 'bottom edge mid' },
  { position: 'left', xPercent: 25, yPercent: 50, label: 'left edge mid' },
];

/**
 * Diamond anchors - 4 vertices + 4 edge midpoints
 * SVG path: M 50 5 L 95 50 L 50 95 L 5 50 Z
 * ViewBox: 5 5 90 90
 * Widget coords = (svgCoord - 5) / 90 * 100
 */
const DIAMOND_ANCHORS: ShapeAnchorPoint[] = [
  // Vertices
  { position: 'top', xPercent: 50, yPercent: 0, label: 'top vertex' },
  { position: 'right', xPercent: 100, yPercent: 50, label: 'right vertex' },
  { position: 'bottom', xPercent: 50, yPercent: 100, label: 'bottom vertex' },
  { position: 'left', xPercent: 0, yPercent: 50, label: 'left vertex' },
  // Edge midpoints
  { position: 'top-right', xPercent: 75, yPercent: 25, label: 'top-right edge mid' },
  { position: 'bottom-right', xPercent: 75, yPercent: 75, label: 'bottom-right edge mid' },
  { position: 'bottom-left', xPercent: 25, yPercent: 75, label: 'bottom-left edge mid' },
  { position: 'top-left', xPercent: 25, yPercent: 25, label: 'top-left edge mid' },
];

/**
 * Pentagon anchors - 5 vertices + edge midpoints
 * SVG path: M 50 5 L 95 38 L 79 95 L 21 95 L 5 38 Z
 * ViewBox: 5 5 90 90
 * Widget coords = (svgCoord - 5) / 90 * 100
 */
const PENTAGON_ANCHORS: ShapeAnchorPoint[] = [
  // Vertices (converted to widget %)
  { position: 'top', xPercent: 50, yPercent: 0, label: 'top vertex' },           // (50,5) → (50%, 0%)
  { position: 'top-right', xPercent: 100, yPercent: 36.67, label: 'top-right vertex' }, // (95,38) → (100%, 36.67%)
  { position: 'bottom-right', xPercent: 82.22, yPercent: 100, label: 'bottom-right vertex' }, // (79,95) → (82.22%, 100%)
  { position: 'bottom-left', xPercent: 17.78, yPercent: 100, label: 'bottom-left vertex' },   // (21,95) → (17.78%, 100%)
  { position: 'top-left', xPercent: 0, yPercent: 36.67, label: 'top-left vertex' },    // (5,38) → (0%, 36.67%)
  // Edge midpoints
  { position: 'right', xPercent: 91.11, yPercent: 68.33, label: 'right edge mid' },    // midpoint of top-right to bottom-right
  { position: 'bottom', xPercent: 50, yPercent: 100, label: 'bottom edge mid' },
  { position: 'left', xPercent: 8.89, yPercent: 68.33, label: 'left edge mid' },       // midpoint of top-left to bottom-left
];

/**
 * Hexagon anchors - 6 vertices + 2 edge midpoints
 * SVG path: M 25 5 L 75 5 L 100 50 L 75 95 L 25 95 L 0 50 Z
 * ViewBox: 0 5 100 90 (minX=0, minY=5, width=100, height=90)
 * Widget coords: x = (svgX - 0) / 100 * 100 = svgX, y = (svgY - 5) / 90 * 100
 */
const HEXAGON_ANCHORS: ShapeAnchorPoint[] = [
  // Vertices
  { position: 'top-left', xPercent: 25, yPercent: 0, label: 'top-left vertex' },    // (25,5) → (25%, 0%)
  { position: 'top-right', xPercent: 75, yPercent: 0, label: 'top-right vertex' },  // (75,5) → (75%, 0%)
  { position: 'right', xPercent: 100, yPercent: 50, label: 'right vertex' },        // (100,50) → (100%, 50%)
  { position: 'bottom-right', xPercent: 75, yPercent: 100, label: 'bottom-right vertex' }, // (75,95) → (75%, 100%)
  { position: 'bottom-left', xPercent: 25, yPercent: 100, label: 'bottom-left vertex' },   // (25,95) → (25%, 100%)
  { position: 'left', xPercent: 0, yPercent: 50, label: 'left vertex' },            // (0,50) → (0%, 50%)
  // Edge midpoints
  { position: 'top', xPercent: 50, yPercent: 0, label: 'top edge mid' },
  { position: 'bottom', xPercent: 50, yPercent: 100, label: 'bottom edge mid' },
];

/**
 * Octagon anchors - 8 vertices
 * SVG path: M 30 5 L 70 5 L 95 30 L 95 70 L 70 95 L 30 95 L 5 70 L 5 30 Z
 * ViewBox: 5 5 90 90
 * Widget coords = (svgCoord - 5) / 90 * 100
 */
const OCTAGON_ANCHORS: ShapeAnchorPoint[] = [
  { position: 'top-left', xPercent: 27.78, yPercent: 0, label: 'top-left vertex' },     // (30,5) → (27.78%, 0%)
  { position: 'top', xPercent: 50, yPercent: 0, label: 'top edge mid' },
  { position: 'top-right', xPercent: 72.22, yPercent: 0, label: 'top-right vertex' },   // (70,5) → (72.22%, 0%)
  { position: 'right', xPercent: 100, yPercent: 50, label: 'right edge mid' },          // (95,50) → (100%, 50%)
  { position: 'bottom-right', xPercent: 72.22, yPercent: 100, label: 'bottom-right vertex' }, // (70,95)
  { position: 'bottom', xPercent: 50, yPercent: 100, label: 'bottom edge mid' },
  { position: 'bottom-left', xPercent: 27.78, yPercent: 100, label: 'bottom-left vertex' },   // (30,95)
  { position: 'left', xPercent: 0, yPercent: 50, label: 'left edge mid' },              // (5,50) → (0%, 50%)
];

/**
 * Parallelogram anchors - 4 vertices + 4 edge midpoints
 * SVG path: M 20 5 L 95 5 L 80 95 L 5 95 Z
 * ViewBox: 5 5 90 90
 */
const PARALLELOGRAM_ANCHORS: ShapeAnchorPoint[] = [
  // Vertices
  { position: 'top-left', xPercent: 16.67, yPercent: 0, label: 'top-left vertex' },     // (20,5) → (16.67%, 0%)
  { position: 'top-right', xPercent: 100, yPercent: 0, label: 'top-right vertex' },     // (95,5) → (100%, 0%)
  { position: 'bottom-right', xPercent: 83.33, yPercent: 100, label: 'bottom-right vertex' }, // (80,95) → (83.33%, 100%)
  { position: 'bottom-left', xPercent: 0, yPercent: 100, label: 'bottom-left vertex' }, // (5,95) → (0%, 100%)
  // Edge midpoints
  { position: 'top', xPercent: 58.33, yPercent: 0, label: 'top edge mid' },
  { position: 'right', xPercent: 91.67, yPercent: 50, label: 'right edge mid' },
  { position: 'bottom', xPercent: 41.67, yPercent: 100, label: 'bottom edge mid' },
  { position: 'left', xPercent: 8.33, yPercent: 50, label: 'left edge mid' },
];

/**
 * Trapezoid anchors - 4 vertices + 4 edge midpoints
 * SVG path: M 20 5 L 80 5 L 95 95 L 5 95 Z
 * ViewBox: 5 5 90 90
 */
const TRAPEZOID_ANCHORS: ShapeAnchorPoint[] = [
  // Vertices
  { position: 'top-left', xPercent: 16.67, yPercent: 0, label: 'top-left vertex' },     // (20,5) → (16.67%, 0%)
  { position: 'top-right', xPercent: 83.33, yPercent: 0, label: 'top-right vertex' },   // (80,5) → (83.33%, 0%)
  { position: 'bottom-right', xPercent: 100, yPercent: 100, label: 'bottom-right vertex' }, // (95,95) → (100%, 100%)
  { position: 'bottom-left', xPercent: 0, yPercent: 100, label: 'bottom-left vertex' }, // (5,95) → (0%, 100%)
  // Edge midpoints
  { position: 'top', xPercent: 50, yPercent: 0, label: 'top edge mid' },
  { position: 'right', xPercent: 91.67, yPercent: 50, label: 'right edge mid' },
  { position: 'bottom', xPercent: 50, yPercent: 100, label: 'bottom edge mid' },
  { position: 'left', xPercent: 8.33, yPercent: 50, label: 'left edge mid' },
];

/**
 * Arrow Right anchors
 * SVG path: M 5 40 L 60 40 L 60 20 L 95 50 L 60 80 L 60 60 L 5 60 Z
 * ViewBox: 5 20 90 60
 */
const ARROW_RIGHT_ANCHORS: ShapeAnchorPoint[] = [
  { position: 'left', xPercent: 0, yPercent: 50, label: 'left mid' },           // (5,50) → (0%, 50%)
  { position: 'top-left', xPercent: 0, yPercent: 33.33, label: 'top-left' },    // (5,40) → (0%, 33.33%)
  { position: 'top', xPercent: 61.11, yPercent: 0, label: 'top notch' },        // (60,20) → (61.11%, 0%)
  { position: 'right', xPercent: 100, yPercent: 50, label: 'arrow tip' },       // (95,50) → (100%, 50%)
  { position: 'bottom', xPercent: 61.11, yPercent: 100, label: 'bottom notch' }, // (60,80) → (61.11%, 100%)
  { position: 'bottom-left', xPercent: 0, yPercent: 66.67, label: 'bottom-left' }, // (5,60) → (0%, 66.67%)
];

/**
 * Arrow Left anchors
 * SVG path: M 95 40 L 40 40 L 40 20 L 5 50 L 40 80 L 40 60 L 95 60 Z
 * ViewBox: 5 20 90 60
 */
const ARROW_LEFT_ANCHORS: ShapeAnchorPoint[] = [
  { position: 'right', xPercent: 100, yPercent: 50, label: 'right mid' },       // (95,50) → (100%, 50%)
  { position: 'top-right', xPercent: 100, yPercent: 33.33, label: 'top-right' }, // (95,40) → (100%, 33.33%)
  { position: 'top', xPercent: 38.89, yPercent: 0, label: 'top notch' },        // (40,20) → (38.89%, 0%)
  { position: 'left', xPercent: 0, yPercent: 50, label: 'arrow tip' },          // (5,50) → (0%, 50%)
  { position: 'bottom', xPercent: 38.89, yPercent: 100, label: 'bottom notch' }, // (40,80) → (38.89%, 100%)
  { position: 'bottom-right', xPercent: 100, yPercent: 66.67, label: 'bottom-right' }, // (95,60)
];

/**
 * Arrow Up anchors
 * SVG path: M 40 95 L 40 40 L 20 40 L 50 5 L 80 40 L 60 40 L 60 95 Z
 * ViewBox: 20 5 60 90
 */
const ARROW_UP_ANCHORS: ShapeAnchorPoint[] = [
  { position: 'bottom', xPercent: 50, yPercent: 100, label: 'bottom mid' },     // (50,95)
  { position: 'bottom-left', xPercent: 33.33, yPercent: 100, label: 'bottom-left' },  // (40,95) → (33.33%, 100%)
  { position: 'left', xPercent: 0, yPercent: 38.89, label: 'left notch' },           // (20,40) → (0%, 38.89%)
  { position: 'top', xPercent: 50, yPercent: 0, label: 'arrow tip' },                // (50,5) → (50%, 0%)
  { position: 'right', xPercent: 100, yPercent: 38.89, label: 'right notch' },       // (80,40) → (100%, 38.89%)
  { position: 'bottom-right', xPercent: 66.67, yPercent: 100, label: 'bottom-right' }, // (60,95) → (66.67%, 100%)
];

/**
 * Arrow Down anchors
 * SVG path: M 40 5 L 40 60 L 20 60 L 50 95 L 80 60 L 60 60 L 60 5 Z
 * ViewBox: 20 5 60 90
 */
const ARROW_DOWN_ANCHORS: ShapeAnchorPoint[] = [
  { position: 'top', xPercent: 50, yPercent: 0, label: 'top mid' },                  // (50,5) → (50%, 0%)
  { position: 'top-left', xPercent: 33.33, yPercent: 0, label: 'top-left' },         // (40,5) → (33.33%, 0%)
  { position: 'left', xPercent: 0, yPercent: 61.11, label: 'left notch' },           // (20,60) → (0%, 61.11%)
  { position: 'bottom', xPercent: 50, yPercent: 100, label: 'arrow tip' },           // (50,95) → (50%, 100%)
  { position: 'right', xPercent: 100, yPercent: 61.11, label: 'right notch' },       // (80,60) → (100%, 61.11%)
  { position: 'top-right', xPercent: 66.67, yPercent: 0, label: 'top-right' },       // (60,5) → (66.67%, 0%)
];

/**
 * Arrow Double anchors
 * SVG path: M 5 50 L 25 25 L 25 40 L 75 40 L 75 25 L 95 50 L 75 75 L 75 60 L 25 60 L 25 75 Z
 * ViewBox: 5 25 90 50
 */
const ARROW_DOUBLE_ANCHORS: ShapeAnchorPoint[] = [
  { position: 'left', xPercent: 0, yPercent: 50, label: 'left tip' },                // (5,50) → (0%, 50%)
  { position: 'right', xPercent: 100, yPercent: 50, label: 'right tip' },            // (95,50) → (100%, 50%)
  { position: 'top-left', xPercent: 22.22, yPercent: 0, label: 'top-left notch' },   // (25,25) → (22.22%, 0%)
  { position: 'top-right', xPercent: 77.78, yPercent: 0, label: 'top-right notch' }, // (75,25) → (77.78%, 0%)
  { position: 'bottom-left', xPercent: 22.22, yPercent: 100, label: 'bottom-left notch' }, // (25,75)
  { position: 'bottom-right', xPercent: 77.78, yPercent: 100, label: 'bottom-right notch' }, // (75,75)
  { position: 'top', xPercent: 50, yPercent: 30, label: 'top mid' },                 // (50,40) → (50%, 30%)
  { position: 'bottom', xPercent: 50, yPercent: 70, label: 'bottom mid' },           // (50,60) → (50%, 70%)
];

/**
 * Flowchart Process (rectangle) anchors
 * SVG path: M 5 5 L 95 5 L 95 95 L 5 95 Z
 * ViewBox: 5 5 90 90
 */
const FLOWCHART_PROCESS_ANCHORS: ShapeAnchorPoint[] = [
  { position: 'top', xPercent: 50, yPercent: 0 },
  { position: 'top-right', xPercent: 100, yPercent: 0 },
  { position: 'right', xPercent: 100, yPercent: 50 },
  { position: 'bottom-right', xPercent: 100, yPercent: 100 },
  { position: 'bottom', xPercent: 50, yPercent: 100 },
  { position: 'bottom-left', xPercent: 0, yPercent: 100 },
  { position: 'left', xPercent: 0, yPercent: 50 },
  { position: 'top-left', xPercent: 0, yPercent: 0 },
];

/**
 * Flowchart Decision (diamond) anchors
 * Uses same as DIAMOND_ANCHORS
 */
const FLOWCHART_DECISION_ANCHORS = DIAMOND_ANCHORS;

/**
 * Flowchart Data (parallelogram) anchors
 * Based on path: M 20 5 L 95 5 L 80 95 L 5 95 Z
 */
const FLOWCHART_DATA_ANCHORS = PARALLELOGRAM_ANCHORS;

/**
 * Flowchart Terminator anchors
 * SVG path: M 20 5 Q 5 5 5 50 Q 5 95 20 95 L 80 95 Q 95 95 95 50 Q 95 5 80 5 Z
 * ViewBox: 5 5 90 90
 */
const FLOWCHART_TERMINATOR_ANCHORS: ShapeAnchorPoint[] = [
  { position: 'top', xPercent: 50, yPercent: 0 },
  { position: 'right', xPercent: 100, yPercent: 50 },
  { position: 'bottom', xPercent: 50, yPercent: 100 },
  { position: 'left', xPercent: 0, yPercent: 50 },
  { position: 'top-right', xPercent: 83.33, yPercent: 0 },   // (80,5) → (83.33%, 0%)
  { position: 'top-left', xPercent: 16.67, yPercent: 0 },    // (20,5) → (16.67%, 0%)
  { position: 'bottom-right', xPercent: 83.33, yPercent: 100 },
  { position: 'bottom-left', xPercent: 16.67, yPercent: 100 },
];

/**
 * Callout Rectangle anchors
 * SVG path: M 5 5 L 95 5 L 95 70 L 50 70 L 35 95 L 35 70 L 5 70 Z
 * ViewBox: 5 5 90 90
 */
const CALLOUT_RECTANGLE_ANCHORS: ShapeAnchorPoint[] = [
  { position: 'top', xPercent: 50, yPercent: 0 },
  { position: 'top-right', xPercent: 100, yPercent: 0 },
  { position: 'right', xPercent: 100, yPercent: 36.11 },      // midpoint of right edge (5 to 70)
  { position: 'bottom-right', xPercent: 100, yPercent: 72.22 }, // (95,70) → (100%, 72.22%)
  { position: 'bottom', xPercent: 33.33, yPercent: 100, label: 'callout tip' }, // (35,95)
  { position: 'bottom-left', xPercent: 0, yPercent: 72.22 },  // (5,70)
  { position: 'left', xPercent: 0, yPercent: 36.11 },
  { position: 'top-left', xPercent: 0, yPercent: 0 },
];

/**
 * Callout Rounded anchors
 * SVG path: M 15 5 Q 5 5 5 15 L 5 55 Q 5 65 15 65 L 30 65 L 35 80 L 40 65 L 85 65 Q 95 65 95 55 L 95 15 Q 95 5 85 5 Z
 * ViewBox: 5 5 90 75
 */
const CALLOUT_ROUNDED_ANCHORS: ShapeAnchorPoint[] = [
  { position: 'top', xPercent: 50, yPercent: 0 },
  { position: 'top-right', xPercent: 88.89, yPercent: 0 },    // (85,5) → (88.89%, 0%)
  { position: 'right', xPercent: 100, yPercent: 40 },
  { position: 'bottom-right', xPercent: 88.89, yPercent: 80 }, // (85,65) → (88.89%, 80%)
  { position: 'bottom', xPercent: 33.33, yPercent: 100, label: 'callout tip' }, // (35,80) → (33.33%, 100%)
  { position: 'bottom-left', xPercent: 11.11, yPercent: 80 }, // (15,65)
  { position: 'left', xPercent: 0, yPercent: 40 },
  { position: 'top-left', xPercent: 11.11, yPercent: 0 },     // (15,5)
];

/**
 * Callout Cloud anchors
 * Complex organic shape - approximate positions
 */
const CALLOUT_CLOUD_ANCHORS: ShapeAnchorPoint[] = [
  { position: 'top', xPercent: 50, yPercent: 5 },
  { position: 'top-right', xPercent: 90, yPercent: 15 },
  { position: 'right', xPercent: 100, yPercent: 50 },
  { position: 'bottom-right', xPercent: 80, yPercent: 80 },
  { position: 'bottom', xPercent: 25, yPercent: 100, label: 'callout tip' },
  { position: 'bottom-left', xPercent: 10, yPercent: 80 },
  { position: 'left', xPercent: 0, yPercent: 50 },
  { position: 'top-left', xPercent: 15, yPercent: 15 },
];

/**
 * Star 4-point anchors
 * SVG path: M 50 5 L 60 40 L 95 50 L 60 60 L 50 95 L 40 60 L 5 50 L 40 40 Z
 * ViewBox: 5 5 90 90
 */
const STAR_4_ANCHORS: ShapeAnchorPoint[] = [
  { position: 'top', xPercent: 50, yPercent: 0, label: 'top point' },       // (50,5)
  { position: 'right', xPercent: 100, yPercent: 50, label: 'right point' }, // (95,50)
  { position: 'bottom', xPercent: 50, yPercent: 100, label: 'bottom point' }, // (50,95)
  { position: 'left', xPercent: 0, yPercent: 50, label: 'left point' },     // (5,50)
  { position: 'top-right', xPercent: 61.11, yPercent: 38.89, label: 'top-right valley' }, // (60,40)
  { position: 'bottom-right', xPercent: 61.11, yPercent: 61.11, label: 'bottom-right valley' }, // (60,60)
  { position: 'bottom-left', xPercent: 38.89, yPercent: 61.11, label: 'bottom-left valley' }, // (40,60)
  { position: 'top-left', xPercent: 38.89, yPercent: 38.89, label: 'top-left valley' }, // (40,40)
];

/**
 * Star 5-point anchors
 * SVG path: M 50 5 L 61 38 L 95 38 L 68 59 L 79 95 L 50 73 L 21 95 L 32 59 L 5 38 L 39 38 Z
 * ViewBox: 5 5 90 90
 */
const STAR_5_ANCHORS: ShapeAnchorPoint[] = [
  { position: 'top', xPercent: 50, yPercent: 0, label: 'top point' },             // (50,5)
  { position: 'top-right', xPercent: 100, yPercent: 36.67, label: 'top-right point' }, // (95,38)
  { position: 'bottom-right', xPercent: 82.22, yPercent: 100, label: 'bottom-right point' }, // (79,95)
  { position: 'bottom-left', xPercent: 17.78, yPercent: 100, label: 'bottom-left point' }, // (21,95)
  { position: 'top-left', xPercent: 0, yPercent: 36.67, label: 'top-left point' }, // (5,38)
  { position: 'right', xPercent: 70, yPercent: 60, label: 'right valley' },        // (68,59)
  { position: 'bottom', xPercent: 50, yPercent: 75.56, label: 'bottom valley' },  // (50,73)
  { position: 'left', xPercent: 30, yPercent: 60, label: 'left valley' },          // (32,59)
];

/**
 * Star 6-point anchors
 * ViewBox approximation for star shape
 */
const STAR_6_ANCHORS: ShapeAnchorPoint[] = [
  { position: 'top', xPercent: 50, yPercent: 0, label: 'top point' },
  { position: 'top-right', xPercent: 100, yPercent: 17, label: 'top-right point' },
  { position: 'right', xPercent: 78, yPercent: 44, label: 'right valley' },
  { position: 'bottom-right', xPercent: 100, yPercent: 86, label: 'bottom-right point' },
  { position: 'bottom', xPercent: 50, yPercent: 100, label: 'bottom point' },
  { position: 'bottom-left', xPercent: 0, yPercent: 86, label: 'bottom-left point' },
  { position: 'left', xPercent: 22, yPercent: 44, label: 'left valley' },
  { position: 'top-left', xPercent: 0, yPercent: 17, label: 'top-left point' },
];

/**
 * Star 8-point anchors
 * ViewBox: 5 5 90 90
 */
const STAR_8_ANCHORS: ShapeAnchorPoint[] = [
  { position: 'top', xPercent: 50, yPercent: 0, label: 'top point' },
  { position: 'top-right', xPercent: 88.89, yPercent: 5.56, label: 'top-right point' },
  { position: 'right', xPercent: 100, yPercent: 50, label: 'right point' },
  { position: 'bottom-right', xPercent: 88.89, yPercent: 94.44, label: 'bottom-right point' },
  { position: 'bottom', xPercent: 50, yPercent: 100, label: 'bottom point' },
  { position: 'bottom-left', xPercent: 11.11, yPercent: 94.44, label: 'bottom-left point' },
  { position: 'left', xPercent: 0, yPercent: 50, label: 'left point' },
  { position: 'top-left', xPercent: 11.11, yPercent: 5.56, label: 'top-left point' },
];

/**
 * Wave anchors
 * SVG path: M 5 20 L 95 20 L 85 50 L 95 80 L 5 80 L 15 50 Z
 * ViewBox: 5 20 90 60
 */
const BANNER_ANCHORS: ShapeAnchorPoint[] = [
  { position: 'top-left', xPercent: 0, yPercent: 0, label: 'top-left' },          // (5,20)
  { position: 'top', xPercent: 50, yPercent: 0, label: 'top mid' },
  { position: 'top-right', xPercent: 100, yPercent: 0, label: 'top-right' },      // (95,20)
  { position: 'right', xPercent: 88.89, yPercent: 50, label: 'right indent' },    // (85,50)
  { position: 'bottom-right', xPercent: 100, yPercent: 100, label: 'bottom-right' }, // (95,80)
  { position: 'bottom', xPercent: 50, yPercent: 100, label: 'bottom mid' },
  { position: 'bottom-left', xPercent: 0, yPercent: 100, label: 'bottom-left' },  // (5,80)
  { position: 'left', xPercent: 11.11, yPercent: 50, label: 'left indent' },      // (15,50)
];

/**
 * Cross anchors
 * SVG path: M 35 5 L 65 5 L 65 35 L 95 35 L 95 65 L 65 65 L 65 95 L 35 95 L 35 65 L 5 65 L 5 35 L 35 35 Z
 * ViewBox: 5 5 90 90
 */
const CROSS_ANCHORS: ShapeAnchorPoint[] = [
  { position: 'top', xPercent: 50, yPercent: 0, label: 'top' },
  { position: 'top-right', xPercent: 66.67, yPercent: 0, label: 'top arm right' }, // (65,5)
  { position: 'right', xPercent: 100, yPercent: 50, label: 'right' },              // (95,50)
  { position: 'bottom-right', xPercent: 66.67, yPercent: 100, label: 'bottom arm right' }, // (65,95)
  { position: 'bottom', xPercent: 50, yPercent: 100, label: 'bottom' },
  { position: 'bottom-left', xPercent: 33.33, yPercent: 100, label: 'bottom arm left' }, // (35,95)
  { position: 'left', xPercent: 0, yPercent: 50, label: 'left' },                  // (5,50)
  { position: 'top-left', xPercent: 33.33, yPercent: 0, label: 'top arm left' },   // (35,5)
];

/**
 * Heart anchors
 * SVG path: M 50 90 Q 5 55 5 35 Q 5 10 27 10 Q 45 10 50 30 Q 55 10 73 10 Q 95 10 95 35 Q 95 55 50 90 Z
 * ViewBox: 5 10 90 80
 */
const HEART_ANCHORS: ShapeAnchorPoint[] = [
  { position: 'top-left', xPercent: 24.44, yPercent: 0, label: 'left lobe top' },  // (27,10)
  { position: 'top', xPercent: 50, yPercent: 25, label: 'center dip' },            // (50,30)
  { position: 'top-right', xPercent: 75.56, yPercent: 0, label: 'right lobe top' }, // (73,10)
  { position: 'left', xPercent: 0, yPercent: 31.25, label: 'left side' },          // (5,35)
  { position: 'right', xPercent: 100, yPercent: 31.25, label: 'right side' },      // (95,35)
  { position: 'bottom-left', xPercent: 16.67, yPercent: 62.5, label: 'left curve' },
  { position: 'bottom-right', xPercent: 83.33, yPercent: 62.5, label: 'right curve' },
  { position: 'bottom', xPercent: 50, yPercent: 100, label: 'bottom tip' },        // (50,90)
];

/**
 * Lightning anchors
 * SVG path: M 60 5 L 20 50 L 40 50 L 35 95 L 80 45 L 55 45 Z
 * ViewBox: 20 5 60 90
 */
const LIGHTNING_ANCHORS: ShapeAnchorPoint[] = [
  { position: 'top', xPercent: 66.67, yPercent: 0, label: 'top' },                 // (60,5)
  { position: 'top-left', xPercent: 33.33, yPercent: 25, label: 'upper-left edge' },
  { position: 'left', xPercent: 0, yPercent: 50, label: 'left point' },            // (20,50)
  { position: 'bottom-left', xPercent: 33.33, yPercent: 75, label: 'lower-left' },
  { position: 'bottom', xPercent: 25, yPercent: 100, label: 'bottom tip' },        // (35,95)
  { position: 'right', xPercent: 100, yPercent: 44.44, label: 'right point' },     // (80,45)
  { position: 'top-right', xPercent: 83.33, yPercent: 22.22, label: 'upper-right edge' },
];

/**
 * Moon anchors
 * SVG path: M 70 10 Q 30 10 30 50 Q 30 90 70 90 Q 45 80 45 50 Q 45 20 70 10 Z
 * ViewBox: 30 10 40 80
 */
const MOON_ANCHORS: ShapeAnchorPoint[] = [
  { position: 'top', xPercent: 50, yPercent: 0, label: 'top' },
  { position: 'top-right', xPercent: 100, yPercent: 0, label: 'outer top' },       // (70,10)
  { position: 'right', xPercent: 62.5, yPercent: 50, label: 'inner curve' },       // (45,50) approximate
  { position: 'bottom-right', xPercent: 100, yPercent: 100, label: 'outer bottom' }, // (70,90)
  { position: 'bottom', xPercent: 50, yPercent: 100, label: 'bottom' },
  { position: 'left', xPercent: 0, yPercent: 50, label: 'outer curve' },           // (30,50)
  { position: 'top-left', xPercent: 0, yPercent: 18.75, label: 'upper left' },
  { position: 'bottom-left', xPercent: 0, yPercent: 81.25, label: 'lower left' },
];

/**
 * Cloud anchors
 * Complex organic shape - approximated positions at 0-100%
 */
const CLOUD_ANCHORS: ShapeAnchorPoint[] = [
  { position: 'top', xPercent: 52.63, yPercent: 0, label: 'top bulge' },
  { position: 'top-right', xPercent: 84.21, yPercent: 11.67, label: 'top-right bulge' },
  { position: 'right', xPercent: 100, yPercent: 50, label: 'right side' },
  { position: 'bottom-right', xPercent: 84.21, yPercent: 100, label: 'bottom-right' },
  { position: 'bottom', xPercent: 52.63, yPercent: 100, label: 'bottom mid' },
  { position: 'bottom-left', xPercent: 21.05, yPercent: 100, label: 'bottom-left' },
  { position: 'left', xPercent: 0, yPercent: 66.67, label: 'left side' },
  { position: 'top-left', xPercent: 30, yPercent: 25, label: 'top-left bulge' },
];

/**
 * Line shape anchors - start and end points
 */
const LINE_ANCHORS: ShapeAnchorPoint[] = [
  { position: 'left', xPercent: 0, yPercent: 50, label: 'start' },
  { position: 'right', xPercent: 100, yPercent: 50, label: 'end' },
];

/**
 * Shape anchor point registry
 * Maps shape types to their specific anchor configurations
 */
const SHAPE_ANCHORS: Record<string, ShapeAnchorPoint[]> = {
  // CSS shapes
  'rectangle': RECTANGULAR_ANCHORS,
  'square': RECTANGULAR_ANCHORS,
  'rounded-rectangle': RECTANGULAR_ANCHORS,
  'circle': CIRCLE_ANCHORS,
  'ellipse': CIRCLE_ANCHORS,
  
  // Basic polygons
  'triangle': TRIANGLE_ANCHORS,
  'diamond': DIAMOND_ANCHORS,
  'pentagon': PENTAGON_ANCHORS,
  'hexagon': HEXAGON_ANCHORS,
  'octagon': OCTAGON_ANCHORS,
  'parallelogram': PARALLELOGRAM_ANCHORS,
  'trapezoid': TRAPEZOID_ANCHORS,
  
  // Lines (stroke-only)
  'line': LINE_ANCHORS,
  'line-arrow': LINE_ANCHORS,
  'line-arrow-double': LINE_ANCHORS,
  'elbow-connector': LINE_ANCHORS,
  'elbow-arrow': LINE_ANCHORS,
  'curved-connector': LINE_ANCHORS,
  'curved-arrow': LINE_ANCHORS,
  's-connector': LINE_ANCHORS,
  's-arrow': LINE_ANCHORS,
  
  // Arrows
  'arrow-right': ARROW_RIGHT_ANCHORS,
  'arrow-left': ARROW_LEFT_ANCHORS,
  'arrow-up': ARROW_UP_ANCHORS,
  'arrow-down': ARROW_DOWN_ANCHORS,
  'arrow-double': ARROW_DOUBLE_ANCHORS,
  
  // Flowchart shapes
  'flowchart-process': FLOWCHART_PROCESS_ANCHORS,
  'flowchart-decision': FLOWCHART_DECISION_ANCHORS,
  'flowchart-data': FLOWCHART_DATA_ANCHORS,
  'flowchart-terminator': FLOWCHART_TERMINATOR_ANCHORS,
  
  // Callouts
  'callout-rectangle': CALLOUT_RECTANGLE_ANCHORS,
  'callout-rounded': CALLOUT_ROUNDED_ANCHORS,
  'callout-cloud': CALLOUT_CLOUD_ANCHORS,
  
  // Stars
  'star-4': STAR_4_ANCHORS,
  'star-5': STAR_5_ANCHORS,
  'star-6': STAR_6_ANCHORS,
  'star-8': STAR_8_ANCHORS,
  
  // Other shapes
  'wave': RECTANGULAR_ANCHORS,
  'cross': CROSS_ANCHORS,
  'heart': HEART_ANCHORS,
  'lightning': LIGHTNING_ANCHORS,
  'moon': MOON_ANCHORS,
  'cloud': CLOUD_ANCHORS,
};

/**
 * Get anchor points for a specific shape type.
 * Falls back to rectangular anchors if shape type is not found.
 * 
 * @param shapeType The shape type identifier
 * @returns Array of anchor points for the shape
 */
export function getShapeAnchors(shapeType: string): ShapeAnchorPoint[] {
  return SHAPE_ANCHORS[shapeType] || RECTANGULAR_ANCHORS;
}

/**
 * Get all registered shape types that have custom anchors
 */
export function getShapeTypesWithAnchors(): string[] {
  return Object.keys(SHAPE_ANCHORS);
}

/**
 * Check if a shape has custom (non-rectangular) anchors
 */
export function hasCustomAnchors(shapeType: string): boolean {
  const anchors = SHAPE_ANCHORS[shapeType];
  return anchors !== undefined && anchors !== RECTANGULAR_ANCHORS;
}

/**
 * Get the default rectangular anchors (for fallback or comparison)
 */
export function getDefaultAnchors(): ShapeAnchorPoint[] {
  return RECTANGULAR_ANCHORS;
}
