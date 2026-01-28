import type { WidgetEntity } from '../../../store/document/document.state';

export type ResizeHandle =
  | 'right'
  | 'bottom'
  | 'corner'
  | 'corner-top-right'
  | 'corner-top-left'
  | 'corner-bottom-left'
  | 'left'
  | 'top';

export type DragHandleMode = 'border-only' | 'anywhere';

export type WidgetInteractionPolicy = {
  /** Which resize handles should be shown/enabled for this widget. */
  allowedResizeHandles: ReadonlySet<ResizeHandle>;
  /** Whether a rectangular selection border should be drawn around the widget container. */
  showSelectionBorder: boolean;
  /** How dragging should be initiated (border-only vs anywhere within the frame). */
  dragHandleMode: DragHandleMode;
  /** Optional fixed height behavior for specific widget families (e.g. straight connectors). */
  preferredHeightPx?: number;
};

const ALL_HANDLES: ReadonlySet<ResizeHandle> = new Set([
  'right',
  'bottom',
  'corner',
  'corner-top-right',
  'corner-top-left',
  'corner-bottom-left',
  'left',
  'top',
]);

const HORIZONTAL_ONLY_HANDLES: ReadonlySet<ResizeHandle> = new Set(['left', 'right']);

// Connectors use endpoint handles instead of standard resize handles
const CONNECTOR_ENDPOINT_HANDLES: ReadonlySet<ResizeHandle> = new Set([]);

// Elbow connectors are 2D, so allow resizing width/height.
const ELBOW_HANDLES: ReadonlySet<ResizeHandle> = new Set([
  'right',
  'bottom',
  'corner',
]);

const HORIZONTAL_CONNECTOR_SHAPES = new Set<string>(['line', 'line-arrow', 'line-arrow-double']);
const ELBOW_CONNECTOR_SHAPES = new Set<string>(['elbow-connector', 'elbow-arrow']);
const CURVED_CONNECTOR_SHAPES = new Set<string>(['curved-connector', 'curved-arrow', 's-connector', 's-arrow']);
const CONNECTOR_SHAPES = new Set<string>([
  ...HORIZONTAL_CONNECTOR_SHAPES,
  ...ELBOW_CONNECTOR_SHAPES,
  ...CURVED_CONNECTOR_SHAPES,
]);

export const HORIZONTAL_CONNECTOR_HEIGHT_PX = 36;

export function isConnectorShapeType(shapeType: string | null | undefined): boolean {
  return !!shapeType && CONNECTOR_SHAPES.has(shapeType);
}

export function isHorizontalConnectorShapeType(shapeType: string | null | undefined): boolean {
  return !!shapeType && HORIZONTAL_CONNECTOR_SHAPES.has(shapeType);
}

export function isElbowConnectorShapeType(shapeType: string | null | undefined): boolean {
  return !!shapeType && ELBOW_CONNECTOR_SHAPES.has(shapeType);
}

export function isCurvedConnectorShapeType(shapeType: string | null | undefined): boolean {
  return !!shapeType && CURVED_CONNECTOR_SHAPES.has(shapeType);
}

export function getWidgetInteractionPolicy(widget: WidgetEntity | null): WidgetInteractionPolicy {
  if (!widget) {
    return {
      allowedResizeHandles: ALL_HANDLES,
      showSelectionBorder: true,
      dragHandleMode: 'border-only',
    };
  }

  // Dedicated connector widget type: no standard resize handles, uses endpoint handles instead
  // Drag is handled by the connector path (stroke) itself, not an overlay
  if (widget.type === 'connector') {
    return {
      allowedResizeHandles: CONNECTOR_ENDPOINT_HANDLES,
      showSelectionBorder: false,
      dragHandleMode: 'border-only',
    };
  }

  // Legacy object-based connector shapes (for backwards compatibility)
  if (widget.type === 'object') {
    const shapeType = (widget.props as any)?.shapeType as string | undefined;
    if (isHorizontalConnectorShapeType(shapeType)) {
      return {
        allowedResizeHandles: HORIZONTAL_ONLY_HANDLES,
        showSelectionBorder: false,
        dragHandleMode: 'anywhere',
        preferredHeightPx: HORIZONTAL_CONNECTOR_HEIGHT_PX,
      };
    }

    if (isElbowConnectorShapeType(shapeType)) {
      return {
        allowedResizeHandles: ELBOW_HANDLES,
        showSelectionBorder: false,
        dragHandleMode: 'anywhere',
      };
    }

    if (isCurvedConnectorShapeType(shapeType)) {
      return {
        allowedResizeHandles: ELBOW_HANDLES,
        showSelectionBorder: false,
        dragHandleMode: 'anywhere',
      };
    }

    // Any other connector-like shapes can opt into no-border + drag-anywhere,
    // even if they keep default resizing.
    if (isConnectorShapeType(shapeType)) {
      return {
        allowedResizeHandles: ALL_HANDLES,
        showSelectionBorder: false,
        dragHandleMode: 'anywhere',
      };
    }
  }

  // Default policy (all widgets)
  return {
    allowedResizeHandles: ALL_HANDLES,
    showSelectionBorder: true,
    dragHandleMode: 'border-only',
  };
}

export function isResizeHandleAllowed(policy: WidgetInteractionPolicy, handle: ResizeHandle): boolean {
  return policy.allowedResizeHandles.has(handle);
}
