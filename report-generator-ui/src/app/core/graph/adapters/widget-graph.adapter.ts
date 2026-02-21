import type { ConnectorWidgetProps } from '../../../models/widget.model';
import type { NormalizedDocumentState, WidgetEntity } from '../../../store/document/document.state';
import type { GraphConnectorEdge, GraphDocument, GraphNode } from '../models/graph-document.model';
import { GRAPH_SCHEMA_VERSION_CURRENT } from '../models/graph-schema.model';

const GRAPH_METADATA_KEY = 'graph';

function isConnectorWidget(widget: WidgetEntity): widget is WidgetEntity & { props: ConnectorWidgetProps } {
  return widget.type === 'connector';
}

function toGraphNode(widget: WidgetEntity): GraphNode {
  return {
    id: widget.id,
    kind: 'widget',
    widgetType: widget.type,
    pageId: widget.pageId,
    x: widget.position.x,
    y: widget.position.y,
    width: widget.size.width,
    height: widget.size.height,
    rotation: widget.rotation,
    zIndex: widget.zIndex,
    locked: widget.locked,
  };
}

function toConnectorEdge(widget: WidgetEntity & { props: ConnectorWidgetProps }): GraphConnectorEdge | null {
  const fromWidgetId = widget.props.startAttachment?.widgetId;
  const toWidgetId = widget.props.endAttachment?.widgetId;
  if (!fromWidgetId || !toWidgetId) {
    return null;
  }
  return {
    id: widget.id,
    kind: 'connector',
    connectorWidgetId: widget.id,
    fromWidgetId,
    toWidgetId,
    fromAnchor: widget.props.startAttachment?.anchor,
    toAnchor: widget.props.endAttachment?.anchor,
  };
}

function readConnectorEdgesFromMetadata(normalized: NormalizedDocumentState): GraphConnectorEdge[] {
  const metadata = (normalized.meta.metadata ?? {}) as Record<string, unknown>;
  const graph = metadata[GRAPH_METADATA_KEY] as any;
  const edges = Array.isArray(graph?.connectorEdges) ? graph.connectorEdges : [];

  return edges
    .filter((edge: unknown) => !!edge && typeof edge === 'object')
    .map((edge: unknown) => {
      const raw = edge as Record<string, unknown>;
      const connectorWidgetId = String((edge as any).connectorWidgetId ?? '');
      const fromWidgetId = String((edge as any).fromWidgetId ?? '');
      const toWidgetId = String((edge as any).toWidgetId ?? '');
      if (!connectorWidgetId || !fromWidgetId || !toWidgetId) {
        return null;
      }

      return {
        id: String((edge as any).id ?? connectorWidgetId),
        kind: 'connector' as const,
        connectorWidgetId,
        fromWidgetId,
        toWidgetId,
        ...(typeof raw['fromAnchor'] === 'string' ? { fromAnchor: raw['fromAnchor'] } : {}),
        ...(typeof raw['toAnchor'] === 'string' ? { toAnchor: raw['toAnchor'] } : {}),
      };
    })
    .filter((edge: GraphConnectorEdge | null): edge is GraphConnectorEdge => !!edge);
}

export function buildGraphDocumentFromNormalized(normalized: NormalizedDocumentState): GraphDocument {
  const widgets = normalized.widgets.ids
    .map((id) => normalized.widgets.entities[id])
    .filter((widget): widget is WidgetEntity => !!widget);

  const nodes = widgets.map(toGraphNode);
  const connectorEdges = readConnectorEdgesFromMetadata(normalized);

  return {
    schemaVersion: GRAPH_SCHEMA_VERSION_CURRENT,
    nodes,
    connectorEdges,
  };
}
