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

const HORIZONTAL_CONNECTOR_SHAPES = new Set<string>(['line', 'line-arrow', 'line-arrow-double']);

export const HORIZONTAL_CONNECTOR_HEIGHT_PX = 36;

export function getWidgetInteractionPolicy(widget: WidgetEntity | null): WidgetInteractionPolicy {
  if (!widget) {
    return {
      allowedResizeHandles: ALL_HANDLES,
      showSelectionBorder: true,
      dragHandleMode: 'border-only',
    };
  }

  // Object widget connector policy
  if (widget.type === 'object') {
    const shapeType = (widget.props as any)?.shapeType as string | undefined;
    if (shapeType && HORIZONTAL_CONNECTOR_SHAPES.has(shapeType)) {
      return {
        allowedResizeHandles: HORIZONTAL_ONLY_HANDLES,
        showSelectionBorder: false,
        dragHandleMode: 'anywhere',
        preferredHeightPx: HORIZONTAL_CONNECTOR_HEIGHT_PX,
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
